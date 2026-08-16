/**
 * Drive Flow Ultra-Fast Cloudflare Worker Edge Proxy & Caching Engine
 * Offloads heavy GET requests, handles CORS preflights in 0ms, and proxies Render backend.
 */

export default {
  async fetch(request, env, ctx) {
    const RENDER_BACKEND_URL = env.RENDER_BACKEND_URL || "https://drive-flow-vlss.onrender.com";
    const CACHE_TTL_SECONDS = parseInt(env.CACHE_TTL_SECONDS || "300", 10);
    const url = new URL(request.url);

    // Standard CORS Headers for edge responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization, X-Requested-With, Range",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    };

    // 1. Answer CORS Preflight OPTIONS requests in 0ms directly at Edge (0 Render CPU load)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400", // Cache CORS preflight in browser for 24 hours (86400s)
        },
      });
    }

    // Target URL on Render Backend
    const backendUrl = new URL(url.pathname + url.search, RENDER_BACKEND_URL);

    // Forward original request headers
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", backendUrl.host);
    newHeaders.set("X-Forwarded-Host", url.host);
    newHeaders.set("X-Via-Worker", "Cloudflare-DriveFlow-UltraEdge");

    // 2. Cacheable GET Endpoints (Edge Caching for Stats, Ping & File Previews/Inline Streams)
    const isPreviewRequest =
      request.method === "GET" &&
      (url.pathname.includes("/download") ||
        url.pathname.includes("/preview") ||
        url.pathname.includes("/thumbnail"));

    const isCacheableGet =
      (request.method === "GET" &&
        !request.headers.get("Authorization") &&
        (url.pathname.startsWith("/api/files/stats") ||
          url.pathname.startsWith("/api/auth/ping"))) ||
      isPreviewRequest;

    const cache = caches.default;

    if (isCacheableGet) {
      const cacheKey = new Request(url.toString(), request);
      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        // Return 0ms cached binary preview response from Cloudflare Edge
        const responseHeaders = new Headers(cachedResponse.headers);
        responseHeaders.set("X-Cache-Status", "HIT-Cloudflare-PreviewEdge");
        for (const [key, value] of Object.entries(corsHeaders)) {
          responseHeaders.set(key, value);
        }
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers: responseHeaders,
        });
      }
    }

    // 3. Proxy non-cached request to Render Backend with high-speed streaming
    try {
      const backendResponse = await fetch(backendUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
        redirect: "follow",
      });

      // Prepare response headers
      const responseHeaders = new Headers(backendResponse.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
      }
      responseHeaders.set("X-Cache-Status", "MISS-Passed-To-Render");

      // Build Edge Response
      const response = new Response(backendResponse.body, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: responseHeaders,
      });

      // If GET & Cacheable, store in Cloudflare Edge Cache
      if (isCacheableGet && backendResponse.status === 200) {
        const edgeCacheTTL = isPreviewRequest ? 86400 : CACHE_TTL_SECONDS;
        responseHeaders.set("Cache-Control", `public, max-age=${edgeCacheTTL}, s-maxage=${edgeCacheTTL}, stale-while-revalidate=3600`);
        const responseToCache = new Response(response.clone().body, {
          status: response.status,
          headers: responseHeaders,
        });
        ctx.waitUntil(cache.put(new Request(url.toString(), request), responseToCache));
      }

      return response;
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Cloudflare Edge Proxy Error",
          message: error.message || "Failed to reach Render backend",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  },
};

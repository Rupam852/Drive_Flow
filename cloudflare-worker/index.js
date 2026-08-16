/**
 * Drive Flow Cloudflare Worker Edge Proxy & Caching Engine
 * Offloads heavy GET requests, handles CORS preflights in 0ms, and proxies Render backend.
 */

export default {
  async fetch(request, env, ctx) {
    const RENDER_BACKEND_URL = env.RENDER_BACKEND_URL || "https://drive-flow-vlss.onrender.com";
    const url = new URL(request.url);

    // Standard CORS Headers for edge responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Allow-Credentials": "true",
    };

    // 1. Answer CORS Preflight OPTIONS requests in 0ms directly at Edge (0 Render CPU load)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
        },
      });
    }

    // Target URL on Render Backend
    const backendUrl = new URL(url.pathname + url.search, RENDER_BACKEND_URL);

    // Forward original request headers
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", backendUrl.host);
    newHeaders.set("X-Forwarded-Host", url.host);
    newHeaders.set("X-Via-Worker", "Cloudflare-DriveFlow");

    // 2. Cacheable GET Endpoints (Edge Caching)
    const isCacheableGet =
      request.method === "GET" &&
      !request.headers.get("Authorization") && // Only cache unauthenticated / public reads
      (url.pathname.startsWith("/api/files/stats") ||
        url.pathname.startsWith("/api/auth/ping"));

    const cache = caches.default;

    if (isCacheableGet) {
      const cacheKey = new Request(url.toString(), request);
      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        // Return 0ms cached response from Cloudflare Edge
        const responseHeaders = new Headers(cachedResponse.headers);
        responseHeaders.set("X-Cache-Status", "HIT-Cloudflare-Edge");
        for (const [key, value] of Object.entries(corsHeaders)) {
          responseHeaders.set(key, value);
        }
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers: responseHeaders,
        });
      }
    }

    // 3. Proxy non-cached request to Render Backend
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

      // If GET & Cacheable, store in Cloudflare Edge Cache for 30 seconds
      if (isCacheableGet && backendResponse.status === 200) {
        responseHeaders.set("Cache-Control", "public, max-age=30, s-maxage=30");
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

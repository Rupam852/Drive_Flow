# Drive Flow Cloudflare Worker Edge Proxy

This Cloudflare Worker accelerates Drive Flow by offloading heavy work from Render.com:
- **0ms CORS Preflights**: Responds to browser `OPTIONS` requests instantly at the Edge.
- **Edge Caching**: Caches public read APIs (`/api/files/stats`, etc.) globally across Cloudflare's 270+ cities.
- **Transparent Reverse Proxy**: Forwards `POST`, `PUT`, `DELETE`, and file uploads smoothly to Render.

---

## Deployment Instructions

### 1. Update Render Backend URL
Open [`wrangler.json`](file:///d:/PROJECT/File_Opcus/cloudflare-worker/wrangler.json) and set your exact Render backend domain in `RENDER_BACKEND_URL`:
```json
"vars": {
  "RENDER_BACKEND_URL": "https://your-actual-render-app.onrender.com"
}
```

### 2. Deploy to Cloudflare (1-Click)
Open terminal inside `cloudflare-worker/` directory and run:
```bash
npx wrangler deploy
```

If you are not logged into Cloudflare CLI yet, it will prompt you once to log in via browser.

### 3. Update Frontend API Endpoint
Once deployed, Cloudflare will give you a worker URL like:
`https://driveflow-worker.yourname.workers.dev`

Update your frontend `.env.local` or environment variable:
```env
NEXT_PUBLIC_API_URL=https://driveflow-worker.yourname.workers.dev/api
```

---

## Features
- **0 Render Server Load for Preflights**: Browsers send `OPTIONS` requests before every API call; Cloudflare handles 100% of these.
- **Global Low Latency**: Requests are served from the closest Cloudflare data center to your users.

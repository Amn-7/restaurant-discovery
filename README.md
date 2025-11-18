# Restaurant Order Discovery App

See what diners are eating right now, browse a rich photo menu, and discover **“Popular Now”** dishes — with an admin dashboard to manage menu and orders.

Tech: **Next.js (App Router) + MongoDB (Mongoose)**  
Realtime (optional): Socket.io (future step)

---

## Features (MVP)
- **Live Feed** of recent/active orders (`/`)
- **“Top Pick”** (popular dishes in the selected time window)
- **Menu** with images, descriptions, availability (`/menu`)
- **Admin dashboard** with protected login (`/admin`)
- MongoDB models: **MenuItem**, **Order**
- Seed script for demo data

---

## Quick Start

### 1) Requirements
- Node 18+
- MongoDB (Atlas or local)

### 2) Install
```bash
npm i
npm i mongoose swr
npm i -D dotenv
```

### 3) Run locally

Create a `.env.local` with the usual Mongo string plus an admin key, e.g.

```
MONGODB_URI=mongodb://127.0.0.1:27017/restaurant_discovery
IRON_SESSION_PASSWORD=please-change-me-at-least-32-characters
ADMIN_KEY_HASH=$2a$12$your-generated-bcrypt-hash
UPSTASH_REDIS_REST_URL= # optional, enables production rate limiting
UPSTASH_REDIS_REST_TOKEN=
SKIP_DEMO_SEED=0
```

To generate the bcrypt hash run:

```bash
node -e "console.log(require('bcryptjs').hashSync('change-me', 12))"
```

Then start the dev server:

```
npm run dev
```

### Backend API (separate service)

If you want to run the REST API outside of Next.js (for example to host it on a different server):

```
cd backend
npm install
cp ../.env.local .env.local   # or create backend/.env with the required vars
npm run dev
```

Required variables (same values you already use for the Next.js API):

```
MONGODB_URI=...
IRON_SESSION_PASSWORD=...
ADMIN_KEY_HASH=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_UPLOAD_FOLDER=restaurant/menu
CLOUDINARY_UPLOAD_PRESET=...
SKIP_DEMO_SEED=1
# Optional
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The backend exposes the same `/api/*` routes as the Next.js server, so you can point `API_PROXY_ORIGIN` (or your reverse proxy) at it when you are ready to fully separate the stacks.

### Production build

Before deploying, run the production build locally to catch issues:

```
UPSTASH_REDIS_REST_URL=https://example.com \
UPSTASH_REDIS_REST_TOKEN=dummy npm run build
```

Use real Upstash credentials (or disable the limiter) in production.

### Admin access

- Visit `/admin/login` and enter the plain-text key you hashed above to receive a short-lived, http-only session cookie.
- Click **Sign out** on the admin dashboard to clear the session.
- If you leave `ADMIN_KEY_HASH` unset the admin routes are intentionally locked; supply the hash during local development to access protected pages.
- Always provide a strong `IRON_SESSION_PASSWORD` (32+ chars) and real bcrypt hash in production; the dev fallback is disabled when `NODE_ENV=production`.

---

## Deployment Checklist

1. **Environment** – populate `.env.production` using `.env.production.template` with production values for MongoDB, session secret, `ADMIN_KEY_HASH`, Cloudinary, and Upstash.
2. **Build** – run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build` locally; resolve any failures.
3. **Assets** – verify you have rights to all images in `public/menu`. The helper scripts under `scripts/` download Unsplash assets for demo purposes only—replace them with licensed imagery before launch.
4. **Monitoring** – configure your hosting (Vercel/Render/etc.) to surface logs so you can observe the structured events emitted from API routes.

### Observability
- **Structured request logs**: Backend emits JSON logs for `request.start`, `request.end`, and errors with `x-request-id`, status and `durationMs` (see `backend/src/middleware/observability.ts`). Attach your platform’s log aggregator (e.g., Cloud logs, Datadog) to parse JSON logs.
- **Health & diagnostics**:
  - `/api/health` now reports `uptimeSec` and `memory` (rss/heap).
  - `/api/db/diagnostics` (admin‑gated) returns connection state and collection counts to validate Atlas setup.
- **Uptime checks**: Point your uptime monitor at `GET /api/health` on the backend and the proxied `GET /api/health` on the frontend.

### Rollback
- Keep the previous deployment (or container) available for redeploy. In Vercel you can revert from the Deployments tab; with container hosting keep the prior image tag ready.
- Backup the MongoDB database (or take a snapshot) before migrations so you can restore it if needed.
- To disable a bad release quickly, set the `MAINTENANCE_MODE=1` env (implement a banner or proxy rule) or redeploy the prior artifact.

## Phase 8 – CI/CD & Deployment

### Backend service
- **Build command**: `npm ci --prefix backend && npm run build --prefix backend`
- **Runtime command**: `node dist/index.js` (see `backend/Dockerfile` for a minimal multi-stage container that compiles TypeScript and runs the API on port 3001).
- **Health probe**: configure your platform to hit `GET /api/health`; deployments should only go healthy once this endpoint returns `{ ok: true }`.
- **Environment**: supply the same secrets documented in `backend/env.example` plus `SSE_REDIS_URL` if you need cross-instance SSE. In container hosts, keep them as platform secrets rather than baking into the image.

### Frontend service
- Deploy the Next.js app (e.g., Vercel, Netlify, Azure Static Web Apps). Set `API_PROXY_ORIGIN=https://your-backend-host` so `/api/*` requests proxy to the Express API.
- Static assets are cacheable via CDN automatically; ensure your host leaves `/api/*` un-cached so live menu/orders stay dynamic.

### GitHub Actions & artifacts
- The workflow under `.github/workflows/backend-build.yml` installs backend deps, runs `npm run build --prefix backend`, and uploads the `dist` folder as an artifact you can promote into your container registry or host. Extend it with deployment steps (Render, Azure App Service, ECS, etc.) once credentials are available.
- Keep a rollback path by retaining the previous artifact (or container image tag) and, for the frontend, using Vercel’s built-in “Revert deployment” button.

### Admin handbook
- **Login** – visit `/admin/login` and sign in with the hashed key; sessions are stored via `iron-session` with `restaurant_admin` cookie.
- **Menu updates** – the admin dashboard `/admin` allows creating dishes, toggling availability, and uploading imagery (uploads are secured via Cloudinary).
- **Orders** – from `/admin` you can mark tickets as served; guests can place orders from `/t/{table}`.
- **QR codes** – generate table QR PNGs at `/admin/qr`; each code targets `/t/{table}` so guests land on their table view.
- **Analytics** – `/analytics` surfaces popular dishes and ratings. Use it to monitor trends during service.

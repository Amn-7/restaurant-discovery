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

### Rollback
- Keep the previous deployment (or container) available for redeploy. In Vercel you can revert from the Deployments tab; with container hosting keep the prior image tag ready.
- Backup the MongoDB database (or take a snapshot) before migrations so you can restore it if needed.
- To disable a bad release quickly, set the `MAINTENANCE_MODE=1` env (implement a banner or proxy rule) or redeploy the prior artifact.

### Admin handbook
- **Login** – visit `/admin/login` and sign in with the hashed key; sessions are stored via `iron-session` with `restaurant_admin` cookie.
- **Menu updates** – the admin dashboard `/admin` allows creating dishes, toggling availability, and uploading imagery (uploads are secured via Cloudinary).
- **Orders** – from `/admin` you can mark tickets as served; guests can place orders from `/t/{table}`.
- **QR codes** – generate table QR PNGs at `/admin/qr`; each code targets `/t/{table}` so guests land on their table view.
- **Analytics** – `/analytics` surfaces popular dishes and ratings. Use it to monitor trends during service.

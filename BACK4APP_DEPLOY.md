# Back4App one-container deploy (frontend + backend)

This setup builds Vite frontend inside Docker and serves it from FastAPI.
Result: one URL for UI and API.

## 1) What is already prepared in this repository

- `Dockerfile` is multi-stage:
  - Stage 1 builds frontend (`npm run build`)
  - Stage 2 runs FastAPI (`uvicorn main:app`)
  - `dist` from frontend is copied into final image
- `app/api.py` already serves SPA from `dist` when it exists
- `services/apiService.ts` is configured for same-origin production mode

## 2) Push code to GitHub

1. Commit your changes.
2. Push branch to GitHub.
3. Confirm repository contains:
   - `Dockerfile`
   - `requirements.txt`
   - `main.py`
   - frontend source files (`App.tsx`, `services/*`, etc.)

## 3) Create Back4App container from GitHub

1. Open Back4App dashboard.
2. Go to **Containers**.
3. Click **Create new app**.
4. Select **Import from GitHub**.
5. Authorize Back4App to access repository (if requested).
6. Pick repository + branch.
7. Back4App detects `Dockerfile` automatically.
8. Set **Port** to `8000` (if requested by UI).

## 4) Add required environment variables

In container settings add:

- `DATABASE_URL=<your_remote_postgres_url>`
- `ALLOWED_ORIGINS=["https://<your-back4app-app-domain>"]`
- `VERIFY_RATE_LIMIT_PER_MINUTE=30`

Notes:
- `ALLOWED_ORIGINS` must be JSON array string.
- Because frontend and backend are same domain in this setup, one origin is enough.

## 5) Deploy and verify

1. Click **Deploy**.
2. Wait for successful build and running status.
3. Open health endpoint:
   - `https://<your-back4app-app-domain>/health`
4. Open root URL:
   - `https://<your-back4app-app-domain>/`
5. Confirm frontend opens and user list/registration calls work.

## 6) Database requirement (important)

For remote users, backend must connect to a remote DB.

### Can database stay local on your laptop?

Not recommended for this scenario:
- server in Back4App cannot reliably reach home network DB
- laptop must stay online permanently
- NAT/firewall and IP changes break connectivity

### Correct architecture

Use deployed Postgres and pass its URL in `DATABASE_URL`.
Flow:
- User browser -> Back4App app
- Back4App app -> remote Postgres

## 7) Optional troubleshooting checklist

If UI opens but API calls fail:
- check browser console for CORS errors
- verify `ALLOWED_ORIGINS` exactly matches app domain
- ensure `DATABASE_URL` is valid and DB accepts external connections
- verify `/health` returns status `ok`

If deploy fails during frontend build:
- ensure lock file is present (`package-lock.json`) or adjust Dockerfile install step
- check `npm run build` works locally before pushing

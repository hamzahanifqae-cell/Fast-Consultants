# Deploy Fast Consultants (free tier)

Stack: **Supabase** (Postgres + file storage) · **Render** (Laravel API) · **Vercel** (web) · **Expo EAS** (mobile)

---

## 1. Supabase — database + uploads

1. Create a project at [supabase.com](https://supabase.com) (free).
2. **Database** → Settings → Connection string → **URI** (port `5432`).
   - Copy as `DB_URL` for Render.
   - Set `DB_SSLMODE=require`.
3. **Storage** → New bucket `uploads` (private).
4. **Project Settings → Storage → S3 connection** (if available) or create S3 access keys:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_ENDPOINT` (Supabase S3 endpoint)
   - `AWS_BUCKET=uploads`
   - `AWS_USE_PATH_STYLE_ENDPOINT=true`
   - `AWS_DEFAULT_REGION=us-east-1`

---

## 2. Render — Laravel API (free)

1. [render.com](https://render.com) → **New** → **Blueprint** (or Web Service).
2. Connect GitHub repo `Fast-Consultants`.
3. Use repo root `render.yaml` (Docker, `backend/` root).
4. Set environment variables in Render dashboard:

| Variable | Value |
|----------|--------|
| `APP_URL` | `https://YOUR-SERVICE.onrender.com` |
| `FRONTEND_URL` | `https://YOUR-APP.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | `https://YOUR-APP.vercel.app` |
| `DB_URL` | Supabase Postgres URI |
| `DB_SSLMODE` | `require` |
| `FILESYSTEM_DISK` | `s3` |
| `FILESYSTEM_UPLOADS_DISK` | `s3` |
| `AWS_*` | Supabase S3 credentials |
| `CRON_SECRET` | Random string (Render can auto-generate) |

5. First deploy runs migrations via `docker/start.sh`.
6. Seed demo data (Render shell or one-off job):

```bash
php artisan db:seed --force
```

7. **Interview reminders (free cron):** [cron-job.org](https://cron-job.org) → every minute:

```
GET https://YOUR-SERVICE.onrender.com/cron/interview-reminders
Header: X-Cron-Secret: YOUR_CRON_SECRET
```

Health check: `GET /up`

---

## 3. Vercel — web (free)

1. [vercel.com](https://vercel.com) → Import GitHub repo.
2. **Root Directory:** `web`
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. Environment variable:

```
VITE_API_URL=https://YOUR-SERVICE.onrender.com/api
```

6. Deploy. SPA routing is configured in `web/vercel.json`.

---

## 4. Mobile — Expo EAS (free tier)

1. Install CLI: `npm i -g eas-cli`
2. Login: `eas login`
3. From `mobile/`:

```bash
eas init
eas build:configure
```

4. In [expo.dev](https://expo.dev) → project → **Environment variables** → production:

```
EXPO_PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com/api
```

5. Preview APK (Android, no store):

```bash
eas build --platform android --profile preview
```

6. iOS TestFlight requires Apple Developer ($99/yr):

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

---

## 5. Verify

- API: `https://YOUR-SERVICE.onrender.com/up` → 200
- Web: login at Vercel URL (`superadmin@example.com` / `password` after seed)
- Mobile: build with production `EXPO_PUBLIC_API_URL`

---

## Notes

- Render **free** tier sleeps after ~15 min idle (cold start ~30–60s).
- Railway also slows down when idle on free/limited credit. This repo includes
  `.github/workflows/keep-api-awake.yml` (pings `/up` every 5 minutes) plus
  client warm-up + retries so logins fail less often without upgrading.
- Do not commit `.env` files or tokens.
- Revoke any PAT shared in chat; use `gh auth login` instead.

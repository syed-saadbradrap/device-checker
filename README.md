# DeviceLab

Professional website & email testing platform — multi-device responsive previews, Playwright cross-browser captures, Lighthouse performance, axe-core accessibility, SEO analysis, email HTML lab, and visual regression.

## Features

- **Responsive Tester** — multi-device CSS viewport workspace, zoom/orientation, sync scroll, fullscreen
- **Device library** — latest iPhone / iPad / Galaxy / Pixel / OnePlus / Xiaomi / desktop presets (CSS viewport ≠ physical resolution)
- **Iframe honesty** — if X-Frame-Options/CSP blocks embedding, DeviceLab explains why (never fakes a render)
- **Playwright screenshots** — Chromium, Firefox, WebKit
- **Responsive analyzer** — overflow, clipping, nav/forms/flex issues across breakpoints
- **Email lab** — paste/upload HTML, sanitized sandboxed preview (no scripts), simulated client widths
- **Theme testing** — `prefers-color-scheme` light/dark via Playwright (labeled as emulation)
- **Audits** — Lighthouse, axe-core, SEO + broken-link sampling
- **Visual regression** — Pixelmatch diff with threshold
- **Projects / history / reports** — Prisma persistence
- **Security** — URL validation, SSRF/DNS checks, rate limits, upload size caps

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma · Playwright · Lighthouse · axe-core · Sharp · Pixelmatch · Recharts

## Quick start

```bash
npm install
npx playwright install chromium firefox webkit
cp .env.example .env
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Prisma connection string | `file:./dev.db` (SQLite) |
| `NEXT_PUBLIC_APP_NAME` | App name | DeviceLab |
| `NEXT_PUBLIC_APP_URL` | Public origin | `http://localhost:3000` |
| `SCREENSHOT_DIR` | Screenshot storage | `./storage/screenshots` |
| `MAX_UPLOAD_BYTES` | HTML upload cap | `2097152` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX` | Max requests / window | `60` |
| `PLAYWRIGHT_TIMEOUT_MS` | Navigation timeout | `30000` |
| `JOB_CONCURRENCY` | Heavy job slots | `2` |

## Database

**Local (default):** SQLite via Prisma (`prisma/dev.db`).

```bash
npm run db:push
npm run db:studio
```

**Production PostgreSQL:**

1. `docker compose up -d` (or use a managed Postgres)
2. In `prisma/schema.prisma`, set `provider = "postgresql"`
3. Set `DATABASE_URL="postgresql://devicelab:devicelab@localhost:5432/devicelab"`
4. `npx prisma db push` (or `prisma migrate dev`)

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Sync Prisma schema |
| `npm run db:generate` | Generate Prisma client |

## Architecture

```
src/
  app/(app)/          # Product UI routes
  app/api/            # API routes (audits, screenshots, projects, jobs…)
  components/         # UI, layout, testing workspace
  lib/
    analysis/         # responsive, lighthouse, axe, seo, visual
    browser/          # Playwright pool + screenshot helpers
    devices/          # Central device presets
    email/            # Sanitize + compatibility analysis
    jobs/             # In-process job queue (concurrency capped)
    security/         # SSRF URL validation + rate limiting
```

Heavy browser work runs through Playwright with timeouts. Background jobs (`/api/jobs`) cap concurrency at 2.

## Known limitations

- Email client profiles are **simulations** (viewport/CSS constraints), not Litmus/Email on Acid–class engines.
- Theme tester uses Playwright `colorScheme` emulation — not a guarantee of a site’s native dark mode.
- Cross-browser engines are Playwright Chromium / Firefox / WebKit — not branded Safari or Chrome release channels.
- Sites that block automation or are geo/WAF protected may fail captures.
- Full responsive analyzer across all breakpoints is intentionally thorough and can take several minutes.
- In-process job queue is suitable for single-node deploys; use an external queue (BullMQ/Redis) for horizontal scale.

## Security notes

- Only `http:` / `https:` public URLs
- Blocks localhost, private IPs, link-local, and cloud metadata hosts
- Re-validates DNS and redirect targets
- Email HTML is sanitized; previews omit `allow-scripts`
- API mutations are rate-limited

## License

Private / proprietary unless otherwise specified.

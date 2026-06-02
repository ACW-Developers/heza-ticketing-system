
# Full Rewrite: TanStack Start → React SPA + Netlify Functions

## Scope (this is large — ~30+ files touched)

The current app is built on TanStack Start (file-based routing, SSR, server functions, Cloudflare Worker runtime). Netlify can host TanStack Start, but you've asked for a clean plain-React rewrite. Here is everything that changes.

## What gets rewritten

### 1. Build & runtime
- Remove: `@lovable.dev/vite-tanstack-config`, `@tanstack/react-start`, `@tanstack/react-router`, Cloudflare Worker config, `src/server.ts`, `src/start.ts`, `wrangler.jsonc`, `src/routeTree.gen.ts`.
- Add: plain `vite.config.ts` with `@vitejs/plugin-react`, `react-router-dom` v6 for client routing, `netlify.toml` with SPA redirect (`/* → /index.html 200`).
- New entry: `src/main.tsx` + `index.html` at project root.

### 2. Routing (file-based → React Router)
Every file under `src/routes/` becomes a component under `src/pages/` wired through a `<Routes>` tree in `src/App.tsx`:

```
/auth                → pages/Auth.tsx
/events              → pages/Events.tsx
/events/:id          → pages/EventDetail.tsx
/my-tickets          → pages/MyTickets.tsx
/checkout/success    → pages/CheckoutSuccess.tsx
/setup-admin         → pages/SetupAdmin.tsx
/admin               → pages/admin/Layout.tsx (nested)
  /admin             → AdminDashboard
  /admin/events      → AdminEvents
  /admin/users       → AdminUsers
  /admin/attendees   → AdminAttendees
  /admin/payments    → AdminPayments
  /admin/reports     → AdminReports
  /admin/activity    → AdminActivity
  /admin/traffic     → AdminTraffic
  /admin/settings    → AdminSettings
  /admin/profile     → AdminProfile
```

- `_authenticated` layout becomes a `<RequireAuth>` wrapper component.
- All `<Link to="...">` and `useNavigate()` calls swap to `react-router-dom` equivalents.
- `head()` metadata replaced with `react-helmet-async` or simple `document.title` updates.

### 3. Server logic (server functions → Netlify Functions)
Move to `netlify/functions/`:
- `checkout.ts` — replaces `src/routes/api/checkout.ts` (Stripe checkout session creation).
- `verify.ts` — replaces `src/routes/api/verify.ts` (post-payment ticket issuance).
- `setup-admin.ts` — replaces `src/lib/setup-admin.functions.ts`.

Each function: standard Netlify handler signature, manual CORS headers, Supabase auth via bearer token extracted from `Authorization` header, same Stripe + Supabase logic.

Frontend calls them at `/.netlify/functions/checkout` etc. (Netlify auto-routes).

### 4. SSR removal
- No more SSR / prerender. Initial page render is a blank shell + JS hydration.
- SEO impact: lose server-rendered meta tags. Acceptable for an authenticated ticketing app.
- Loaders go away. Data fetching moves to `useEffect` + `useState` or TanStack Query in components.

### 5. Files kept as-is
- All UI components (`src/components/**`, `src/components/ui/**`).
- Supabase browser client (`src/integrations/supabase/client.ts`).
- Auth hook (`src/hooks/useAuth.tsx`).
- Tailwind config + `src/styles.css`.
- Supabase schema/migrations.

### 6. Files deleted
- `src/routes/**` (entire directory)
- `src/routeTree.gen.ts`
- `src/router.tsx`
- `src/start.ts`
- `src/server.ts`
- `src/lib/error-page.ts`, `src/lib/error-capture.ts`
- `src/integrations/supabase/auth-middleware.ts`, `auth-attacher.ts`, `client.server.ts` (server fn infra)
- `wrangler.jsonc`
- `vite.config.ts` (replaced)

## Deployment to Netlify after rewrite

1. Push to GitHub (via Lovable's GitHub sync).
2. In Netlify: New site → import from GitHub → pick repo.
3. Build command: `npm run build` (or `bun run build`). Publish directory: `dist`.
4. Environment variables in Netlify UI:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (build-time, public).
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `ADMIN_SETUP_TOKEN` (function runtime, server-side).
5. `netlify.toml` declares functions directory + SPA redirect.

## Trade-offs you accept

- **No SSR** → worse SEO, slower first paint on slow networks.
- **You lose the Lovable preview's server-side features.** The Lovable preview in this editor relies on TanStack Start; after the rewrite the preview still works (it's a plain Vite SPA), but server functions stop existing in preview — only Netlify can run them. You'll need to deploy to Netlify (or run `netlify dev` locally) to test checkout end-to-end.
- **This is a one-way migration.** Going back to TanStack Start later means another rewrite.
- **All future Lovable AI edits** will work on the plain-React structure, not the TanStack one. The AI's TanStack-specific knowledge no longer applies.
- **Estimated effort**: ~30 file rewrites in this single execution. Some edge cases (admin guard timing, post-checkout flow) may need a follow-up pass after you test.

## Confirm before I start

Reply "go" (or with any tweaks) and I'll execute the full rewrite in one pass. If any of the trade-offs above are dealbreakers, the **"Keep current Cloudflare deploy, use Netlify as proxy"** option is dramatically less risky.

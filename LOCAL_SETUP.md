# Running MyPromoIQ locally

The app has three layers, each needing its own credentials:

| Layer | What it does | Where keys go | Needed to test |
|---|---|---|---|
| **Clerk** | Login / accounts | `VITE_CLERK_PUBLISHABLE_KEY` (client) | Logging in |
| **Supabase** | Saves campaigns + scenes | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client) | Dashboard, persistence |
| **Netlify Functions** | Claude director + Higgsfield render | `ANTHROPIC_API_KEY`, `HF_API_KEY`, `HF_API_SECRET` (server) | Generating videos |

All of these go in a single `.env` file in the project root (gitignored — never commit it).

---

## ⚠️ Two different dev commands

| Command | Runs | Login? | Dashboard? | Video generation? |
|---|---|---|---|---|
| `npm run dev` | Vite only (port 5173) | ✅ | ✅ | ❌ `/api/*` returns 404 |
| `npm run dev:api` | Vite **+ Netlify Functions** (port 8888) | ✅ | ✅ | ✅ |

**To test video generation you must use `npm run dev:api`** (which runs `netlify dev`).
Plain `npm run dev` cannot run the serverless functions, so the "Generate" button will
fail. Open the URL Netlify prints (usually `http://localhost:8888`), **not** 5173.

The first time you run `npm run dev:api`, the Netlify CLI may ask to log in / link a
site — you can skip linking and run it locally.

---

## One-time setup checklist

### 1. Clerk (login)
1. Create a free app at https://clerk.com
2. **API Keys** → copy the Publishable key (`pk_test_…`)
3. **Configure → Paths**: Sign-in `/sign-in`, Sign-up `/sign-up`, After sign-in/up `/dashboard`
4. Put the key in `.env`: `VITE_CLERK_PUBLISHABLE_KEY=pk_test_…`

### 2. Supabase (database)
1. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**
2. **Settings → API** → copy Project URL + `anon`/`public` key into `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ…
   ```

### 3. Connect Clerk → Supabase (so RLS knows the user)
The database policies use the Clerk user id from the JWT (`auth.jwt() ->> 'sub'`).
1. In **Clerk → JWT Templates → New template**, name it exactly `supabase`
2. In **Supabase → Authentication → Third-Party Auth**, add Clerk as a provider
   (paste Clerk's issuer/JWKS URL). This lets Supabase trust Clerk-signed tokens.

> Until step 3 is done, login + the UI work, but campaigns won't save (RLS rejects the
> token). The app degrades gracefully — the dashboard just shows an empty state.

### 4. Generation keys (server-side)
In `.env`:
```
ANTHROPIC_API_KEY=sk-ant-…
VIDEO_PROVIDER=higgsfield
HF_API_KEY=your-key-id
HF_API_SECRET=your-key-secret
```

### 5. Run
```
npm run dev:api
```
Open the printed `http://localhost:8888`, sign up, go to Studio, generate.

---

## "I still can't log in"
Login depends **only** on Clerk — not Supabase or Higgsfield. Check:
- `VITE_CLERK_PUBLISHABLE_KEY` is a real `pk_test_…` key (not the placeholder)
- You restarted the dev server after editing `.env` (Vite only reads env at startup)
- The browser console for any Clerk error message

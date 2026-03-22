# MarketLens — Indian F&O & Swing Trading Journal

Fully automated NSE/BSE/NFO trading journal. Add your credentials once to Netlify — the app logs into Fyers **automatically every day** using TOTP. No manual token pasting ever.

---

## How Auto-Login Works

```
You add 5 env vars to Netlify (one time)
            ↓
App opens → calls /.netlify/functions/fyers-auth
            ↓
Serverless function: TOTP → verify PIN → get auth_code → exchange for token
            ↓
Token returned to browser → trades fetched automatically
            ↓
Token cached 23h in sessionStorage → auto-refreshed next day
```

---

## Quick Start

```bash
npm install
npm run dev   # Demo mode with 200 mock trades — works immediately
```

For full auto-login locally you need Netlify CLI:
```bash
npm install -g netlify-cli
netlify dev   # Runs functions locally too
```

---

## ONE-TIME SETUP

### STEP 1 — Enable Fyers External TOTP

This is the key step that allows passwordless login from your server.

1. Log in to **myaccount.fyers.in**
2. Go to **Manage Account → Security Settings**
3. Enable **"External 2FA TOTP"**
4. You'll see a QR code — **copy the TOTP SECRET KEY text** (e.g. `ABCDEFGHIJK234567`)
5. Optionally scan it with Google Authenticator too
6. **Save this key** — you'll need it as `FYERS_TOTP_KEY`

> This is a one-time setup. The TOTP key never changes unless you reset it.

---

### STEP 2 — Create a Fyers API App

1. Go to **myapi.fyers.in → Dashboard → Create App**
2. Fill in:
   - App Name: `MarketLens`
   - Redirect URI: your Netlify URL e.g. `https://markettrak.netlify.app`
   - Permissions: Read Orders, Positions, Trades
3. Note your **App ID** (e.g. `XJ12345`) and **Secret Key**

---

### STEP 3 — Add Env Vars to Netlify

Go to **Netlify → Site Settings → Environment Variables → Add variable**:

```
FYERS_APP_ID        =  XJ12345              (App ID, without the -100 suffix)
FYERS_SECRET_KEY    =  your_secret_key
FYERS_USER_ID       =  XJ12345              (your Fyers client ID)
FYERS_PIN           =  1234                 (4-digit Fyers PIN)
FYERS_TOTP_KEY      =  ABCDEFGHIJK...       (TOTP secret from Step 1)
FYERS_REDIRECT_URI  =  https://markettrak.netlify.app

VITE_SUPABASE_URL      =  https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY =  eyJ...
ANTHROPIC_API_KEY      =  sk-ant-...        (optional, for AI Analysis)
```

After adding → **Deploys → Trigger deploy → Deploy site**

---

### STEP 4 — Supabase Setup (for journal notes sync)

1. **supabase.com → New Project**
2. SQL Editor → run:

```sql
CREATE TABLE trade_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text, body text, mood text, tags text[],
  symbol text, date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trade_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON trade_notes FOR ALL USING (auth.uid() = user_id);

CREATE TABLE capital_flow (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  type text NOT NULL, amount numeric NOT NULL,
  time bigint NOT NULL, date text, note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE capital_flow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON capital_flow FOR ALL USING (auth.uid() = user_id);
```

3. **Authentication → Users → Invite user** — enter your email
4. **Authentication → URL Configuration** → set Site URL to your Netlify app URL

---

### STEP 5 — Deploy to Netlify

```bash
git init
git add .
git commit -m "MarketLens initial"
# Create a PRIVATE repo on github.com, then:
git remote add origin https://github.com/YOU/markettrak.git
git push -u origin main
```

Netlify:
1. **Add new site → Import from Git → select repo**
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Click **Deploy site**

---

## Daily Use

Just open your app URL. Auto-login handles everything:
- Token generated via TOTP silently in background
- Trade book loaded automatically
- Token cached 23h, refreshed next day

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Auto-login not configured" | Add FYERS_* env vars to Netlify and redeploy |
| "Step 2 TOTP failed" | FYERS_TOTP_KEY is wrong — re-copy from myaccount.fyers.in |
| "Step 3 PIN failed" | FYERS_PIN is wrong — it's your Fyers 4-digit login PIN |
| No trades showing | Trade book only has today — historical needs date range |
| Works locally, not Netlify | Check env vars saved + triggered redeploy after adding them |
| "Failed to fetch" in local dev | Use `netlify dev` not `npm run dev` |

---

## Project Structure

```
markettrak/
├── netlify/functions/
│   ├── fyers-auth.js      AUTO-LOGIN: TOTP flow, reads Netlify env vars
│   └── ai.js              AI Analysis proxy
├── src/
│   ├── hooks/
│   │   ├── useTrades.js   Calls fyers-auth on startup, caches token 23h
│   │   └── useAuth.jsx    Supabase auth
│   ├── lib/
│   │   ├── theme.js       Deep navy blue palette
│   │   ├── data.js        Indian market mock data + INR formatting
│   │   └── supabase.js    Supabase client + DB helpers
│   ├── components/
│   │   ├── Layout.jsx     Sidebar navigation
│   │   └── UI.jsx         Components + SegmentToggle
│   └── pages/             13 pages — Dashboard, Trades, Analytics, etc.
└── README.md
```

---

*MarketLens is a personal trading journal. Not investment advice.*

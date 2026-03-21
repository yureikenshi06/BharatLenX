# MarketLens — Indian F&O & Swing Trading Journal

A sophisticated trading journal for Indian markets (NSE/BSE/NFO) built with React + Vite.
Connects to **Fyers API** for live trade data. Dark navy theme. INR formatting throughout.

---

## Features

- **Segment Toggle** — View Equity / Options / Futures / All separately on every page
- **Dashboard** — P&L curve, drawdown, segment breakdown, radar score, day-of-week analysis
- **Trade Log** — Full sortable/filterable table with INR values, segment badges
- **Analytics** — Waterfall, P&L distribution, leverage analysis, 24hr heatmap
- **Calendar** — Trading calendar with Indian market holiday markers
- **Instruments** — Per-symbol deep analysis with equity curves
- **Capital** — Deposit/withdrawal tracking + live positions from Fyers
- **Progress** — Monthly goals tracker with score
- **Day Summary** — EOD journal with intraday breakdown
- **Checklists** — Pre-market checklist
- **Journal** — Trade notes with mood tagging
- **AI Analysis** — Claude-powered coaching (needs Anthropic API key)
- **Share Card** — Generate performance images (5 themes incl. Segment Split)

---

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## STEP-BY-STEP: Supabase Setup

### 1. Create Supabase Project
1. Go to https://supabase.com → **New Project**
2. Pick a name, set a strong database password, choose region (Asia South preferred)
3. Wait ~2 minutes for project to provision

### 2. Run SQL Schema
Go to **SQL Editor** in your Supabase dashboard, paste and run this:

```sql
-- Trade notes
CREATE TABLE trade_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  trade_id text, date date, symbol text,
  title text, body text, mood text, tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trade_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their notes" ON trade_notes
  FOR ALL USING (auth.uid() = user_id);

-- Capital flow (deposits & withdrawals)
CREATE TABLE capital_flow (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  time bigint NOT NULL,
  date text, note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE capital_flow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their flow" ON capital_flow
  FOR ALL USING (auth.uid() = user_id);

-- API keys (optional — for storing Fyers client ID)
CREATE TABLE api_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  api_key text, label text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id);
```

### 3. Create Your Account
1. Go to **Authentication → Users → Invite user**
2. Enter YOUR email and invite yourself
3. Check your email, click the link, set your password

### 4. Get Your API Keys
1. Go to **Project Settings → API**
2. Copy **Project URL** → this is your `VITE_SUPABASE_URL`
3. Copy **anon public** key → this is your `VITE_SUPABASE_ANON_KEY`

### 5. Create .env File
Create a file named `.env` in the project root:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## STEP-BY-STEP: Netlify Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "MarketLens initial"
# Create a new PRIVATE repo on github.com
git remote add origin https://github.com/YOUR_USERNAME/markettrak.git
git push -u origin main
```

### 2. Deploy on Netlify
1. Go to https://netlify.com → **Add new site → Import from Git**
2. Connect GitHub → Select your repo
3. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy site**

### 3. Add Environment Variables
Go to **Site Settings → Environment Variables → Add variable**:
```
VITE_SUPABASE_URL       = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY  = your-anon-key
ANTHROPIC_API_KEY       = sk-ant-...  (optional, for AI Analysis)
```

### 4. Set Supabase Auth URL
Back in Supabase: **Authentication → URL Configuration**
- Set **Site URL** to your Netlify URL (e.g. `https://markettrak.netlify.app`)

### 5. Redeploy
In Netlify dashboard → **Deploys → Trigger deploy** → Deploy site

---

## Connecting Fyers

### Daily workflow (tokens expire every day):
1. Go to https://myapi.fyers.in → Log in
2. **My Apps → API Playground** → Generate Access Token
3. In MarketLens → **Settings** → paste your App ID and Access Token
4. Click **Connect to Fyers**

### One-time setup:
1. Create an app at myapi.fyers.in
2. Note your **App ID** (format: `AB12345-100`)
3. Required permissions: `orders:read`, `positions:read`, `trades:read`

---

## AI Analysis (Optional)

For the AI Analysis feature:
1. Get an API key from https://console.anthropic.com
2. Add `ANTHROPIC_API_KEY` to Netlify environment variables
3. The feature calls `/.netlify/functions/ai` which proxies to Claude

To test locally:
```bash
npm install -g netlify-cli
netlify dev   # NOT npm run dev
```

---

## Project Structure

```
markettrak/
├── src/
│   ├── components/
│   │   ├── Layout.jsx      # Sidebar navigation
│   │   └── UI.jsx          # All UI components + SegmentToggle
│   ├── hooks/
│   │   ├── useAuth.jsx     # Supabase auth context
│   │   └── useTrades.js    # Fyers API + trade state + segment filter
│   ├── lib/
│   │   ├── data.js         # Mock data, stats computation, INR formatting
│   │   ├── supabase.js     # Supabase client + DB helpers
│   │   └── theme.js        # Deep navy colour palette
│   ├── pages/              # All 13 pages
│   ├── App.jsx             # Route/page switcher
│   └── main.jsx            # Entry point
├── netlify/functions/
│   └── ai.js               # Anthropic API proxy
├── index.html
├── netlify.toml
└── package.json
```

---

## Tech Stack

- **React 18** + **Vite 5**
- **Recharts** — all charts
- **Supabase** — auth + database (journal notes, capital flow)
- **Fyers API v3** — live trade data
- **Netlify** — hosting + serverless functions (AI proxy)
- **DM Sans** + **JetBrains Mono** — typography

---

*MarketLens is a personal trading journal. Not investment advice.*

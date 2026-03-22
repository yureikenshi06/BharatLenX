import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const signIn      = (email, password) => supabase.auth.signInWithPassword({ email, password })
export const signOut     = () => supabase.auth.signOut()
export const getSession  = () => supabase.auth.getSession()
export const onAuthChange= (cb) => supabase.auth.onAuthStateChange(cb)

// ── Trades table — stores all trades (CSV imports + daily API sync) ───────────
export async function upsertTrades(trades, userId) {
  if (!trades?.length || !userId) return { count: 0 }
  // Chunk into 500-row batches to avoid payload limits
  const CHUNK = 500
  let total = 0
  for (let i = 0; i < trades.length; i += CHUNK) {
    const chunk = trades.slice(i, i + CHUNK).map(t => ({
      id:           t.id,
      user_id:      userId,
      symbol:       t.symbol,
      segment:      t.segment,
      side:         t.side,
      qty:          t.qty,
      price:        t.price,
      pnl:          t.pnl,
      fee:          t.fee,
      equity:       t.equity,
      exchange:     t.exchange || 'NSE',
      product_type: t.productType || 'INTRADAY',
      trade_time:   new Date(t.time).toISOString(),
      source:       t.source || 'csv',
      raw_id:       t.rawId || t.id,
    }))
    const { error } = await supabase
      .from('trades')
      .upsert(chunk, { onConflict: 'id' })
    if (error) throw error
    total += chunk.length
  }
  return { count: total }
}

export async function fetchAllTrades(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('trade_time', { ascending: true })
  if (error) throw error
  // Convert back to app format
  return (data || []).map(row => ({
    id:          row.id,
    symbol:      row.symbol,
    segment:     row.segment,
    side:        row.side,
    qty:         row.qty,
    price:       row.price,
    exitPrice:   row.price,
    pnl:         row.pnl,
    fee:         row.fee,
    equity:      row.equity,
    exchange:    row.exchange,
    productType: row.product_type,
    time:        new Date(row.trade_time).getTime(),
    source:      row.source,
    rawId:       row.raw_id,
  }))
}

export async function getTradeCount(userId) {
  if (!userId) return 0
  const { count } = await supabase.from('trades').select('id', { count:'exact', head:true }).eq('user_id', userId)
  return count || 0
}

// ── Trade Notes ───────────────────────────────────────────────────────────────
export const fetchNotes = async (userId) => {
  const { data, error } = await supabase.from('trade_notes').select('*').eq('user_id', userId).order('created_at', { ascending:false })
  if (error) throw error
  return data
}
export const upsertNote = async (note) => {
  const { data, error } = await supabase.from('trade_notes').upsert(note, { onConflict:'id' }).select().single()
  if (error) throw error
  return data
}
export const deleteNote = async (id) => {
  const { error } = await supabase.from('trade_notes').delete().eq('id', id)
  if (error) throw error
}

// ── Capital Flow ──────────────────────────────────────────────────────────────
export const fetchCapitalFlow = async (userId) => {
  const { data, error } = await supabase.from('capital_flow').select('*').eq('user_id', userId).order('time', { ascending:true })
  if (error) return []
  return data
}
export const upsertCapitalFlow = async (entry, userId) => {
  const { error } = await supabase.from('capital_flow').upsert({ ...entry, user_id:userId }, { onConflict:'id' })
  if (error) throw error
}
export const deleteCapitalFlow = async (id) => {
  const { error } = await supabase.from('capital_flow').delete().eq('id', id)
  if (error) throw error
}

// ── Fyers Token ───────────────────────────────────────────────────────────────
export async function saveFyersToken(userId, clientId, token, expiresAt) {
  await supabase.from('fyers_tokens').upsert({
    user_id: userId, client_id: clientId, access_token: token,
    expires_at: new Date(expiresAt).toISOString(), updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' })
}
export async function loadFyersToken(userId) {
  const { data } = await supabase.from('fyers_tokens')
    .select('client_id,access_token,expires_at').eq('user_id', userId).single()
  if (!data) return null
  const expiresAt = new Date(data.expires_at).getTime()
  if (Date.now() > expiresAt) return null
  return { clientId: data.client_id, token: data.access_token, expiresAt }
}

/*
═══════════════════════════════════════════════════════════════════════════════
  SUPABASE SQL — run ALL of this in SQL Editor (supabase.com → SQL Editor)
═══════════════════════════════════════════════════════════════════════════════

-- 1. TRADES TABLE (stores all trades — from CSV import and daily API sync)
create table trades (
  id           text not null,
  user_id      uuid references auth.users not null,
  symbol       text,
  segment      text,
  side         text,
  qty          numeric,
  price        numeric,
  pnl          numeric default 0,
  fee          numeric default 0,
  equity       numeric default 100000,
  exchange     text,
  product_type text,
  trade_time   timestamptz,
  source       text default 'csv',
  raw_id       text,
  created_at   timestamptz default now(),
  primary key (id)
);
alter table trades enable row level security;
create policy "Users own their trades" on trades
  for all using (auth.uid() = user_id);
create index trades_user_time on trades(user_id, trade_time);

-- 2. TRADE NOTES
create table trade_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  trade_id text, date date, symbol text,
  title text, body text, mood text, tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table trade_notes enable row level security;
create policy "Users own their notes" on trade_notes
  for all using (auth.uid() = user_id);

-- 3. CAPITAL FLOW
create table capital_flow (
  id text primary key,
  user_id uuid references auth.users not null,
  type text not null, amount numeric not null,
  time bigint not null, date text, note text,
  created_at timestamptz default now()
);
alter table capital_flow enable row level security;
create policy "Users own their flow" on capital_flow
  for all using (auth.uid() = user_id);

-- 4. FYERS TOKENS (cross-device token sync)
create table fyers_tokens (
  user_id      uuid primary key references auth.users,
  client_id    text not null,
  access_token text not null,
  expires_at   timestamptz not null,
  updated_at   timestamptz default now()
);
alter table fyers_tokens enable row level security;
create policy "Users own their tokens" on fyers_tokens
  for all using (auth.uid() = user_id);

-- 5. API KEYS (optional)
create table api_keys (
  user_id uuid primary key references auth.users,
  api_key text, label text,
  created_at timestamptz default now()
);
alter table api_keys enable row level security;
create policy "Users own their keys" on api_keys
  for all using (auth.uid() = user_id);

═══════════════════════════════════════════════════════════════════════════════
*/

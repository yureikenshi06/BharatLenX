import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { generateMockTrades, computeStats, getSegment } from '../lib/data'
import {
  supabase, upsertTrades, fetchAllTrades,
  saveFyersToken, loadFyersToken,
} from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────────────
const CREDS_KEY   = 'blx_app_creds'
const TOKEN_KEY   = 'blx_fyers_token'
const LOCAL_TRADES = 'blx_trades_local'  // used when not signed in to Supabase

// ── Credentials — saved permanently, pre-filled from .env ────────────────────
export function loadCreds() {
  try { return JSON.parse(localStorage.getItem(CREDS_KEY) || 'null') } catch { return null }
}
export function saveCreds(appId, secretKey, redirectUri) {
  try { localStorage.setItem(CREDS_KEY, JSON.stringify({ appId, secretKey, redirectUri })) } catch {}
}

// ── Token — localStorage (fast) + Supabase (cross-device) ────────────────────
function saveTokenLocal(clientId, token, expiresAt) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ clientId, token, expiresAt })) } catch {}
}
function loadTokenLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
    if (!d || Date.now() > d.expiresAt) { localStorage.removeItem(TOKEN_KEY); return null }
    return d
  } catch { return null }
}
export function clearTokenLocal() { try { localStorage.removeItem(TOKEN_KEY) } catch {} }
export const loadKeys  = loadTokenLocal
export const clearKeys = clearTokenLocal

// ── Local trade store (fallback when not signed in) ───────────────────────────
function saveTradesLocal(trades) {
  try { localStorage.setItem(LOCAL_TRADES, JSON.stringify(trades.slice(-8000))) } catch {}
}
function loadTradesLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_TRADES) || '[]') } catch { return [] }
}
function mergeUnique(existing, incoming) {
  const seen = new Set(existing.map(t => t.id))
  const out  = [...existing]
  for (const t of incoming) if (!seen.has(t.id)) { seen.add(t.id); out.push(t) }
  return out.sort((a, b) => a.time - b.time)
}

// ─────────────────────────────────────────────────────────────────────────────
// FYERS API
// ─────────────────────────────────────────────────────────────────────────────
const FYERS_API = 'https://api-t1.fyers.in/api/v3'

async function fyersFetch(path, clientId, accessToken) {
  const res  = await fetch(`${FYERS_API}${path}`, {
    headers: { Authorization: `${clientId}:${accessToken}`, 'Content-Type': 'application/json' }
  })
  const data = await res.json()
  if (data.s === 'error' || (typeof data.code === 'number' && data.code < 0))
    throw new Error(data.message || `Fyers error ${data.code}`)
  return data
}

// Generate Fyers OAuth URL — matches Python SDK SessionModel.generate_authcode() exactly
// Python SDK uses api-t1.fyers.in (confirmed from the output you showed)
export function getFyersAuthUrl(appId, redirectUri) {
  const cid = appId.includes('-100') ? appId : `${appId}-100`
  return `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${cid}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=None`
}

// Exchange auth_code → access token
export async function exchangeAuthCode(appId, secretKey, authCode) {
  const cid  = appId.includes('-100') ? appId : `${appId}-100`
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${cid}:${secretKey}`)))
  ).map(b => b.toString(16).padStart(2, '0')).join('')
  const res  = await fetch(`${FYERS_API}/validate-authcode`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', appIdHash: hash, code: authCode }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.message || 'Token exchange failed')
  return { accessToken: data.access_token, clientId: cid }
}

// Format date as YYYY-MM-DD for API params
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH ALL TRADE HISTORY FROM FYERS
// Strategy: Fyers /tradebook returns today's trades.
// Fyers also has a date-range tradebook via query params — we batch in 30-day
// windows going back to the account start date (up to 2 years).
// All results are deduplicated by FYERS order ID and saved to DB.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAllFyersTrades(clientId, accessToken, onProgress) {
  const allRaw = []
  const seen   = new Set()

  const addUnique = (rows) => {
    for (const t of rows) {
      // Use FYERS order ID as dedup key
      const k = String(t.id || t.orderNumber || t.exchOrdId || JSON.stringify(t).slice(0, 60))
      if (!seen.has(k)) { seen.add(k); allRaw.push(t) }
    }
  }

  // Step 1 — Today's tradebook (most reliable, always works)
  onProgress('Fetching today\'s trades...')
  try {
    const r = await fyersFetch('/tradebook', clientId, accessToken)
    addUnique(r.tradeBook || [])
  } catch { /* continue */ }

  // Step 2 — Historical tradebook in 30-day windows going back up to 2 years
  // Fyers supports date-range via: /tradebook?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
  const today = new Date()
  const cutoff = new Date(today)
  cutoff.setFullYear(cutoff.getFullYear() - 2) // go back 2 years

  let cursor = new Date(today)
  let batch = 0

  while (cursor > cutoff) {
    const toDate   = new Date(cursor)
    const fromDate = new Date(cursor)
    fromDate.setDate(fromDate.getDate() - 29) // 30-day window
    if (fromDate < cutoff) fromDate.setTime(cutoff.getTime())

    const from = toDateStr(fromDate)
    const to   = toDateStr(toDate)
    batch++

    onProgress(`Loading history (${from} → ${to})...`)

    // Try all known Fyers date-range endpoints
    const endpoints = [
      `/tradebook?from_date=${from}&to_date=${to}`,
      `/orders/tradebook?from_date=${from}&to_date=${to}`,
      `/trade-history?from_date=${from}&to_date=${to}&offset=1&limit=500`,
    ]

    let fetched = false
    for (const ep of endpoints) {
      try {
        const r = await fyersFetch(ep, clientId, accessToken)
        const rows = r.tradeBook || r.tradeHistory || r.trades || r.data || []
        if (Array.isArray(rows)) { addUnique(rows); fetched = true; break }
      } catch { /* try next */ }
    }

    // Move cursor back
    cursor = new Date(fromDate)
    cursor.setDate(cursor.getDate() - 1)

    // Rate limit — be gentle
    await new Promise(r => setTimeout(r, 120))

    // If we got 0 records for the last 3 consecutive batches, stop early
    // (likely means account has no older history)
    if (!fetched && batch > 3) break
  }

  return allRaw
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZE a raw Fyers API trade → app format
// ─────────────────────────────────────────────────────────────────────────────
function normalizeApiTrade(t) {
  const raw = t.symbol || t.tradingSymbol || ''
  const sym = raw.replace(/^(NSE:|BSE:|NFO:|MCX:)/, '')

  let segment = 'equity'
  if (/CE$|PE$/.test(sym)) segment = 'options'
  else if (/FUT$/.test(sym)) segment = 'futures'

  // Parse time — handles "21-Mar-2025 09:15:32" and ISO
  let time = Date.now()
  const dtStr = t.orderDateTime || t.tradeDateTime || t.time || ''
  if (dtStr) {
    const m = dtStr.match(/(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
    if (m) {
      const mn = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'}
      const p  = Date.parse(`${m[3]}-${mn[m[2]]||'01'}-${m[1]}T${m[4]}:${m[5]}:${m[6]}+05:30`)
      if (!isNaN(p)) time = p
    } else {
      const p = Date.parse(dtStr)
      if (!isNaN(p)) time = p
    }
  }

  const isBuy = t.side===1 || t.side==='1' || t.side==='BUY' || t.transactionType==='BUY'
  const price = +(t.tradedPrice || t.price || t.avgPrice || 0)
  const rawId = String(t.id || t.orderNumber || t.exchangeOrderId || '').replace(/[="]/g, '').trim()

  return {
    id:          `fyers_${rawId || (sym + '_' + time + '_' + Math.random().toString(36).slice(2,5))}`,
    symbol:      sym,
    segment,
    side:        isBuy ? 'BUY' : 'SELL',
    qty:         Math.abs(+(t.tradedQty || t.qty || 0)),
    price:       +price.toFixed(2),
    exitPrice:   +price.toFixed(2),
    pnl:         +(t.pl || t.pnl || t.realizedPnl || 0).toFixed(2),
    fee:         +(Math.abs(t.brokerage||0) + Math.abs(t.charges||0) + Math.abs(t.orderTaxes||0)).toFixed(2),
    equity:      100000,
    leverage:    segment==='futures' ? 5 : segment==='options' ? 10 : 1,
    riskPercent: 1,
    time,
    exchange:    raw.startsWith('BSE:') ? 'BSE' : segment==='equity' ? 'NSE' : 'NFO',
    productType: t.productType || 'INTRADAY',
    source:      'fyers_api',
    rawId,
  }
}

// Build equity curve from sorted trades
function buildEquityCurve(trades) {
  const sorted = [...trades].sort((a, b) => a.time - b.time)
  let eq = 100000
  return sorted.map(t => { eq = +(eq + t.pnl - t.fee).toFixed(2); return { ...t, equity: eq } })
}

// Fetch live positions / account for Wallet page
export async function fetchLiveAccount(clientId, accessToken) {
  const [funds, positions] = await Promise.allSettled([
    fyersFetch('/funds', clientId, accessToken),
    fyersFetch('/positions', clientId, accessToken),
  ])
  const fl  = funds.status==='fulfilled'     ? funds.value.fund_limit     || [] : []
  const pos = positions.status==='fulfilled' ? positions.value.netPositions || [] : []
  return {
    totalWalletBalance:    +(fl.find(f => f.title==='Total Balance')?.equityAmount || 0),
    availableBalance:      +(fl.find(f => f.title==='Available Balance')?.equityAmount || 0),
    totalUnrealizedProfit: 0,
    totalMarginBalance:    +(fl.find(f => f.title==='Total Balance')?.equityAmount || 0),
    positions: pos.filter(p => parseFloat(p.netQty) !== 0).map(p => ({
      symbol:        p.symbol?.replace(/^(NSE:|NFO:)/, '') || '',
      size:          parseFloat(p.netQty),
      entryPrice:    parseFloat(p.netAvg),
      unrealizedPnl: parseFloat(p.unrealised),
      side:          parseFloat(p.netQty) > 0 ? 'LONG' : 'SHORT',
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useTrades() {
  const [allTrades,      setAllTrades]      = useState([])
  const [trades,         setTrades]         = useState([])
  const [segment,        setSegState]       = useState('all')
  const [dateRange,      setDateRange]      = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [syncing,        setSyncing]        = useState(false)  // background sync indicator
  const [connected,      setConnected]      = useState(false)
  const [source,         setSource]         = useState('demo')
  const [error,          setError]          = useState('')
  const [progress,       setProgress]       = useState('')
  const [tokenInfo,      setTokenInfo]      = useState(null)
  const [fyersConnected, setFyersConnected] = useState(false)
  const [syncStatus,     setSyncStatus]     = useState(null) // { lastSync, count, newToday }
  const initDone = useRef(false)
  const syncTimer = useRef(null)

  // ── Apply trades to display state ─────────────────────────────────────────
  const applyTrades = useCallback((t, src = 'fyers') => {
    const withCurve = t?.length ? buildEquityCurve(t) : []
    setAllTrades(withCurve)
    setConnected(true)
    setSource(src)
  }, [])

  // ── On mount: load saved trades instantly, then sync in background ─────────
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    boot()
    return () => { if (syncTimer.current) clearInterval(syncTimer.current) }
  }, []) // eslint-disable-line

  const boot = async () => {
    setLoading(true)

    // 1. Get Supabase user
    const { data: authData } = await supabase.auth.getUser()
    const uid = authData?.user?.id || null

    // 2. Find saved token first — if we have one, NEVER show demo data
    let token = loadTokenLocal()
    if (!token && uid) {
      try { token = await loadFyersToken(uid) } catch {}
      if (token) saveTokenLocal(token.clientId, token.token, token.expiresAt)
    }

    const hasSavedToken = !!token?.token

    // 3. Show saved trades immediately (fast path — shows while sync runs)
    if (hasSavedToken) {
      // Token exists → load from DB/local, but DO NOT fall back to demo
      if (uid) {
        try {
          const dbTrades = await fetchAllTrades(uid)
          if (dbTrades.length) {
            applyTrades(dbTrades, 'fyers')
          }
          // If 0 trades from DB, stay on empty loading screen until sync completes
        } catch { /* fall through to sync */ }
      } else {
        const local = loadTradesLocal()
        if (local.length) applyTrades(local, 'fyers')
      }
      setTokenInfo(token)
      setFyersConnected(true)
      // Full sync in background
      syncAllTrades(token.clientId, token.token, uid, false)
      scheduleAutoRefresh(token, uid)
    } else {
      // No token at all → show demo
      const mock = generateMockTrades(200)
      applyTrades(mock, 'demo')
      setLoading(false)
    }
  }

  // ── Handle OAuth redirect (?auth_code=... comes back from Fyers) ──────────
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const authCode = params.get('auth_code') || params.get('code')
    if (!authCode) return
    const creds = loadCreds()
    if (!creds?.appId || !creds?.secretKey) {
      setError('App credentials not found. Enter your App ID and Secret Key first.')
      return
    }
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname)
    setLoading(true); setProgress('Exchanging auth code for token...')

    exchangeAuthCode(creds.appId, creds.secretKey, authCode).then(async ({ accessToken, clientId }) => {
      const expiresAt = Date.now() + 23.5 * 60 * 60 * 1000
      saveTokenLocal(clientId, accessToken, expiresAt)
      const tok = { clientId, token: accessToken, expiresAt }
      setTokenInfo(tok)
      setFyersConnected(true)

      const { data: authData } = await supabase.auth.getUser()
      const uid = authData?.user?.id || null
      if (uid) saveFyersToken(uid, clientId, accessToken, expiresAt)

      await syncAllTrades(clientId, accessToken, uid, false)
      scheduleAutoRefresh(tok, uid)
    }).catch(err => {
      setError(`Login failed: ${err.message}`)
      setLoading(false); setProgress('')
    })
  }, []) // eslint-disable-line

  // ── Schedule auto-refresh every 5 min until token expires ─────────────────
  const scheduleAutoRefresh = (token, uid) => {
    if (syncTimer.current) clearInterval(syncTimer.current)
    if (!token?.token || Date.now() >= token.expiresAt) return

    syncTimer.current = setInterval(() => {
      const current = loadTokenLocal()
      if (!current?.token || Date.now() >= current.expiresAt) {
        clearInterval(syncTimer.current)
        setFyersConnected(false)
        setError('Token expired — please reconnect in Settings.')
        return
      }
      syncAllTrades(current.clientId, current.token, uid, true) // silent background sync
    }, 5 * 60 * 1000) // every 5 minutes
  }

  // ── Core sync: fetch ALL history, save to DB, update display ──────────────
  const syncAllTrades = async (clientId, accessToken, uid, silent) => {
    if (!silent) { setLoading(true); setError('') }
    setSyncing(true)
    const startCount = allTrades.length

    try {
      setProgress('Connecting to Fyers...')
      await fyersFetch('/profile', clientId, accessToken) // validate token
      setFyersConnected(true)

      // Fetch full history
      const rawTrades = await fetchAllFyersTrades(clientId, accessToken, setProgress)

      setProgress(`Processing ${rawTrades.length} trades...`)
      const normalized = rawTrades.map(t => normalizeApiTrade(t))

      // Save to Supabase or localStorage
      if (uid) {
        await upsertTrades(normalized, uid)
        const all = await fetchAllTrades(uid)
        applyTrades(all, 'fyers')
        setSyncStatus({
          lastSync: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          count:    all.length,
          newToday: normalized.filter(t => {
            const d = new Date(t.time)
            const today = new Date()
            return d.getDate()===today.getDate() && d.getMonth()===today.getMonth() && d.getFullYear()===today.getFullYear()
          }).length,
        })
      } else {
        const existing = loadTradesLocal()
        const merged   = mergeUnique(existing, normalized)
        saveTradesLocal(merged)
        applyTrades(merged, 'fyers')
        setSyncStatus({
          lastSync: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          count:    merged.length,
          newToday: 0,
        })
      }

      setProgress(''); setError('')
    } catch (err) {
      const isExpired = /token|expired|401|invalid|-16|-2003/i.test(err.message)
      if (isExpired) {
        clearTokenLocal(); setTokenInfo(null); setFyersConnected(false)
        setError('Token expired — reconnect in Settings.')
        if (syncTimer.current) clearInterval(syncTimer.current)
        // Only show demo after token expires and no saved trades
        if (!allTrades.length || source === 'demo') {
          applyTrades(generateMockTrades(200), 'demo')
        }
      } else if (!silent) {
        setError(`Sync failed: ${err.message}`)
      }
      setProgress('')
    }

    setSyncing(false)
    setLoading(false)
  }

  // ── Manual sync trigger (Settings button) ─────────────────────────────────
  const manualSync = async () => {
    const tok = loadTokenLocal()
    if (!tok?.token) { setError('No active token — connect Fyers first.'); return }
    const { data: authData } = await supabase.auth.getUser()
    const uid = authData?.user?.id || null
    await syncAllTrades(tok.clientId, tok.token, uid, false)
  }

  // ── Re-filter when segment / dateRange changes ─────────────────────────────
  useEffect(() => {
    if (!allTrades.length) return
    let f = allTrades
    if (segment !== 'all') f = f.filter(t => getSegment(t) === segment)
    if (dateRange) f = f.filter(t => t.time >= dateRange.start && t.time <= dateRange.end)
    setTrades(f)
  }, [segment, dateRange, allTrades])

  // ── Stats — safe, never crashes on empty ──────────────────────────────────
  const stats = useMemo(() => {
    const safe = (arr) => {
      try { return arr?.length ? computeStats(arr) : {} } catch { return {} }
    }
    return {
      all:     safe(allTrades),
      equity:  safe(allTrades.filter(t => getSegment(t) === 'equity')),
      options: safe(allTrades.filter(t => getSegment(t) === 'options')),
      futures: safe(allTrades.filter(t => getSegment(t) === 'futures')),
    }
  }, [allTrades])

  const activeStats = stats[segment] || stats.all || {}

  // ── Connect: save creds + return OAuth URL ────────────────────────────────
  const connectFyers = async (appId, secretKey, redirectUri) => {
    if (!appId?.trim() || !secretKey?.trim()) { setError('Enter App ID and Secret Key'); return { error: true } }
    saveCreds(appId.trim(), secretKey.trim(), (redirectUri||'').trim() || window.location.origin)
    return { redirectUrl: getFyersAuthUrl(appId.trim(), (redirectUri||'').trim() || window.location.origin) }
  }

  // ── Paste token directly ──────────────────────────────────────────────────
  const pasteToken = async (clientId, accessToken) => {
    if (!clientId?.trim() || !accessToken?.trim()) { setError('Enter Client ID and Token'); return { error: true } }
    setLoading(true); setError(''); setProgress('Validating token...')
    const expiresAt = Date.now() + 23.5 * 60 * 60 * 1000
    const cid = clientId.trim()
    const tok = accessToken.trim()
    saveTokenLocal(cid, tok, expiresAt)
    setTokenInfo({ clientId: cid, token: tok, expiresAt })
    setFyersConnected(true)
    const { data: authData } = await supabase.auth.getUser()
    const uid = authData?.user?.id || null
    if (uid) saveFyersToken(uid, cid, tok, expiresAt)
    const fullTok = { clientId: cid, token: tok, expiresAt }
    await syncAllTrades(cid, tok, uid, false)
    scheduleAutoRefresh(fullTok, uid)
    return { success: true }
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnectFyers = () => {
    clearTokenLocal(); setTokenInfo(null); setFyersConnected(false); setError('')
    if (syncTimer.current) clearInterval(syncTimer.current)
    // Show demo
    const mock = generateMockTrades(200)
    setAllTrades(mock); setConnected(true); setSource('demo')
    setDateRange(null)
  }

  const applyDateRange = (s, e) => setDateRange(s && e ? { start: s, end: e } : null)
  const setSegment     = (seg)  => setSegState(seg)

  return {
    trades, allTrades, stats, activeStats, loading, syncing, connected, source,
    error, progress, dateRange, tokenInfo, segment, fyersConnected, syncStatus,
    setSegment, connectFyers, pasteToken, manualSync, applyDateRange, disconnectFyers,
  }
}

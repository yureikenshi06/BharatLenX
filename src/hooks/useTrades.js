import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { generateMockTrades, computeStats, getSegment } from '../lib/data'
import {
  supabase, upsertTrades, fetchAllTrades, getTradeCount,
  saveFyersToken, loadFyersToken, upsertCapitalFlow, fetchCapitalFlow,
} from '../lib/supabase'
import { parseFyersFile } from '../lib/csvImport'

// ── Permanent localStorage keys ───────────────────────────────────────────────
const CREDS_KEY       = 'blx_app_creds'
const TOKEN_KEY       = 'blx_fyers_token'
const LOCAL_TRADES    = 'blx_trades_local'   // fallback when not signed in
const LOCAL_PNL_MAP   = 'blx_pnl_map'        // symbol → realised pnl from Global PnL CSV

export function loadCreds() {
  try { return JSON.parse(localStorage.getItem(CREDS_KEY) || 'null') } catch { return null }
}
export function saveCreds(appId, secretKey, redirectUri) {
  try { localStorage.setItem(CREDS_KEY, JSON.stringify({ appId, secretKey, redirectUri })) } catch {}
}

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

// Local trade cache (used when user is NOT signed in to Supabase)
function saveTradesLocal(trades) {
  try { localStorage.setItem(LOCAL_TRADES, JSON.stringify(trades.slice(-5000))) } catch {}
}
function loadTradesLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_TRADES) || '[]') } catch { return [] }
}
function mergeLocal(existing, incoming) {
  const seen = new Set(existing.map(t => t.id))
  const out  = [...existing]
  for (const t of incoming) if (!seen.has(t.id)) { seen.add(t.id); out.push(t) }
  return out.sort((a,b) => a.time - b.time)
}

// ── Fyers API ─────────────────────────────────────────────────────────────────
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

export function getFyersAuthUrl(appId, redirectUri) {
  const cid = appId.includes('-100') ? appId : `${appId}-100`
  return `https://api-t2.fyers.in/api/v3/generate-authcode?client_id=${cid}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=bharatlenx`
}

export async function exchangeAuthCode(appId, secretKey, authCode) {
  const cid = appId.includes('-100') ? appId : `${appId}-100`
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${cid}:${secretKey}`)))).map(b=>b.toString(16).padStart(2,'0')).join('')
  const res  = await fetch(`${FYERS_API}/validate-authcode`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ grant_type:'authorization_code', appIdHash:hash, code:authCode }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.message || 'Token exchange failed')
  return { accessToken: data.access_token, clientId: cid }
}

// Normalize today's API tradebook row
function normApiTrade(t) {
  const sym = (t.symbol||t.tradingSymbol||'').replace(/^(NSE:|BSE:|NFO:|MCX:)/,'')
  let seg = 'equity'
  if (/CE$|PE$/.test(sym)) seg = 'options'
  else if (/FUT$/.test(sym)) seg = 'futures'
  let time = Date.now()
  const dt = t.orderDateTime || t.tradeDateTime || ''
  if (dt) {
    const m = dt.match(/(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
    if (m) {
      const mon = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'}
      const p = Date.parse(`${m[3]}-${mon[m[2]]||'01'}-${m[1]}T${m[4]}:${m[5]}:${m[6]}+05:30`)
      if (!isNaN(p)) time = p
    } else { const p = Date.parse(dt); if (!isNaN(p)) time = p }
  }
  const isBuy = t.side===1||t.side==='BUY'||t.transactionType==='BUY'
  const id    = String(t.id||t.orderNumber||t.exchangeOrderId||'').replace(/[="]/g,'').trim()
  return {
    id:          `api_${id||sym+'_'+time}`,
    symbol:      sym, segment:seg,
    side:        isBuy?'BUY':'SELL',
    qty:         Math.abs(+(t.tradedQty||t.qty||0)),
    price:       +(t.tradedPrice||t.price||0).toFixed(2),
    exitPrice:   +(t.tradedPrice||t.price||0).toFixed(2),
    pnl:         +(t.pl||t.pnl||0).toFixed(2),
    fee:         +(Math.abs(t.brokerage||0)+Math.abs(t.charges||0)+Math.abs(t.orderTaxes||0)).toFixed(2),
    equity:      100000, leverage:seg==='futures'?5:seg==='options'?10:1, riskPercent:1,
    time, exchange:seg==='equity'?'NSE':'NFO',
    productType: t.productType||'INTRADAY', source:'fyers_api', rawId:id,
  }
}

function buildEquityCurve(trades) {
  const sorted = [...trades].sort((a,b)=>a.time-b.time)
  let eq = 100000
  return sorted.map(t=>{ eq=+(eq+t.pnl-t.fee).toFixed(2); return {...t,equity:eq} })
}

export async function fetchLiveAccount(clientId, accessToken) {
  const [funds,positions] = await Promise.allSettled([
    fyersFetch('/funds',     clientId, accessToken),
    fyersFetch('/positions', clientId, accessToken),
  ])
  const fl  = funds.status==='fulfilled'     ? funds.value.fund_limit||[]     : []
  const pos = positions.status==='fulfilled' ? positions.value.netPositions||[] : []
  return {
    totalWalletBalance:    +(fl.find(f=>f.title==='Total Balance')?.equityAmount||0),
    availableBalance:      +(fl.find(f=>f.title==='Available Balance')?.equityAmount||0),
    totalUnrealizedProfit: 0,
    totalMarginBalance:    +(fl.find(f=>f.title==='Total Balance')?.equityAmount||0),
    positions: pos.filter(p=>parseFloat(p.netQty)!==0).map(p=>({
      symbol:p.symbol?.replace(/^(NSE:|NFO:)/,'')||'',
      size:parseFloat(p.netQty), entryPrice:parseFloat(p.netAvg),
      unrealizedPnl:parseFloat(p.unrealised),
      side:parseFloat(p.netQty)>0?'LONG':'SHORT',
    })),
  }
}

// ── MAIN HOOK ─────────────────────────────────────────────────────────────────
export function useTrades() {
  const [allTrades,      setAllTrades]      = useState([])
  const [trades,         setTrades]         = useState([])
  const [segment,        setSegState]       = useState('all')
  const [dateRange,      setDateRange]      = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [connected,      setConnected]      = useState(false)
  const [source,         setSource]         = useState('demo')
  const [error,          setError]          = useState('')
  const [progress,       setProgress]       = useState('')
  const [tokenInfo,      setTokenInfo]      = useState(null)
  const [fyersConnected, setFyersConnected] = useState(null)
  const [userId,         setUserId]         = useState(null)
  const [csvImporting,   setCsvImporting]   = useState(false)
  const [csvResult,      setCsvResult]      = useState(null)
  const [rawApiSample,   setRawApiSample]   = useState(null)
  const [globalPnL,      setGlobalPnL]      = useState(null)  // from Global PnL CSV
  const initDone = useRef(false)

  // ── Apply trades to state ──────────────────────────────────────────────────
  const applyTrades = useCallback((t, src='fyers') => {
    if (!t?.length) {
      setAllTrades([]); setTrades([]); setConnected(true); setSource(src)
      return
    }
    const withCurve = buildEquityCurve(t)
    setAllTrades(withCurve); setTrades(withCurve)
    setConnected(true); setSource(src)
  }, [])

  // ── Mount: get auth state, then load trades ───────────────────────────────
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data?.user?.id || null
      setUserId(uid)
      await init(uid)
    })
  }, []) // eslint-disable-line

  const init = async (uid) => {
    setLoading(true)
    let loadedCount = 0

    // 1. Try loading from DB (signed in)
    if (uid) {
      try {
        setProgress('Loading trades from database...')
        const dbTrades = await fetchAllTrades(uid)
        if (dbTrades.length) {
          applyTrades(dbTrades, 'fyers')
          loadedCount = dbTrades.length
        }
      } catch (e) { console.warn('DB load:', e.message) }
    }

    // 2. Try loading from localStorage (not signed in, or as fallback)
    if (!loadedCount) {
      const local = loadTradesLocal()
      if (local.length) {
        applyTrades(local, 'fyers')
        loadedCount = local.length
      }
    }

    // 3. Token check → sync today's API trades
    let token = loadTokenLocal()
    if (!token && uid) {
      try { token = await loadFyersToken(uid) } catch {}
      if (token) saveTokenLocal(token.clientId, token.token, token.expiresAt)
    }

    if (token?.token) {
      setTokenInfo(token)
      await syncApiTrades(token.clientId, token.token, uid, true)
    } else if (!loadedCount) {
      // No token, no saved trades → demo
      const mock = generateMockTrades(200)
      applyTrades(mock, 'demo')
    }

    setLoading(false); setProgress('')
  }

  // ── OAuth redirect handler ─────────────────────────────────────────────────
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const authCode = params.get('auth_code') || params.get('code')
    if (!authCode) return
    const creds = loadCreds()
    if (!creds?.appId || !creds?.secretKey) return
    window.history.replaceState({}, '', window.location.pathname)
    setLoading(true); setProgress('Exchanging auth code...')
    exchangeAuthCode(creds.appId, creds.secretKey, authCode).then(async ({ accessToken, clientId }) => {
      const expiresAt = Date.now() + 23.5 * 60 * 60 * 1000
      saveTokenLocal(clientId, accessToken, expiresAt)
      setTokenInfo({ clientId, token: accessToken, expiresAt })
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id
      if (uid) saveFyersToken(uid, clientId, accessToken, expiresAt)
      await syncApiTrades(clientId, accessToken, uid, false)
      setLoading(false)
    }).catch(err => {
      setError(`Token exchange failed: ${err.message}`)
      setLoading(false); setProgress('')
    })
  }, []) // eslint-disable-line

  // ── Segment/dateRange filter ───────────────────────────────────────────────
  useEffect(() => {
    if (!allTrades.length) return
    let f = allTrades
    if (segment !== 'all') f = f.filter(t => getSegment(t) === segment)
    if (dateRange) f = f.filter(t => t.time >= dateRange.start && t.time <= dateRange.end)
    setTrades(f)
  }, [segment, dateRange, allTrades])

  // ── Stats — safe, handles empty arrays ───────────────────────────────────
  const stats = useMemo(() => {
    const safe = (arr) => {
      try { return arr.length ? computeStats(arr) : {} } catch { return {} }
    }
    return {
      all:     safe(allTrades),
      equity:  safe(allTrades.filter(t => getSegment(t) === 'equity')),
      options: safe(allTrades.filter(t => getSegment(t) === 'options')),
      futures: safe(allTrades.filter(t => getSegment(t) === 'futures')),
    }
  }, [allTrades])

  const activeStats = stats[segment] || stats.all || {}

  // ── Sync today's Fyers API trades → Supabase / local ─────────────────────
  const syncApiTrades = async (clientId, accessToken, uid, silent) => {
    if (!silent) setProgress('Syncing today\'s trades...')
    try {
      await fyersFetch('/profile', clientId, accessToken)
      setFyersConnected(true)

      const tbResp = await fyersFetch('/tradebook', clientId, accessToken)
      const raw    = tbResp.tradeBook || []
      setRawApiSample(raw.slice(0,2))

      if (raw.length) {
        const newTrades = raw.map(t => normApiTrade(t))
        if (uid) {
          await upsertTrades(newTrades, uid)
          const all = await fetchAllTrades(uid)
          applyTrades(all, 'fyers')
        } else {
          const existing = loadTradesLocal()
          const merged   = mergeLocal(existing, newTrades)
          saveTradesLocal(merged)
          applyTrades(merged, 'fyers')
        }
      }
      setProgress('')
    } catch (err) {
      if (/token|expired|401|invalid|-16|-2003/i.test(err.message)) {
        clearTokenLocal(); setTokenInfo(null)
        if (!silent) setError('Token expired — reconnect in Settings.')
      }
      setFyersConnected(null); setProgress('')
    }
  }

  // ── Import any Fyers CSV file ─────────────────────────────────────────────
  const importCSV = useCallback(async (file) => {
    setCsvImporting(true); setCsvResult(null); setError('')
    try {
      const text     = await file.text()
      setProgress(`Detecting file type: ${file.name}`)
      const parsed   = parseFyersFile(text, file.name)

      // ── Tradebook / Orderbook → save trades ──────────────────────────────
      if (parsed.type === 'tradebook' || parsed.type === 'orderbook') {
        if (!parsed.trades?.length) { setError('No executed trades found.'); setCsvImporting(false); return }
        setProgress(`Saving ${parsed.trades.length} trades...`)

        const { data } = await supabase.auth.getUser()
        const uid = data?.user?.id

        if (uid) {
          await upsertTrades(parsed.trades, uid)
          setProgress('Reloading from database...')
          const all = await fetchAllTrades(uid)
          applyTrades(all, 'fyers')
        } else {
          // Save to localStorage when not signed in
          const existing = loadTradesLocal()
          const merged   = mergeLocal(existing, parsed.trades)
          saveTradesLocal(merged)
          applyTrades(merged, 'fyers')
        }

        const fromTime = Math.min(...parsed.trades.map(t=>t.time))
        const toTime   = Math.max(...parsed.trades.map(t=>t.time))
        setCsvResult({
          fileType:  parsed.type === 'tradebook' ? 'Tradebook' : 'Orderbook',
          imported:  parsed.trades.length,
          symbols:   [...new Set(parsed.trades.map(t=>t.symbol))].length,
          from:      new Date(fromTime).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
          to:        new Date(toTime).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
          savedTo:   uid ? 'Supabase database ✓' : 'Local storage (sign in to sync across devices)',
          note:      'P&L calculated using FIFO matching of BUY/SELL pairs',
        })

      // ── Global PnL → store as reference, update trade P&Ls ───────────────
      } else if (parsed.type === 'global_pnl') {
        setGlobalPnL(parsed)
        // Build pnl map and store
        const pnlMap = {}
        for (const inst of parsed.instruments) pnlMap[inst.name] = inst.pnl
        localStorage.setItem(LOCAL_PNL_MAP, JSON.stringify(pnlMap))
        setCsvResult({
          fileType: 'Global P&L Report',
          imported:  parsed.instruments.length,
          symbols:   parsed.instruments.length,
          note:      `Net P&L: ₹${parsed.summary.netPnL.toLocaleString('en-IN')} | Gross: ₹${parsed.summary.grossPnL.toLocaleString('en-IN')} | Charges: ₹${parsed.summary.totalCharges.toLocaleString('en-IN')}`,
          from: '', to: '',
          savedTo: 'Loaded as P&L reference',
        })

      // ── Ledger → save as capital flow ─────────────────────────────────────
      } else if (parsed.type === 'ledger') {
        const { data } = await supabase.auth.getUser()
        const uid = data?.user?.id
        if (uid && parsed.transactions.length) {
          for (const t of parsed.transactions) {
            try { await upsertCapitalFlow(t, uid) } catch {}
          }
        }
        setCsvResult({
          fileType: 'Ledger Report',
          imported:  parsed.transactions.length,
          symbols:   0,
          note:      `Funds Added: ₹${parsed.summary.fundsAdded.toLocaleString('en-IN')} | Withdrawn: ₹${parsed.summary.fundsWithdrawn.toLocaleString('en-IN')}`,
          from: '', to: '',
          savedTo: uid ? 'Capital flow saved to Supabase ✓' : 'Loaded (sign in to persist)',
        })
      }

      setProgress('')
    } catch (e) {
      setError(`Import failed: ${e.message}`)
    }
    setCsvImporting(false)
  }, [applyTrades])

  // ── Connect Fyers (generate OAuth URL) ───────────────────────────────────
  const connectFyers = async (appId, secretKey, redirectUri) => {
    if (!appId?.trim()||!secretKey?.trim()) { setError('Enter App ID and Secret Key'); return {error:true} }
    saveCreds(appId.trim(), secretKey.trim(), redirectUri.trim()||window.location.origin)
    return { redirectUrl: getFyersAuthUrl(appId.trim(), redirectUri.trim()||window.location.origin) }
  }

  // ── Paste token manually ──────────────────────────────────────────────────
  const pasteToken = async (clientId, accessToken) => {
    if (!clientId?.trim()||!accessToken?.trim()) { setError('Enter Client ID and Access Token'); return {error:true} }
    setLoading(true); setError(''); setProgress('Validating...')
    const expiresAt = Date.now() + 23.5 * 60 * 60 * 1000
    saveTokenLocal(clientId.trim(), accessToken.trim(), expiresAt)
    setTokenInfo({ clientId:clientId.trim(), token:accessToken.trim(), expiresAt })
    const { data } = await supabase.auth.getUser()
    const uid = data?.user?.id
    if (uid) saveFyersToken(uid, clientId.trim(), accessToken.trim(), expiresAt)
    await syncApiTrades(clientId.trim(), accessToken.trim(), uid, false)
    setLoading(false)
    return { success: true }
  }

  const loadDemo = () => {
    clearTokenLocal(); setTokenInfo(null); setFyersConnected(null); setCsvResult(null); setError('')
    setTimeout(() => {
      applyTrades(generateMockTrades(200), 'demo')
      setDateRange(null); setLoading(false); setProgress('')
    }, 200)
  }
  const disconnectFyers = () => { clearTokenLocal(); setTokenInfo(null); setFyersConnected(null); loadDemo() }
  const applyDateRange  = (s,e) => setDateRange(s&&e?{start:s,end:e}:null)
  const setSegment      = (seg) => setSegState(seg)

  return {
    trades, allTrades, stats, activeStats, loading, connected, source,
    error, progress, dateRange, tokenInfo, segment, fyersConnected,
    csvImporting, csvResult, rawApiSample, globalPnL, userId,
    setSegment, loadDemo, connectFyers, pasteToken, importCSV, applyDateRange, disconnectFyers,
  }
}

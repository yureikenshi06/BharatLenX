import { useState, useEffect, useMemo } from 'react'
import { generateMockTrades, computeStats, computeSegmentStats, getSegment } from '../lib/data'

const STORAGE_KEY = 'ml_fyers_keys'
export const saveKeys  = (clientId, token) => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({clientId,token})) } catch {} }
export const loadKeys  = ()                => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null') } catch { return null } }
export const clearKeys = ()                => { try { sessionStorage.removeItem(STORAGE_KEY) } catch {} }

const FYERS_API = 'https://api-t1.fyers.in/api/v3'

async function fyersFetch(path, clientId, accessToken) {
  const res  = await fetch(`${FYERS_API}${path}`, {
    headers: { 'Authorization':`${clientId}:${accessToken}`, 'Content-Type':'application/json' }
  })
  const data = await res.json()
  if (data.s==='error'||data.code<0) throw new Error(data.message||`Fyers error: ${data.code}`)
  return data
}

function normalizeFyersTrade(t) {
  const sym  = (t.symbol||'').replace(/^(NSE:|BSE:|NFO:)/,'')
  let segment = 'equity'
  if (sym.endsWith('CE')||sym.endsWith('PE')) segment = 'options'
  else if (sym.endsWith('FUT')) segment = 'futures'
  const side = t.side===1||t.side==='BUY' ? 'BUY' : 'SELL'
  const qty  = Math.abs(t.qty||0)
  const price= t.tradedPrice||t.price||0
  return {
    id: String(t.id||t.orderNumber||Math.random()),
    symbol:sym, segment, side, qty,
    price:+price.toFixed(2), exitPrice:+price.toFixed(2),
    fee:+(Math.abs(t.brokerage||0)+Math.abs(t.charges||0)).toFixed(2),
    pnl:+(t.pl||0).toFixed(2),
    equity:10000,
    leverage: segment==='futures'?5:segment==='options'?10:1,
    riskPercent: 1,
    time: t.orderDateTime ? new Date(t.orderDateTime).getTime() : Date.now(),
    exchange: t.exchange||(segment==='equity'?'NSE':'NFO'),
    productType: t.productType||'INTRADAY',
    source:'fyers',
  }
}

// Live account data for Wallet page
export async function fetchLiveAccount(clientId, accessToken) {
  const profile = await fyersFetch('/profile', clientId, accessToken)
  const funds   = await fyersFetch('/funds', clientId, accessToken)
  const positions= await fyersFetch('/positions', clientId, accessToken)
  const fundData = funds.fund_limit||[]
  const equity   = fundData.find(f=>f.title==='Total Balance')?.equityAmount||0
  const available= fundData.find(f=>f.title==='Available Balance')?.equityAmount||0
  return {
    totalWalletBalance:    +equity,
    availableBalance:      +available,
    totalUnrealizedProfit: 0,
    totalMarginBalance:    +equity,
    positions: (positions.netPositions||[]).filter(p=>parseFloat(p.netQty)!==0).map(p=>({
      symbol:    p.symbol?.replace(/^(NSE:|NFO:)/,''),
      size:      parseFloat(p.netQty),
      entryPrice:parseFloat(p.netAvg),
      unrealizedPnl: parseFloat(p.unrealised),
      side:      parseFloat(p.netQty)>0?'LONG':'SHORT',
    })),
  }
}

export function useTrades() {
  const [allTrades, setAllTrades] = useState([])
  const [trades,    setTrades]    = useState([])
  const [segment,   setSegmentState] = useState('all')
  const [dateRange, setDateRange] = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [connected, setConnected] = useState(false)
  const [source,    setSource]    = useState('demo')
  const [error,     setError]     = useState('')
  const [progress,  setProgress]  = useState('')
  const [savedKeys, setSavedKeys] = useState(loadKeys)

  useEffect(()=>{
    const mock = generateMockTrades(200)
    setAllTrades(mock); setTrades(mock)
    setConnected(true); setSource('demo')
    const keys = loadKeys()
    if (keys?.clientId&&keys?.token) connectFyers(keys.clientId,keys.token,true)
  },[]) // eslint-disable-line

  // Refilter when segment or dateRange changes
  useEffect(()=>{
    if (!allTrades.length) return
    let filtered = allTrades
    if (segment!=='all') filtered = filtered.filter(t=>getSegment(t)===segment)
    if (dateRange) filtered = filtered.filter(t=>t.time>=dateRange.start&&t.time<=dateRange.end)
    setTrades(filtered)
  },[segment,dateRange,allTrades])

  // Compute stats for all 4 views
  const stats = useMemo(()=>({
    all:     computeStats(allTrades),
    equity:  computeStats(allTrades.filter(t=>getSegment(t)==='equity')),
    options: computeStats(allTrades.filter(t=>getSegment(t)==='options')),
    futures: computeStats(allTrades.filter(t=>getSegment(t)==='futures')),
  }),[allTrades])

  const activeStats = stats[segment]||stats.all

  const loadDemo = () => {
    setLoading(true); setError(''); clearKeys(); setSavedKeys(null)
    setTimeout(()=>{
      const mock=generateMockTrades(200)
      setAllTrades(mock); setTrades(mock)
      setConnected(true); setSource('demo')
      setLoading(false); setProgress(''); setDateRange(null)
    },500)
  }

  const connectFyers = async (clientId, accessToken, silent=false) => {
    if (!clientId?.trim()||!accessToken?.trim()) { setError('Enter Client ID and Access Token'); return {error:true} }
    const cid=clientId.trim(), tok=accessToken.trim()
    if (!silent) { setLoading(true); setError('') }
    setProgress('Connecting to Fyers...')
    try {
      const profile = await fyersFetch('/profile', cid, tok)
      setProgress(`✓ Connected as ${profile.data?.name||cid} · Fetching trades...`)
      saveKeys(cid,tok); setSavedKeys({clientId:cid,token:tok})

      const tradeBook = await fyersFetch('/tradebook', cid, tok)
      const rawTrades = tradeBook.tradeBook||[]
      if (!rawTrades.length) {
        if(!silent) setError('No trades found. Make sure you have trades today.')
        if(!silent) loadDemo()
        setProgress(''); setLoading(false)
        return {demo:true}
      }
      rawTrades.sort((a,b)=>(a.orderDateTime?new Date(a.orderDateTime).getTime():0)-(b.orderDateTime?new Date(b.orderDateTime).getTime():0))
      let eq=100000
      const final=rawTrades.map(t=>{const n=normalizeFyersTrade(t);eq=+(eq+n.pnl-n.fee).toFixed(2);return{...n,equity:eq}})
      setAllTrades(final); setTrades(final)
      setConnected(true); setSource('fyers')
      setLoading(false); setProgress(''); setDateRange(null)
      return {success:true,count:final.length}
    } catch(err) {
      const msg = err.message.includes('401')||err.message.includes('token')
        ? 'Invalid token — regenerate your Fyers access token in myapi.fyers.in'
        : `Fyers error: ${err.message}`
      if(!silent){setError(msg);loadDemo()}
      setLoading(false); setProgress('')
      return {demo:true}
    }
  }

  const disconnectFyers = () => { clearKeys(); setSavedKeys(null); loadDemo() }
  const applyDateRange  = (start,end) => setDateRange(start&&end?{start,end}:null)
  const setSegment      = (seg) => setSegmentState(seg)

  return {
    trades, allTrades, stats, activeStats, loading, connected, source,
    error, progress, dateRange, savedKeys, segment,
    setSegment, loadDemo, connectFyers, applyDateRange, disconnectFyers,
  }
}

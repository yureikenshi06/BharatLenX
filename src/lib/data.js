// ── Indian Market Data Utilities ─────────────────────────────────────────────

export const NSE_EQUITY = [
  'RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK','SBIN','BAJFINANCE',
  'BHARTIARTL','WIPRO','HCLTECH','LT','AXISBANK','KOTAKBANK','ITC',
  'HINDUNILVR','ASIANPAINT','SUNPHARMA','DRREDDY','DIVISLAB','CIPLA',
  'TATAMOTORS','MARUTI','BAJAJ-AUTO','HEROMOTOCO','M&M','EICHERMOT',
  'TATASTEEL','JSWSTEEL','HINDALCO','SAIL','VEDL',
  'POWERGRID','NTPC','ONGC','BPCL','IOC','GAIL',
  'ADANIENT','ADANIPORTS','ADANIGREEN',
  'ZOMATO','NYKAA','PAYTM','DELHIVERY',
  'ULTRACEMCO','GRASIM','SHREECEM','ACC',
]

export const NSE_FNO = ['NIFTY','BANKNIFTY','FINNIFTY','MIDCPNIFTY','SENSEX']

export const LOT_SIZES = {
  NIFTY:75, BANKNIFTY:30, FINNIFTY:65, MIDCPNIFTY:75, SENSEX:20,
  RELIANCE:250, TCS:150, INFY:300, HDFCBANK:550, ICICIBANK:700,
  SBIN:1500, BAJFINANCE:125, BHARTIARTL:1851, WIPRO:1500,
  HCLTECH:700, LT:300, AXISBANK:1200, KOTAKBANK:400,
  TATAMOTORS:1425, MARUTI:100, BAJAJ_AUTO:250, TATASTEEL:5775,
  HINDALCO:2150, ONGC:1925, BPCL:1800, IOC:3750,
}

export function getLotSize(sym) {
  const base = sym.replace(/\d{2}[A-Z]{3}\d{2,4}(CE|PE|FUT)/,'').replace(/-/g,'_')
  return LOT_SIZES[base] || LOT_SIZES[sym] || 1
}

export function isOption(sym)  { return /CE$|PE$/.test(sym || '') }
export function isFutures(sym) { return /FUT$/.test(sym || '') }
export function getSegment(trade) {
  if (trade.segment) return trade.segment
  const sym = trade.symbol || ''
  if (isOption(sym)) return 'options'
  if (isFutures(sym)) return 'futures'
  return 'equity'
}

// ── Mock trades adapted for Indian market ────────────────────────────────────
export function generateMockTrades(count = 200) {
  const eqSyms = ['RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK','SBIN','BAJFINANCE','BHARTIARTL','WIPRO','LT','AXISBANK','TATAMOTORS','MARUTI']
  const optSyms = [
    'NIFTY24DEC24750CE','NIFTY24DEC24700PE','NIFTY24DEC24800CE','NIFTY24DEC24650PE',
    'BANKNIFTY24DEC52000CE','BANKNIFTY24DEC51500PE','BANKNIFTY24DEC52500CE','BANKNIFTY24DEC51000PE',
    'NIFTY24NOV24800CE','NIFTY24NOV24600PE','FINNIFTY24DEC23500CE','FINNIFTY24DEC23000PE',
  ]
  const futSyms = ['NIFTY24DECFUT','BANKNIFTY24DECFUT','RELIANCE24DECFUT','TCS24DECFUT','INFY24DECFUT']

  const trades = []
  let equityEquity = 500000
  let optionEquity = 200000
  let time = Date.now() - count * 1.2 * 24 * 3600 * 1000

  for (let i = 0; i < count; i++) {
    const roll = Math.random()
    let sym, segment, price, qty, pnl, fee, productType, exchange

    if (roll < 0.35) {
      // Equity / Swing
      segment = 'equity'; exchange = 'NSE'
      sym = eqSyms[Math.floor(Math.random() * eqSyms.length)]
      price = sym==='RELIANCE'?2400+Math.random()*400 : sym==='TCS'?3600+Math.random()*400
            : sym==='INFY'?1600+Math.random()*200    : sym==='HDFCBANK'?1500+Math.random()*200
            : 400+Math.random()*1600
      qty = Math.floor(Math.random()*50+1)*10
      const turnover = price*qty
      fee = Math.min(20, turnover*0.0003) + turnover*0.00015 + (roll<0.2?turnover*0.001:0) // STT
      pnl = (Math.random()-0.43)*turnover*0.03
      productType = Math.random()>0.5?'CNC':'MIS'
      equityEquity += pnl - fee

    } else if (roll < 0.75) {
      // Options — the main segment
      segment = 'options'; exchange = 'NFO'
      sym = optSyms[Math.floor(Math.random()*optSyms.length)]
      const lotSize = sym.includes('BANKNIFTY')?30:sym.includes('FINNIFTY')?65:75
      price = 30+Math.random()*500
      qty = (Math.floor(Math.random()*4)+1)*lotSize
      const turnover = price*qty
      fee = Math.min(40, turnover*0.0005) + turnover*0.0005 // STT on options sell
      pnl = (Math.random()-0.45)*price*qty*0.8
      productType = 'NRML'
      optionEquity += pnl - fee

    } else {
      // Futures
      segment = 'futures'; exchange = 'NFO'
      sym = futSyms[Math.floor(Math.random()*futSyms.length)]
      const lotSize = sym.includes('BANKNIFTY')?30:75
      price = sym.includes('BANKNIFTY')?51000+Math.random()*3000 : sym.includes('NIFTY')?24000+Math.random()*2000 : 1000+Math.random()*3000
      qty = (Math.floor(Math.random()*2)+1)*lotSize
      const turnover = price*qty
      fee = Math.min(20, turnover*0.0002)
      pnl = (Math.random()-0.44)*price*qty*0.015
      productType = 'NRML'
      equityEquity += pnl - fee
    }

    const side = Math.random()>0.5?'BUY':'SELL'
    time += Math.random()*1.2*24*3600*1000
    const tradeDate = new Date(time)
    // Market hours 9:15 – 15:30
    tradeDate.setHours(9+Math.floor(Math.random()*6), 15+Math.floor(Math.random()*295), 0, 0)
    // Skip weekends
    if (tradeDate.getDay()===0) tradeDate.setDate(tradeDate.getDate()+1)
    if (tradeDate.getDay()===6) tradeDate.setDate(tradeDate.getDate()+2)

    trades.push({
      id: `T${1000+i}`,
      symbol: sym, segment, side,
      qty: Math.abs(Math.round(qty)),
      price: +price.toFixed(2),
      exitPrice: +(price*(1+(Math.random()-0.5)*0.04)).toFixed(2),
      fee: +Math.abs(fee).toFixed(2),
      pnl: +pnl.toFixed(2),
      equity: +(segment==='options'?optionEquity:equityEquity).toFixed(2),
      leverage: segment==='futures'?5:segment==='options'?10:1,
      riskPercent: +(Math.random()*3).toFixed(2),
      time: tradeDate.getTime(),
      exchange, productType, source: 'demo',
    })
  }
  return trades.sort((a,b)=>a.time-b.time)
}

export function localDateKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function loadCashFlow() {
  try { return JSON.parse(localStorage.getItem('ml_cashflow')||'[]') } catch { return [] }
}
export function saveCashFlow(cf) {
  try { localStorage.setItem('ml_cashflow', JSON.stringify(cf)) } catch {}
}

export function computeStats(trades) {
  if (!trades?.length||!Array.isArray(trades)) return {total:0}
  const winners  = trades.filter(t=>t.pnl>0)
  const losers   = trades.filter(t=>t.pnl<0)
  const decided  = winners.length+losers.length

  const grossPnL     = trades.reduce((s,t)=>s+t.pnl,0)
  const totalFees    = trades.reduce((s,t)=>s+t.fee,0)
  const netPnL       = grossPnL-totalFees
  const grossProfit  = winners.reduce((s,t)=>s+t.pnl,0)
  const grossLoss    = Math.abs(losers.reduce((s,t)=>s+t.pnl,0))
  const profitFactor = grossLoss?grossProfit/grossLoss:Infinity
  const avgWin       = winners.length?grossProfit/winners.length:0
  const avgLoss      = losers.length?grossLoss/losers.length:0
  const winRate      = decided>0?(winners.length/decided)*100:0

  // Drawdown on cumPnL
  let ddPeak=0,maxDD=0,runCum=0
  trades.forEach(t=>{runCum+=t.pnl;if(runCum>ddPeak)ddPeak=runCum;const dd=ddPeak>0?(ddPeak-runCum)/ddPeak*100:0;if(dd>maxDD)maxDD=dd})

  let dsPeak=0,dsRun=0
  const drawdownSeries=trades.map(t=>{dsRun+=t.pnl;if(dsRun>dsPeak)dsPeak=dsRun;const dd=dsPeak>0?-((dsPeak-dsRun)/dsPeak*100):0;return{dd:+dd.toFixed(2),date:localDateKey(t.time)}})

  // Symbol stats
  const bySymbol={}
  trades.forEach(t=>{
    if(!bySymbol[t.symbol])bySymbol[t.symbol]={pnl:0,fees:0,count:0,wins:0,losses:0,longs:0,shorts:0,longPnl:0,shortPnl:0,segment:getSegment(t)}
    const s=bySymbol[t.symbol];s.pnl+=t.pnl;s.fees+=t.fee;s.count++;t.pnl>0?s.wins++:s.losses++
    if(t.side==='BUY'){s.longs++;s.longPnl+=t.pnl}else{s.shorts++;s.shortPnl+=t.pnl}
  })
  const symbolArr=Object.entries(bySymbol).map(([sym,d])=>({sym,...d,wr:+(d.wins/d.count*100).toFixed(1),avgPnl:+(d.pnl/d.count).toFixed(2),netPnl:+(d.pnl-d.fees).toFixed(2)})).sort((a,b)=>b.pnl-a.pnl)

  // Equity curve
  let cum=0
  const equityCurve=trades.map(t=>{cum+=t.pnl;return{equity:t.equity,time:t.time,pnl:t.pnl,cumPnL:+cum.toFixed(2),date:localDateKey(t.time)}})

  // Period builders
  const buildPeriod=(keyFn)=>{
    const map={}
    trades.forEach(t=>{
      const key=keyFn(t)
      if(!map[key])map[key]={pnl:0,fees:0,trades:0,wins:0,ts:t.time,label:key}
      map[key].pnl+=t.pnl;map[key].fees+=t.fee;map[key].trades++;if(t.pnl>0)map[key].wins++
    })
    return Object.values(map).sort((a,b)=>a.ts-b.ts).map(d=>({...d,pnl:+d.pnl.toFixed(2),fees:+d.fees.toFixed(2),netPnl:+(d.pnl-d.fees).toFixed(2),wr:+(d.wins/d.trades*100).toFixed(1),m:d.label,w:d.label,q:d.label,y:d.label}))
  }
  const monthlyArr   = buildPeriod(t=>new Date(t.time).toLocaleDateString('en-IN',{month:'short',year:'2-digit'}))
  const weeklyArr    = buildPeriod(t=>{const d=new Date(t.time),jan=new Date(d.getFullYear(),0,1),wk=Math.ceil(((d-jan)/86400000+jan.getDay()+1)/7);return`W${wk} ${d.getFullYear()}`})
  const quarterlyArr = buildPeriod(t=>{const d=new Date(t.time);return`Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`})
  const yearlyArr    = buildPeriod(t=>String(new Date(t.time).getFullYear()))

  // Daily
  const dailyPnL={}
  trades.forEach(t=>{const k=localDateKey(t.time);if(!dailyPnL[k])dailyPnL[k]={pnl:0,fees:0,trades:0,wins:0};dailyPnL[k].pnl+=t.pnl;dailyPnL[k].fees+=t.fee;dailyPnL[k].trades++;if(t.pnl>0)dailyPnL[k].wins++})

  // Streaks
  let maxWinStreak=0,maxLossStreak=0,curW=0,curL=0,currentStreak=0
  trades.forEach(t=>{if(t.pnl>0){curW++;curL=0;maxWinStreak=Math.max(maxWinStreak,curW);currentStreak=curW}else{curL++;curW=0;maxLossStreak=Math.max(maxLossStreak,curL);currentStreak=-curL}})

  // Long/Short
  const longs=trades.filter(t=>t.side==='BUY'),shorts=trades.filter(t=>t.side==='SELL')

  // Hour heatmap
  const byHour=Array.from({length:24},(_,h)=>({hour:h,pnl:0,count:0,wins:0}))
  trades.forEach(t=>{const h=new Date(t.time).getHours();byHour[h].pnl+=t.pnl;byHour[h].count++;if(t.pnl>0)byHour[h].wins++})

  // Day of week
  const byDay=Array.from({length:7},(_,d)=>({day:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d],short:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d],pnl:0,count:0,wins:0,fees:0}))
  trades.forEach(t=>{const d=new Date(t.time).getDay();byDay[d].pnl+=t.pnl;byDay[d].count++;byDay[d].fees+=t.fee;if(t.pnl>0)byDay[d].wins++})
  const activeDays=[...byDay].filter(d=>d.count>0)
  const dayStats={
    mostProfitable:[...activeDays].sort((a,b)=>b.pnl-a.pnl)[0],
    leastProfitable:[...activeDays].sort((a,b)=>a.pnl-b.pnl)[0],
    mostActive:[...activeDays].sort((a,b)=>b.count-a.count)[0],
    bestWinRate:[...activeDays].filter(d=>d.count>=3).sort((a,b)=>(b.wins/b.count)-(a.wins/a.count))[0],
    worstWinRate:[...activeDays].filter(d=>d.count>=3).sort((a,b)=>(a.wins/a.count)-(b.wins/b.count))[0],
  }

  // PnL distribution
  const pnlVals=trades.map(t=>t.pnl).filter(v=>typeof v==='number'&&isFinite(v))
  if(!pnlVals.length)pnlVals.push(0)
  const minPnl=Math.min(...pnlVals),maxPnl=Math.max(...pnlVals)
  const step=(maxPnl-minPnl)/24||1
  const distribution=Array.from({length:24},(_,i)=>{const from=minPnl+i*step;return{label:'₹'+from.toFixed(0),from,count:trades.filter(t=>t.pnl>=from&&t.pnl<from+step).length,isPositive:from>=0}})

  // Sharpe
  const mean=pnlVals.reduce((a,b)=>a+b,0)/pnlVals.length
  const std=Math.sqrt(pnlVals.map(r=>(r-mean)**2).reduce((a,b)=>a+b,0)/pnlVals.length)||1
  const sharpe=+(mean/std*Math.sqrt(252)).toFixed(2)

  const startEquity=trades[0]?.equity-(trades[0]?.pnl)+(trades[0]?.fee||0)
  const endEquity=trades[trades.length-1]?.equity||startEquity
  const totalReturn=startEquity>0?(endEquity-startEquity)/startEquity*100:0

  // Segment breakdown
  const bySegment={equity:{pnl:0,fees:0,count:0,wins:0},options:{pnl:0,fees:0,count:0,wins:0},futures:{pnl:0,fees:0,count:0,wins:0}}
  trades.forEach(t=>{const seg=getSegment(t);if(bySegment[seg]){bySegment[seg].pnl+=t.pnl;bySegment[seg].fees+=t.fee;bySegment[seg].count++;if(t.pnl>0)bySegment[seg].wins++}})

  return {
    total:trades.length,winners:winners.length,losers:losers.length,
    grossPnL:+grossPnL.toFixed(2),totalFees:+totalFees.toFixed(2),netPnL:+netPnL.toFixed(2),
    totalPnL:+grossPnL.toFixed(2),
    grossProfit:+grossProfit.toFixed(2),grossLoss:+grossLoss.toFixed(2),
    avgWin,avgLoss,winRate,profitFactor,
    rr:avgLoss?+(avgWin/avgLoss).toFixed(2):'∞',
    maxDD:+maxDD.toFixed(2),drawdownSeries,
    symbolArr,equityCurve,dailyPnL,
    monthlyArr,weeklyArr,quarterlyArr,yearlyArr,
    longs:longs.length,shorts:shorts.length,
    longPnL:+longs.reduce((s,t)=>s+t.pnl,0).toFixed(2),
    shortPnL:+shorts.reduce((s,t)=>s+t.pnl,0).toFixed(2),
    longWR:longs.length?longs.filter(t=>t.pnl>0).length/longs.length*100:0,
    shortWR:shorts.length?shorts.filter(t=>t.pnl>0).length/shorts.length*100:0,
    maxWinStreak,maxLossStreak,currentStreak,
    largestWin:pnlVals.length?Math.max(...pnlVals):0,largestLoss:pnlVals.length?Math.min(...pnlVals):0,
    byHour,byDay,dayStats,distribution,sharpe,
    avgRiskPct:trades.reduce((s,t)=>s+(t.riskPercent||0),0)/trades.length,
    startEquity,endEquity,totalReturn,
    bySegment,
    dateRange:{start:trades[0]?.time,end:trades[trades.length-1]?.time},
    firstDate:trades[0]?.time,lastDate:trades[trades.length-1]?.time,
  }
}

// Segment-filtered stats
export function computeSegmentStats(trades, segment) {
  if (!trades?.length||!Array.isArray(trades)) return {total:0}
  const filtered = segment === 'all' ? trades : trades.filter(t => getSegment(t) === segment)
  return computeStats(filtered)
}

export const fmt     = (n,d=2) => n==null||isNaN(n)?'—':Number(n).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})
export const fmtUSD  = (n) => (n>=0?'+₹':'-₹')+fmt(Math.abs(n))
export const fmtINR  = (n) => (n>=0?'+₹':'-₹')+fmt(Math.abs(n))
export const fmtPct  = (n) => (n>=0?'+':'')+fmt(n)+'%'
export const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'})
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})

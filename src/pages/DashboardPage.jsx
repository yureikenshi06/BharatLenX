import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { THEME as T, colorPnL, segmentColor } from '../lib/theme'
import { fmt, fmtDate, localDateKey } from '../lib/data'
import { KpiCard, Card, SectionHead, SegmentToggle, ProgressBar, ChartTooltip, Select, Btn } from '../components/UI'

const PERIOD_OPTIONS = [
  { value:'weekly', label:'Weekly' }, { value:'monthly', label:'Monthly' },
  { value:'quarterly', label:'Quarterly' }, { value:'yearly', label:'Yearly' },
]

export default function DashboardPage({ trades, stats, activeStats, segment, setSegment, applyDateRange, dateRange, fyersConnected }) {
  const [period, setPeriod] = useState('monthly')
  const [startDate, setStart] = useState('')
  const [endDate,   setEnd]   = useState('')
  const st = activeStats || {}

  // Fyers connected but genuinely zero trades — don't show demo data
  if (fyersConnected && (!trades || trades.length === 0)) {
    return (
      <div style={{ padding:'24px 28px', fontFamily:T.fontSans }}>
        <div style={{ marginBottom:18, paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, color:T.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:4 }}>Overview · NSE / NFO</div>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:-0.5 }}>Dashboard</div>
        </div>
        <div style={{ textAlign:'center', padding:'80px 24px' }}>
          <div style={{ fontSize:52, marginBottom:20, opacity:0.15 }}>📊</div>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:10 }}>No Trades Found</div>
          <div style={{ fontSize:13, color:T.muted, lineHeight:1.8, maxWidth:440, margin:'0 auto 20px' }}>
            Connected to Fyers successfully, but no trades were found in the last 2 years.<br/>
            Once you start trading, your history will appear here automatically.
          </div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:T.greenDim, border:`1px solid ${T.green}33`, borderRadius:8, padding:'8px 16px' }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:T.green }}/>
            <span style={{ fontSize:12, color:T.green, fontWeight:600 }}>Fyers Account Connected</span>
          </div>
        </div>
      </div>
    )
  }

  // No trades at all — show a proper empty dashboard (not a blank div)
  if (!trades?.length) return (
    <div style={{ padding:'24px 28px', fontFamily:T.fontSans }}>
      <div style={{ marginBottom:18, paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11, color:T.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:4 }}>Overview · NSE / NFO</div>
        <div style={{ fontSize:22, fontWeight:700 }}>Dashboard</div>
      </div>
      {/* KPI grid — all zeros */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'Net P&L',      v:'₹0.00',  sub:'No trades yet' },
          { l:'Total Trades', v:'0',       sub:'Connect Fyers to sync' },
          { l:'Win Rate',     v:'—',       sub:'—' },
          { l:'Max Drawdown', v:'₹0.00',  sub:'—' },
        ].map(k => (
          <div key={k.l} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'16px 18px' }}>
            <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:8 }}>{k.l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:T.text }}>{k.v}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {/* Empty chart area */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'48px 24px', textAlign:'center' }}>
        <div style={{ fontSize:36, marginBottom:14, opacity:0.12 }}>◈</div>
        <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:8 }}>No trades synced yet</div>
        <div style={{ fontSize:12, color:T.muted, lineHeight:1.8, maxWidth:380, margin:'0 auto' }}>
          Go to <strong style={{ color:T.accent }}>Settings</strong> → connect your Fyers account.<br/>
          All trades will sync automatically and appear here.
        </div>
      </div>
    </div>
  )

  const periodData = (st[period+'Arr']||[]).map(d=>({label:d.label,...d}))

  const radarData = [
    { metric:'Win Rate',    val: Math.min(100, st.winRate||0) },
    { metric:'Risk/Reward', val: Math.min(100, parseFloat(st.rr||0)/3*100) },
    { metric:'Consistency', val: Math.min(100, isFinite(st.profitFactor)?Math.min(st.profitFactor,3)/3*100:100) },
    { metric:'DD Control',  val: Math.max(0, 100-(st.maxDD||0)*3) },
    { metric:'Avg Win',     val: Math.min(100, st.avgWin>0&&st.avgLoss>0?Math.min(st.avgWin/st.avgLoss,3)/3*100:50) },
    { metric:'Discipline',  val: Math.max(0, 100-(st.maxLossStreak||0)*8) },
  ]

  const applyRange = () => { if(startDate&&endDate&&applyDateRange) applyDateRange(new Date(startDate+'T00:00:00').getTime(),new Date(endDate+'T23:59:59').getTime()) }
  const clearRange = () => { setStart('');setEnd('');applyDateRange&&applyDateRange(null,null) }

  const allStats = stats||{}
  const segSummary = [
    { id:'equity',  label:'Equity',  pnl:allStats.equity?.netPnL||0,  count:allStats.equity?.total||0,  wr:allStats.equity?.winRate||0  },
    { id:'options', label:'Options', pnl:allStats.options?.netPnL||0, count:allStats.options?.total||0, wr:allStats.options?.winRate||0 },
    { id:'futures', label:'Futures', pnl:allStats.futures?.netPnL||0, count:allStats.futures?.total||0, wr:allStats.futures?.winRate||0 },
  ]

  return (
    <div className="page-enter" style={{ padding:'24px 28px', fontFamily:T.fontSans }}>
      {/* Header */}
      <div style={{ marginBottom:18, paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:11, color:T.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:4, fontWeight:500 }}>Overview · NSE / NFO</div>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:-0.5 }}>Dashboard</div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <SegmentToggle value={segment} onChange={setSegment}/>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="date" value={startDate} onChange={e=>setStart(e.target.value)}
                style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 9px',color:T.text,fontFamily:T.fontSans,fontSize:11,outline:'none' }}/>
              <span style={{ fontSize:11,color:T.muted }}>–</span>
              <input type="date" value={endDate} onChange={e=>setEnd(e.target.value)}
                style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 9px',color:T.text,fontFamily:T.fontSans,fontSize:11,outline:'none' }}/>
              <Btn onClick={applyRange} variant="accent" style={{ padding:'5px 12px',fontSize:11 }}>Apply</Btn>
              {dateRange&&<Btn onClick={clearRange} style={{ padding:'5px 12px',fontSize:11 }}>✕</Btn>}
            </div>
          </div>
        </div>
        {dateRange&&<div style={{ marginTop:6,fontSize:11,color:T.accent }}>Filtered: {fmtDate(dateRange.start)} – {fmtDate(dateRange.end)} · {trades.length} trades</div>}
      </div>

      {/* Segment Strip — click to drill down */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
        {segSummary.map(s=>{
          const isActive = segment===s.id
          const c = segmentColor(s.id)
          return (
            <div key={s.id} onClick={()=>setSegment(isActive?'all':s.id)} style={{
              background:T.card, border:`2px solid ${isActive?c:T.border}`,
              borderRadius:10, padding:'13px 16px', cursor:'pointer',
              transition:'all 0.15s', position:'relative', overflow:'hidden',
            }}>
              <div style={{ position:'absolute',top:0,right:0,width:60,height:60,background:`radial-gradient(circle,${c}22,transparent 70%)`,pointerEvents:'none' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                <span style={{ fontSize:10, fontWeight:600, color:isActive?c:T.muted, textTransform:'uppercase', letterSpacing:1 }}>{s.label}</span>
                {isActive&&<span style={{ fontSize:8,color:c,background:c+'22',padding:'2px 6px',borderRadius:3,fontWeight:700 }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:colorPnL(s.pnl), fontFamily:T.fontMono, letterSpacing:-0.5 }}>
                {s.pnl>=0?'+₹':'-₹'}{fmt(Math.abs(s.pnl))}
              </div>
              <div style={{ display:'flex', gap:12, marginTop:5 }}>
                <span style={{ fontSize:10, color:T.muted }}>{s.count} trades</span>
                <span style={{ fontSize:10, color:T.textMid, fontFamily:T.fontMono }}>{fmt(s.wr,1)}% WR</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* KPI Row 1 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:10 }}>
        <KpiCard label="Net P&L"       value={(st.netPnL>=0?'+₹':'-₹')+fmt(Math.abs(st.netPnL||0))}     color={colorPnL(st.netPnL||0)}      sub="Gross minus fees"/>
        <KpiCard label="Gross P&L"     value={(st.grossPnL>=0?'+₹':'-₹')+fmt(Math.abs(st.grossPnL||0))} color={colorPnL(st.grossPnL||0)}    sub="Before fees"/>
        <KpiCard label="Total Fees"    value={'₹'+fmt(st.totalFees||0)}                                   color={T.red}                        sub="STT + Brokerage"/>
        <KpiCard label="Win Rate"      value={fmt(st.winRate||0)+'%'}                                      color={(st.winRate||0)>=50?T.green:T.red} sub={`${st.winners||0}W / ${st.losers||0}L`}/>
        <KpiCard label="Max Drawdown"  value={fmt(st.maxDD||0)+'%'}                                       color={T.red}                        sub="From cumPnL peak"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
        <KpiCard label="Profit Factor" value={isFinite(st.profitFactor)?fmt(st.profitFactor):'∞'} color={(st.profitFactor||0)>=1.5?T.green:T.red} sub="Gross profit ÷ loss"/>
        <KpiCard label="Risk/Reward"   value={(st.rr||0)+'x'}  color={parseFloat(st.rr||0)>=1.5?T.green:T.red} sub={`Avg W ₹${fmt(st.avgWin||0,0)} / L ₹${fmt(st.avgLoss||0,0)}`}/>
        <KpiCard label="Sharpe Ratio"  value={fmt(st.sharpe||0)} color={(st.sharpe||0)>=1?T.green:T.red} sub="Risk-adj return"/>
        <KpiCard label="Best Streak"   value={(st.maxWinStreak||0)+'W'} color={T.green} sub="Consecutive wins"/>
        <KpiCard label="Total Trades"  value={st.total||0} sub={`${fmtDate(st.firstDate||Date.now())} – now`}/>
      </div>

      {/* P&L Breakdown Banner */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 16px', marginBottom:14, display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ fontSize:11, color:T.muted }}>P&L Check:</div>
        <span style={{ fontSize:12, fontFamily:T.fontMono, color:colorPnL(st.grossPnL||0) }}>{(st.grossPnL||0)>=0?'+₹':'-₹'}{fmt(Math.abs(st.grossPnL||0))} Gross</span>
        <span style={{ fontSize:12, color:T.muted }}>−</span>
        <span style={{ fontSize:12, fontFamily:T.fontMono, color:T.red }}>₹{fmt(st.totalFees||0)} Fees</span>
        <span style={{ fontSize:12, color:T.muted }}>=</span>
        <span style={{ fontSize:13, fontFamily:T.fontMono, fontWeight:700, color:colorPnL(st.netPnL||0) }}>{(st.netPnL||0)>=0?'+₹':'-₹'}{fmt(Math.abs(st.netPnL||0))} Net</span>
        {segment!=='all'&&<span style={{ marginLeft:'auto', fontSize:11, color:T.accent }}>Viewing: {segment.charAt(0).toUpperCase()+segment.slice(1)}</span>}
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <Card>
          <SectionHead title="Cumulative P&L" sub="Net running total"/>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={st.equityCurve||[]} margin={{ left:4,right:4,top:4,bottom:4 }}>
              <defs>
                <linearGradient id="cpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.blue} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={T.blue} stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="i" hide/>
              <YAxis tick={{ fill:T.muted,fontSize:10,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>'₹'+fmt(v,0)} width={68}/>
              <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4"/>
              <Tooltip content={<ChartTooltip formatter={v=>(v>=0?'+₹':'-₹')+fmt(Math.abs(v))}/>}/>
              <Area type="monotone" dataKey="cumPnL" stroke={T.blue} fill="url(#cpGrad)" strokeWidth={2} dot={false} name="Cum P&L"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHead title="Drawdown Chart" sub="Risk exposure"/>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={st.drawdownSeries||[]} margin={{ left:4,right:4,top:4,bottom:4 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.red} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={T.red} stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="i" hide/>
              <YAxis tick={{ fill:T.muted,fontSize:10,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>v.toFixed(1)+'%'} width={52}/>
              <Tooltip content={<ChartTooltip formatter={v=>fmt(v)+'%'}/>}/>
              <Area type="monotone" dataKey="dd" stroke={T.red} fill="url(#ddGrad)" strokeWidth={2} dot={false} name="Drawdown"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Period */}
      <Card style={{ marginBottom:12 }}>
        <SectionHead title="Period P&L" sub="Performance by Period"
          action={<Select value={period} onChange={setPeriod} options={PERIOD_OPTIONS} style={{ fontSize:11,padding:'4px 10px' }}/>}/>
        {periodData.length>0 ? (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={periodData} barSize={Math.max(8,Math.min(28,200/periodData.length))} margin={{ left:8,right:8,top:4,bottom:4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
              <XAxis dataKey="label" tick={{ fill:T.muted,fontSize:10 }} tickLine={false} axisLine={{ stroke:T.border }}/>
              <YAxis tick={{ fill:T.muted,fontSize:10,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>'₹'+fmt(v,0)} width={72}/>
              <ReferenceLine y={0} stroke={T.border}/>
              <Tooltip content={({ active,payload,label })=>{
                if(!active||!payload?.length)return null
                const d=payload[0]?.payload
                return(<div style={{ background:T.card,border:`1px solid ${T.borderMid}`,borderRadius:8,padding:'10px 14px',fontFamily:T.fontMono,fontSize:11 }}>
                  <div style={{ color:T.muted,marginBottom:5 }}>{label}</div>
                  <div style={{ color:colorPnL(d?.pnl||0) }}>Gross: {(d?.pnl||0)>=0?'+₹':'-₹'}{fmt(Math.abs(d?.pnl||0))}</div>
                  <div style={{ color:T.red }}>Fees: ₹{fmt(d?.fees||0)}</div>
                  <div style={{ color:colorPnL(d?.netPnl||0),fontWeight:700 }}>Net: {(d?.netPnl||0)>=0?'+₹':'-₹'}{fmt(Math.abs(d?.netPnl||0))}</div>
                  <div style={{ color:T.muted,marginTop:4 }}>Trades: {d?.trades} · WR: {d?.wr}%</div>
                </div>)
              }}/>
              <Bar dataKey="pnl" name="Gross P&L" radius={[3,3,0,0]}>
                {periodData.map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red} opacity={0.85}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ):<div style={{ color:T.muted,fontSize:12,padding:'28px 0',textAlign:'center' }}>No data</div>}
      </Card>

      {/* Day of Week + Radar */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:12, marginBottom:12 }}>
        <Card>
          <SectionHead title="Day of Week Analysis" sub="Mon–Fri only (Indian markets)"/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={(st.byDay||[]).filter(d=>!['Sun','Sat'].includes(d.short))} barSize={22} margin={{ left:4,right:4,top:4,bottom:4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false}/>
                <XAxis dataKey="short" tick={{ fill:T.muted,fontSize:10 }} tickLine={false} axisLine={{ stroke:T.border }}/>
                <YAxis tick={{ fill:T.muted,fontSize:9,fontFamily:T.fontMono }} tickLine={false} axisLine={false} tickFormatter={v=>'₹'+fmt(v,0)} width={62}/>
                <ReferenceLine y={0} stroke={T.border}/>
                <Tooltip content={<ChartTooltip formatter={v=>(v>=0?'+₹':'-₹')+fmt(Math.abs(v))}/>}/>
                <Bar dataKey="pnl" radius={[3,3,0,0]}>
                  {(st.byDay||[]).filter(d=>!['Sun','Sat'].includes(d.short)).map((d,i)=><Cell key={i} fill={d.pnl>=0?T.green:T.red} opacity={0.85}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:'flex',flexDirection:'column',gap:5,justifyContent:'center' }}>
              {[
                { label:'🏆 Best Day',     day:st.dayStats?.mostProfitable,  val:d=>'₹'+fmt(d.pnl,0),            color:T.green  },
                { label:'📉 Worst Day',    day:st.dayStats?.leastProfitable, val:d=>'-₹'+fmt(Math.abs(d.pnl),0), color:T.red    },
                { label:'🔥 Most Active',  day:st.dayStats?.mostActive,      val:d=>d.count+' trades',            color:T.blue   },
                { label:'✅ Best WR',      day:st.dayStats?.bestWinRate,     val:d=>fmt(d.wins/d.count*100)+'%',  color:T.green  },
              ].map(row=>row.day?(
                <div key={row.label} style={{ padding:'7px 10px',background:T.surface,borderRadius:7,border:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:9,color:T.muted }}>{row.label}</div>
                    <div style={{ fontSize:12,fontWeight:600 }}>{row.day.day}</div>
                  </div>
                  <div style={{ fontSize:12,fontWeight:700,color:row.color,fontFamily:T.fontMono }}>{row.val(row.day)}</div>
                </div>
              ):null)}
            </div>
          </div>
        </Card>
        <Card>
          <SectionHead title="Score Radar" sub="Performance"/>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
              <PolarGrid stroke={T.border}/>
              <PolarAngleAxis dataKey="metric" tick={{ fill:T.muted,fontSize:9 }}/>
              <Radar dataKey="val" stroke={T.accent} fill={T.accent} fillOpacity={0.12} strokeWidth={2}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Win/Loss */}
      <Card>
        <SectionHead title="Win / Loss Breakdown" sub="Trade Outcomes"/>
        <div style={{ display:'flex',alignItems:'center',gap:24 }}>
          <ResponsiveContainer width={130} height={130}>
            <PieChart>
              <Pie data={[{v:st.winners||0},{v:st.losers||0}]} dataKey="v" innerRadius={38} outerRadius={58} paddingAngle={2} startAngle={90} endAngle={-270}>
                <Cell fill={T.green}/><Cell fill={T.red}/>
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,flex:1 }}>
            {[
              { l:'Winners',     v:st.winners||0,                                                   sub:fmt(st.winRate||0,1)+'%',          c:T.green  },
              { l:'Losers',      v:st.losers||0,                                                    sub:fmt(100-(st.winRate||0),1)+'%',    c:T.red    },
              { l:'Avg Win',     v:'+₹'+fmt(st.avgWin||0),                                          sub:'per trade',                       c:T.green  },
              { l:'Avg Loss',    v:'-₹'+fmt(st.avgLoss||0),                                         sub:'per trade',                       c:T.red    },
              { l:'Largest Win', v:'+₹'+fmt(st.largestWin||0),                                      sub:'single trade',                    c:T.green  },
              { l:'Largest Loss',v:'-₹'+fmt(Math.abs(st.largestLoss||0)),                           sub:'single trade',                    c:T.red    },
              { l:'Buy P&L',     v:((st.longPnL||0)>=0?'+₹':'-₹')+fmt(Math.abs(st.longPnL||0)),    sub:fmt(st.longWR||0,1)+'% WR',       c:T.blue   },
              { l:'Sell P&L',    v:((st.shortPnL||0)>=0?'+₹':'-₹')+fmt(Math.abs(st.shortPnL||0)),  sub:fmt(st.shortWR||0,1)+'% WR',      c:T.purple },
            ].map(r=>(
              <div key={r.l} style={{ background:T.surface,borderRadius:7,padding:'9px 11px',border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:3 }}>{r.l}</div>
                <div style={{ fontSize:14,fontWeight:700,color:r.c,fontFamily:T.fontMono }}>{r.v}</div>
                <div style={{ fontSize:9,color:T.muted,marginTop:2 }}>{r.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

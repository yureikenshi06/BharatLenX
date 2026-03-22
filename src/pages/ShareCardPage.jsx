import { useState, useRef } from 'react'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate } from '../lib/data'
import { Card, SectionHead, Btn, Select } from '../components/UI'

const CARD_THEMES = [
  { id:'navy',   label:'Deep Navy',   bg:'#05080f', accent:'#4f8fff', text:'#dde4f5', card:'#0b1020', border:'#182040' },
  { id:'dark',   label:'Dark Blue',   bg:'#03050c', accent:'#00d4ff', text:'#e0eeff', card:'#080c1a', border:'#0f1a30' },
  { id:'black',  label:'Pure Black',  bg:'#000000', accent:'#4f8fff', text:'#ffffff', card:'#0a0a0a', border:'#1a1a1a' },
  { id:'green',  label:'Bull Mode',   bg:'#031208', accent:'#00d68f', text:'#dcfce7', card:'#051a0a', border:'#0a3015' },
  { id:'red',    label:'Bear Mode',   bg:'#180205', accent:'#ff4d6a', text:'#fee2e2', card:'#1e0408', border:'#3a0810' },
]

const CARD_TYPES = [
  { id:'period',    label:'Period Report'   },
  { id:'alltime',   label:'All-Time Stats'  },
  { id:'streak',    label:'Win Streak'      },
  { id:'milestone', label:'Milestone'       },
  { id:'segment',   label:'Segment Split'   },
]

const PERIOD_OPTS = [
  { value:'weekly',    label:'This Week'    },
  { value:'monthly',   label:'This Month'   },
  { value:'quarterly', label:'This Quarter' },
  { value:'yearly',    label:'This Year'    },
]

export default function ShareCardPage({ trades, stats }) {
  const allStats = (stats?.all || stats || {})
  const [themeId,   setThemeId]   = useState('navy')
  const [cardType,  setCardType]  = useState('period')
  const [period,    setPeriod]    = useState('monthly')
  const [dispMode,  setDispMode]  = useState('value')
  const [customMsg, setCustomMsg] = useState('')
  const cardRef = useRef(null)

  const th = CARD_THEMES.find(t=>t.id===themeId)||CARD_THEMES[0]

  const periodStats = (() => {
    const now = new Date()
    const arr = allStats[period+'Arr'] || []
    if (period==='monthly') {
      const key = now.toLocaleDateString('en-IN',{month:'short',year:'2-digit'})
      return arr.find(m=>m.label===key||m.m===key) || arr[arr.length-1] || {pnl:0,trades:0,wr:0,fees:0}
    }
    return arr[arr.length-1] || {pnl:0,trades:0,wr:0,fees:0}
  })()

  const periodLabel = PERIOD_OPTS.find(p=>p.value===period)?.label||period
  const periodPnl   = periodStats.pnl||0
  const periodNet   = periodStats.netPnl??(periodPnl-(periodStats.fees||0))

  const fmtVal = (pnl) => (pnl>=0?'+₹':'-₹')+fmt(Math.abs(pnl),0)

  const downloadCard = async () => {
    const el = cardRef.current
    if (!el) return
    try {
      if (!window.html2canvas) {
        await new Promise((res,rej)=>{
          const s=document.createElement('script')
          s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
          s.onload=res;s.onerror=rej;document.head.appendChild(s)
        })
      }
      const canvas = await window.html2canvas(el,{backgroundColor:th.bg,scale:2,logging:false,useCORS:true})
      const link = document.createElement('a')
      link.download = `bharatlenx-${cardType}-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch(e) { alert('Download failed: '+e.message) }
  }

  const StatBox = ({ label, value, accent }) => (
    <div style={{ background:th.border+'33', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
      <div style={{ fontSize:9, color:th.text, opacity:0.5, textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color:accent||th.accent, fontFamily:'JetBrains Mono,monospace' }}>{value}</div>
    </div>
  )

  const CardContent = () => {
    if (cardType==='period') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:6,opacity:0.8 }}>{periodLabel} · BharatLenX</div>
        <div style={{ fontSize:32, fontWeight:700, color:periodPnl>=0?th.accent:'#ff4d6a', fontFamily:'JetBrains Mono,monospace', letterSpacing:-1, marginBottom:6, lineHeight:1.1 }}>
          {fmtVal(periodPnl)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:14 }}>
          <StatBox label="Net P&L"  value={fmtVal(periodNet)}/>
          <StatBox label="Win Rate" value={fmt(periodStats.wr||0,1)+'%'}/>
          <StatBox label="Trades"   value={periodStats.trades||0}/>
          <StatBox label="Fees"     value={'₹'+fmt(periodStats.fees||0,0)} accent='#ff4d6a'/>
        </div>
      </>
    )
    if (cardType==='alltime') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:6,opacity:0.8 }}>All-Time Performance · BharatLenX</div>
        <div style={{ fontSize:32, fontWeight:700, color:(allStats.netPnL||0)>=0?th.accent:'#ff4d6a', fontFamily:'JetBrains Mono,monospace', letterSpacing:-1, marginBottom:6 }}>
          {fmtVal(allStats.netPnL||0)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:14 }}>
          <StatBox label="Win Rate"      value={fmt(allStats.winRate||0,1)+'%'}/>
          <StatBox label="R:R"           value={(allStats.rr||0)+'x'}/>
          <StatBox label="Trades"        value={allStats.total||0}/>
          <StatBox label="Profit Factor" value={isFinite(allStats.profitFactor)?fmt(allStats.profitFactor):'∞'}/>
          <StatBox label="Max DD"        value={fmt(allStats.maxDD||0,1)+'%'} accent='#ff4d6a'/>
          <StatBox label="Sharpe"        value={fmt(allStats.sharpe||0)}/>
        </div>
      </>
    )
    if (cardType==='streak') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:10,opacity:0.8 }}>Win Streak · BharatLenX 🔥</div>
        <div style={{ fontSize:72, fontWeight:700, color:th.accent, fontFamily:'JetBrains Mono,monospace', lineHeight:1 }}>{allStats.maxWinStreak||0}</div>
        <div style={{ fontSize:16, color:th.text, opacity:0.6, marginTop:6, marginBottom:16 }}>consecutive wins</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <StatBox label="Win Rate"      value={fmt(allStats.winRate||0,1)+'%'}/>
          <StatBox label="Total Wins"    value={allStats.winners||0}/>
          <StatBox label="Profit Factor" value={isFinite(allStats.profitFactor)?fmt(allStats.profitFactor):'∞'}/>
        </div>
      </>
    )
    if (cardType==='milestone') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:8,opacity:0.8 }}>Trading Milestone · BharatLenX 🏆</div>
        {customMsg&&<div style={{ fontSize:16,color:th.text,opacity:0.8,marginBottom:12,fontWeight:500 }}>{customMsg}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:8 }}>
          <StatBox label="Total Trades" value={allStats.total||0}/>
          <StatBox label="Net P&L"      value={fmtVal(allStats.netPnL||0)}/>
          <StatBox label="Win Rate"     value={fmt(allStats.winRate||0,1)+'%'}/>
          <StatBox label="Best Streak"  value={(allStats.maxWinStreak||0)+'W'}/>
        </div>
      </>
    )
    if (cardType==='segment') return (
      <>
        <div style={{ fontSize:10,color:th.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:10,opacity:0.8 }}>Segment P&L · BharatLenX</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <StatBox label="Equity P&L"  value={fmtVal(stats?.equity?.netPnL||0)}  accent={(stats?.equity?.netPnL||0)>=0?'#4f8fff':'#ff4d6a'}/>
          <StatBox label="Options P&L" value={fmtVal(stats?.options?.netPnL||0)} accent={(stats?.options?.netPnL||0)>=0?'#9d7fff':'#ff4d6a'}/>
          <StatBox label="Futures P&L" value={fmtVal(stats?.futures?.netPnL||0)} accent={(stats?.futures?.netPnL||0)>=0?'#00d4ff':'#ff4d6a'}/>
          <StatBox label="Eq Win Rate"  value={fmt(stats?.equity?.winRate||0,1)+'%'}/>
          <StatBox label="Opt Win Rate" value={fmt(stats?.options?.winRate||0,1)+'%'}/>
          <StatBox label="Fut Win Rate" value={fmt(stats?.futures?.winRate||0,1)+'%'}/>
        </div>
      </>
    )
    return null
  }

  return (
    <div style={{ padding:'24px 28px', fontFamily:T.fontSans }}>
      <div style={{ marginBottom:20, paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11, color:T.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:4, fontWeight:500 }}>Share</div>
        <div style={{ fontSize:22, fontWeight:700, letterSpacing:-0.5 }}>Share Card Generator</div>
        <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>Generate a shareable performance image</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Card>
            <SectionHead title="Card Type" sub=""/>
            {CARD_TYPES.map(ct=>(
              <button key={ct.id} onClick={()=>setCardType(ct.id)} style={{
                display:'block', width:'100%',
                background:cardType===ct.id?T.accentDim:T.surface,
                border:`1px solid ${cardType===ct.id?T.accent:T.border}`,
                color:cardType===ct.id?T.accent:T.textMid,
                borderRadius:7, padding:'8px 12px', cursor:'pointer', textAlign:'left',
                fontSize:12, fontWeight:cardType===ct.id?600:400, marginBottom:5,
              }}>{ct.label}</button>
            ))}
          </Card>

          {cardType==='period'&&(
            <Card>
              <SectionHead title="Period" sub=""/>
              <Select value={period} onChange={setPeriod} options={PERIOD_OPTS} style={{ width:'100%',fontSize:12 }}/>
              {periodStats.pnl!==0&&<div style={{ marginTop:8,fontSize:11,color:T.green }}>✓ {periodStats.trades} trades · {fmtVal(periodStats.pnl)}</div>}
            </Card>
          )}

          <Card>
            <SectionHead title="Theme" sub=""/>
            {CARD_THEMES.map(ct=>(
              <button key={ct.id} onClick={()=>setThemeId(ct.id)} style={{
                display:'flex', alignItems:'center', gap:8, width:'100%',
                background:themeId===ct.id?ct.bg:T.surface,
                border:`2px solid ${themeId===ct.id?ct.accent:T.border}`,
                color:themeId===ct.id?ct.text:T.textMid,
                borderRadius:7, padding:'7px 12px', cursor:'pointer', fontSize:12, marginBottom:5,
              }}>
                <div style={{ width:12,height:12,borderRadius:'50%',background:ct.accent,flexShrink:0 }}/>
                {ct.label}
              </button>
            ))}
          </Card>

          {cardType==='milestone'&&(
            <Card>
              <SectionHead title="Custom Message" sub=""/>
              <input value={customMsg} onChange={e=>setCustomMsg(e.target.value)}
                placeholder="e.g. 200 trades done!"
                style={{ width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 11px',color:T.text,fontSize:12,outline:'none',fontFamily:T.fontSans }}/>
            </Card>
          )}

          <Btn variant="accent" onClick={downloadCard} style={{ padding:'12px',fontSize:13,textAlign:'center' }}>↓ Download PNG</Btn>
        </div>

        <div>
          <div style={{ fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1.5,marginBottom:10 }}>Preview</div>
          <div ref={cardRef} style={{
            background:th.bg, border:`1px solid ${th.border}`,
            borderRadius:14, padding:'28px 32px', maxWidth:520,
            minHeight:260, position:'relative', overflow:'hidden',
            fontFamily:'DM Sans,-apple-system,sans-serif',
          }}>
            <div style={{ position:'absolute',top:-50,right:-50,width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle,${th.accent}22 0%,transparent 70%)`,pointerEvents:'none' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
              <div style={{ fontSize:12,fontWeight:700,color:th.accent,letterSpacing:0.5 }}>◈ BHARATLENX</div>
              <div style={{ fontSize:9,color:th.text,opacity:0.35 }}>{fmtDate(Date.now())} · NSE/NFO</div>
            </div>
            <CardContent/>
            <div style={{ marginTop:22,paddingTop:12,borderTop:`1px solid ${th.border}33`,display:'flex',justifyContent:'space-between' }}>
              <div style={{ fontSize:8,color:th.text,opacity:0.25,textTransform:'uppercase',letterSpacing:1 }}>NSE · BSE · NFO · F&O · India</div>
              <div style={{ fontSize:8,color:th.text,opacity:0.25 }}>Not investment advice</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { THEME, colorPnL, segmentColor } from '../lib/theme'
import { fmt } from '../lib/data'
const T = THEME

export function Card({ children, style, onClick, glow }) {
  return (
    <div onClick={onClick} style={{
      background:T.card, border:`1px solid ${glow?T.accentGlow:T.border}`,
      borderRadius:10, padding:'20px', position:'relative', overflow:'hidden',
      transition:'border-color 0.15s', cursor:onClick?'pointer':'default', ...style,
    }}>
      {glow&&<div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${T.accent}55,transparent)`}}/>}
      {children}
    </div>
  )
}

export function KpiCard({ label, value, sub, color, icon, trend }) {
  const c = color||T.text
  return (
    <div style={{
      background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'16px 18px',
      display:'flex', flexDirection:'column', gap:5, position:'relative', overflow:'hidden',
    }}>
      <div style={{position:'absolute',top:0,right:0,width:64,height:64,background:`radial-gradient(circle at 100% 0%,${c}15 0%,transparent 70%)`,pointerEvents:'none'}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1.2,fontWeight:500}}>{label}</div>
        {icon&&<div style={{fontSize:13,opacity:0.5}}>{icon}</div>}
      </div>
      <div style={{fontSize:22,fontWeight:700,color:c,letterSpacing:-0.5,lineHeight:1,fontFamily:T.fontMono}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:T.muted,fontWeight:400}}>{sub}</div>}
    </div>
  )
}

export function SectionHead({ title, sub, action }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:16}}>
      <div>
        {sub&&<div style={{fontSize:9,color:T.accent,textTransform:'uppercase',letterSpacing:2,marginBottom:4,fontWeight:500}}>{sub}</div>}
        <div style={{fontSize:15,fontWeight:600,color:T.text,letterSpacing:-0.2}}>{title}</div>
      </div>
      {action}
    </div>
  )
}

export function Badge({ text, color, size='sm' }) {
  const c = color||T.textMid
  return (
    <span style={{
      background:c+'18', color:c, border:`1px solid ${c}30`,
      borderRadius:4, padding:size==='sm'?'2px 7px':'4px 10px',
      fontSize:size==='sm'?10:11, fontWeight:500, letterSpacing:0.3,
      whiteSpace:'nowrap', fontFamily:T.fontMono,
    }}>{text}</span>
  )
}

export function SegmentBadge({ segment }) {
  const colors = {equity:T.equityColor,options:T.optionColor,futures:T.futureColor}
  const c = colors[segment]||T.accent
  const labels = {equity:'EQ',options:'OPT',futures:'FUT'}
  return <Badge text={labels[segment]||'EQ'} color={c}/>
}

// ── The key feature: Equity / Options / Futures / All toggle ─────────────────
export function SegmentToggle({ value, onChange, compact=false }) {
  const segs = [
    {id:'all',     label:'All',     color:T.accent},
    {id:'equity',  label:'Equity',  color:T.equityColor},
    {id:'options', label:'Options', color:T.optionColor},
    {id:'futures', label:'Futures', color:T.futureColor},
  ]
  return (
    <div style={{display:'flex',gap:3,background:T.surface,borderRadius:9,padding:3,border:`1px solid ${T.border}`}}>
      {segs.map(s=>{
        const active=value===s.id
        return (
          <button key={s.id} onClick={()=>onChange(s.id)} style={{
            padding:compact?'4px 10px':'5px 14px',borderRadius:6,
            fontFamily:T.fontSans,fontSize:compact?11:12,
            fontWeight:active?600:400,cursor:'pointer',transition:'all 0.12s',
            background:active?T.card:'transparent',
            color:active?s.color:T.muted,
            border:active?`1px solid ${s.color}44`:'1px solid transparent',
            whiteSpace:'nowrap',
          }}>{s.label}</button>
        )
      })}
    </div>
  )
}

export function ProgressBar({ value, max, color, height=5 }) {
  const pct = Math.min(100,(value/max)*100)
  return (
    <div style={{background:T.surface,borderRadius:height,height,overflow:'hidden'}}>
      <div style={{width:pct+'%',height:'100%',borderRadius:height,background:color||T.accent,transition:'width 0.4s ease'}}/>
    </div>
  )
}

export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active||!payload?.length) return null
  return (
    <div style={{background:T.card,border:`1px solid ${T.borderMid}`,borderRadius:8,padding:'10px 14px',fontFamily:T.fontMono,fontSize:11,boxShadow:'0 8px 24px rgba(0,0,0,0.6)'}}>
      {label&&<div style={{color:T.muted,marginBottom:6,fontSize:10}}>{label}</div>}
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||T.text,marginBottom:2,display:'flex',gap:8,justifyContent:'space-between'}}>
          <span style={{color:T.muted}}>{p.name}:</span>
          <span style={{fontWeight:500}}>{formatter?formatter(p.value,p.name):p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Btn({ children, onClick, variant='default', disabled, style }) {
  const v = {
    default:{background:T.surface,color:T.textMid,border:`1px solid ${T.border}`},
    accent: {background:T.accent,color:'#fff',border:'none',fontWeight:600},
    ghost:  {background:'transparent',color:T.muted,border:`1px solid ${T.border}`},
    danger: {background:T.redDim,color:T.red,border:`1px solid ${T.red}33`},
    success:{background:T.greenDim,color:T.green,border:`1px solid ${T.green}33`},
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...v[variant],borderRadius:7,padding:'7px 14px',
      fontFamily:T.fontSans,fontSize:12,fontWeight:500,
      cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,
      transition:'all 0.12s',whiteSpace:'nowrap',...style,
    }}>{children}</button>
  )
}

export function Input({ value, onChange, placeholder, type='text', style }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
      background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,
      padding:'8px 12px',color:T.text,fontFamily:T.fontSans,fontSize:13,
      outline:'none',width:'100%',transition:'border-color 0.15s',...style,
    }}/>
  )
}

export function Select({ value, onChange, options, style }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={{
      background:T.card,border:`1px solid ${T.border}`,borderRadius:7,
      padding:'7px 12px',color:T.text,fontFamily:T.fontSans,fontSize:12,
      cursor:'pointer',outline:'none',...style,
    }}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  )
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{display:'flex',gap:2,background:T.surface,borderRadius:8,padding:3,border:`1px solid ${T.border}`}}>
      {tabs.map(tab=>{
        const isActive=active===tab.id
        return (
          <button key={tab.id} onClick={()=>onChange(tab.id)} style={{
            padding:'5px 14px',borderRadius:6,fontFamily:T.fontSans,fontSize:12,
            fontWeight:isActive?600:400,cursor:'pointer',transition:'all 0.12s',
            background:isActive?T.card:'transparent',
            color:isActive?T.text:T.muted,
            border:isActive?`1px solid ${T.border}`:'1px solid transparent',
            whiteSpace:'nowrap',
          }}>
            {tab.icon&&<span style={{marginRight:5}}>{tab.icon}</span>}{tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ size=24, color }) {
  return (
    <div style={{
      width:size,height:size,borderRadius:'50%',
      border:`2px solid ${T.border}`,borderTopColor:color||T.accent,
      animation:'spin 0.7s linear infinite',
    }}/>
  )
}

export function Empty({ icon, title, sub, action }) {
  return (
    <div style={{textAlign:'center',padding:'48px 24px'}}>
      <div style={{fontSize:36,marginBottom:14,opacity:0.3}}>{icon||'📊'}</div>
      <div style={{fontSize:15,fontWeight:600,marginBottom:8,color:T.text}}>{title}</div>
      <div style={{fontSize:12,color:T.muted,marginBottom:20,lineHeight:1.6}}>{sub}</div>
      {action}
    </div>
  )
}

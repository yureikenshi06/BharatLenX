import { useState } from 'react'
import { THEME as T } from '../lib/theme'
import { fmt, fmtDate } from '../lib/data'
import { Card, SectionHead, Btn, Input } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/supabase'
import { loadKeys, clearKeys } from '../hooks/useTrades'

export default function SettingsPage({ trades, stats, activeStats, onConnectFyers, onLoadDemo, onDisconnect, source, error: hookError, progress, savedKeys }) {
  const { user }     = useAuth()
  const [clientId,   setClientId]   = useState(savedKeys?.clientId || '')
  const [token,      setToken]      = useState(savedKeys?.token    || '')
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState('')
  const [showToken,  setShowToken]  = useState(false)

  const handleConnect = async () => {
    setMsg('')
    setSaving(true)
    const res = await onConnectFyers(clientId, token)
    if (res?.success) setMsg(`✓ Loaded ${res.count} trades!`)
    else if (res?.demo) setMsg('⚠ Showing demo data — see error above.')
    setSaving(false)
  }

  const exportCSV = () => {
    const st = activeStats || {}
    const rows = [
      'id,symbol,segment,side,qty,price,exitPrice,pnl,fee,equity,exchange,productType,time',
      ...(trades||[]).map(t=>[
        t.id,t.symbol,t.segment,t.side,t.qty,t.price,
        t.exitPrice||'',t.pnl,t.fee,t.equity,
        t.exchange||'',t.productType||'',
        new Date(t.time).toISOString()
      ].join(','))
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv,'+encodeURIComponent(rows)
    a.download = `markettrak_export_${Date.now()}.csv`
    a.click()
  }

  const STEPS = [
    {
      n:'01', title:'Supabase Setup (Free)',
      items:['supabase.com → New Project','Run SQL from src/lib/supabase.js in SQL Editor','Authentication → Users → Add only YOUR email','Project Settings → API → copy URL + anon key'],
    },
    {
      n:'02', title:'Environment Variables',
      items:['Create .env file in project root','VITE_SUPABASE_URL=https://xxxx.supabase.co','VITE_SUPABASE_ANON_KEY=your_key'],
    },
    {
      n:'03', title:'Deploy to Netlify (Free)',
      items:['Push to GitHub (private repo)','netlify.com → New Site → connect repo','Build: npm run build  |  Publish: dist','Add env vars in Netlify → Site Settings → Environment'],
    },
    {
      n:'04', title:'For AI Analysis Feature',
      items:['Get API key from console.anthropic.com','Add ANTHROPIC_API_KEY to Netlify environment','Run locally: netlify dev (installs Netlify CLI first)','AI feature calls /.netlify/functions/ai proxy'],
    },
  ]

  const st = activeStats || {}

  return (
    <div style={{ padding:'28px 32px', maxWidth:860, fontFamily:T.fontSans }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:9, color:T.accent, letterSpacing:3, textTransform:'uppercase', marginBottom:6 }}>Configuration</div>
        <div style={{ fontSize:30, fontWeight:800, fontFamily:T.fontDisplay }}>Settings</div>
      </div>

      {/* Account */}
      <Card style={{ marginBottom:14 }}>
        <SectionHead title="Account" sub="Authentication"/>
        {user ? (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:3 }}>Signed in as</div>
              <div style={{ fontWeight:700 }}>{user.email}</div>
              <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>UID: {user.id?.slice(0,16)}...</div>
            </div>
            <Btn variant="danger" onClick={signOut}>Sign Out</Btn>
          </div>
        ) : (
          <div style={{ color:T.muted, fontSize:12 }}>Not signed in — running in demo mode. Journal saved locally only.</div>
        )}
      </Card>

      {/* Fyers Connection */}
      <Card style={{ marginBottom:14 }}>
        <SectionHead title="Fyers API Connection" sub="Live Trade Data"/>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            background:source==='fyers'?T.greenDim:T.accentDim,
            border:`1px solid ${source==='fyers'?T.green:T.accent}44`,
            borderRadius:8, padding:'7px 14px', fontSize:11,
            color:source==='fyers'?T.green:T.accent,
          }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:source==='fyers'?T.green:T.accent }}/>
            {source==='fyers'?`Fyers Live (${(trades||[]).length} trades)`:'Demo Mode'}
          </div>
          {source==='fyers'&&<Btn onClick={onLoadDemo} style={{ fontSize:11,padding:'5px 12px' }}>Switch to Demo</Btn>}
        </div>

        {/* How to get token */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:'14px', marginBottom:14, borderLeft:`3px solid ${T.accent}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.accent, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>How to connect Fyers</div>
          <ol style={{ fontSize:11, color:T.textMid, lineHeight:2, paddingLeft:18 }}>
            <li>Go to <span style={{ color:T.accent, fontFamily:T.fontMono }}>myapi.fyers.in</span> → Log in with your Fyers account</li>
            <li>Create an App → Note your <strong style={{ color:T.text }}>App ID</strong> (e.g. <code style={{ color:T.cyan, background:T.surface, padding:'1px 5px', borderRadius:3 }}>XJ12345-100</code>)</li>
            <li>Generate an <strong style={{ color:T.text }}>Access Token</strong> via Fyers SDK or API playground</li>
            <li>Paste App ID + token below — tokens expire daily, re-paste each morning</li>
          </ol>
          <div style={{ marginTop:8, fontSize:10, color:T.muted }}>
            Permissions needed: <span style={{ fontFamily:T.fontMono, color:T.textMid }}>orders:read, positions:read, trades:read</span>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:'uppercase', marginBottom:5 }}>App ID (Client ID)</div>
            <Input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="e.g. XJ12345-100"/>
          </div>
          <div>
            <div style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:'uppercase', marginBottom:5 }}>
              Access Token
              <button onClick={()=>setShowToken(s=>!s)} style={{ marginLeft:8, background:'none', border:'none', color:T.accent, cursor:'pointer', fontSize:10, fontFamily:T.fontMono }}>
                {showToken?'hide':'show'}
              </button>
            </div>
            <Input type={showToken?'text':'password'} value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste your daily access token here"/>
          </div>
          <Btn variant="accent" onClick={handleConnect} disabled={saving||!clientId||!token} style={{ padding:'10px', fontSize:13 }}>
            {saving?(progress||'Connecting...'):'⚡ Connect to Fyers'}
          </Btn>
        </div>

        {progress&&saving&&<div style={{ fontSize:12,color:T.accent,padding:'8px 12px',background:T.accentDim,borderRadius:7,marginBottom:8 }}>⏳ {progress}</div>}
        {hookError&&<div style={{ fontSize:12,color:T.red,padding:'10px 14px',background:T.redDim,border:`1px solid ${T.red}33`,borderRadius:8,marginBottom:8,lineHeight:1.6 }}>⚠ {hookError}</div>}
        {msg&&!hookError&&<div style={{ fontSize:12,color:T.green,padding:'8px 12px',background:T.greenDim,border:`1px solid ${T.green}33`,borderRadius:7,marginBottom:8 }}>{msg}</div>}

        {savedKeys&&(
          <div style={{ padding:'10px 14px',background:T.greenDim,border:`1px solid ${T.green}33`,borderRadius:8,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div style={{ fontSize:12,color:T.green }}>✓ Token saved for this session — auto-connects on return</div>
            <button onClick={onDisconnect} style={{ background:'none',border:`1px solid ${T.red}44`,color:T.red,borderRadius:5,padding:'3px 10px',cursor:'pointer',fontFamily:T.fontSans,fontSize:11 }}>
              Clear
            </button>
          </div>
        )}

        <div style={{ padding:'12px 14px',background:T.surface,borderRadius:10,fontSize:11,color:T.muted,lineHeight:1.8,borderLeft:`3px solid ${T.green}` }}>
          <div style={{ fontWeight:700,color:T.green,marginBottom:4 }}>✓ Secure — token stays in your browser</div>
          <div>Token is stored in <strong style={{ color:T.textMid }}>sessionStorage</strong> — cleared when browser closes. Never sent to any server except Fyers.</div>
        </div>
      </Card>

      {/* Data Summary */}
      <Card style={{ marginBottom:14 }}>
        <SectionHead title="Data Summary" sub="Current Session"/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
          {[
            { l:'Trades',   v:(trades||[]).length },
            { l:'Instruments', v:[...new Set((trades||[]).map(t=>t.symbol))].length },
            { l:'From',     v:(trades||[]).length?fmtDate(Math.min(...(trades||[]).map(t=>t.time))):'—' },
            { l:'Net P&L',  v:((st.netPnL||0)>=0?'+₹':'-₹')+fmt(Math.abs(st.netPnL||0)) },
          ].map(r=>(
            <div key={r.l} style={{ background:T.surface, borderRadius:9, padding:'12px 14px' }}>
              <div style={{ fontSize:9, color:T.muted, letterSpacing:1.5, textTransform:'uppercase', marginBottom:4 }}>{r.l}</div>
              <div style={{ fontSize:16, fontWeight:700, fontFamily:T.fontDisplay }}>{r.v}</div>
            </div>
          ))}
        </div>
        <Btn variant="success" onClick={exportCSV} style={{ padding:'10px 20px' }}>↓ Export CSV ({(trades||[]).length} trades)</Btn>
      </Card>

      {/* Deployment Guide */}
      <Card>
        <SectionHead title="Deployment Guide" sub="Free Hosting in 10 min"/>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {STEPS.map(s=>(
            <div key={s.n} style={{ display:'flex', gap:16 }}>
              <div style={{
                width:34, height:34, borderRadius:8,
                background:T.accentDim, border:`1px solid ${T.accent}44`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontWeight:800, color:T.accent, fontSize:12, flexShrink:0,
              }}>{s.n}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:T.text, marginBottom:7 }}>{s.title}</div>
                {s.items.map((item,i)=>(
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:4 }}>
                    <span style={{ color:T.accent, fontSize:10, flexShrink:0, marginTop:2 }}>›</span>
                    <span style={{ fontSize:12, color:T.muted, lineHeight:1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

import { useState, useRef } from 'react'
import { THEME as T } from '../lib/theme'
import { fmt, fmtDate } from '../lib/data'
import { Card, SectionHead, Btn, Input } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/supabase'
import { loadCreds, saveCreds } from '../hooks/useTrades'
import { detectFileType } from '../lib/csvImport'

const ENV_APP_ID   = import.meta.env.VITE_FYERS_APP_ID      || ''
const ENV_SECRET   = import.meta.env.VITE_FYERS_SECRET_KEY  || ''
const ENV_REDIRECT = import.meta.env.VITE_FYERS_REDIRECT_URI || (typeof window!=='undefined' ? window.location.origin : '')

const FILE_TYPE_INFO = {
  tradebook: {
    label: 'Tradebook ✓',
    color: T => T.green,
    note:  'Best file — contains all trade details with segment info. P&L calculated via FIFO.',
  },
  orderbook: {
    label: 'Orderbook',
    color: T => T.blue,
    note:  'Contains order history. Use Tradebook if available for more accurate results.',
  },
  global_pnl: {
    label: 'Global P&L Report',
    color: T => T.purple,
    note:  'Per-instrument realized P&L summary. Saved as reference — no individual trades.',
  },
  ledger: {
    label: 'Ledger Report',
    color: T => T.cyan,
    note:  'Fund deposits and withdrawals. Saved to Capital Flow tracker.',
  },
  unknown: {
    label: 'Unknown file',
    color: T => T.red,
    note:  'Could not identify file type. Make sure it is a Fyers CSV export.',
  },
}

export default function SettingsPage({
  trades, activeStats,
  onConnect, onPasteToken, onImportCSV,
  onLoadDemo, onDisconnect,
  source, error: hookError, progress,
  tokenInfo, csvImporting, csvResult, rawApiSample, userId,
}) {
  const { user } = useAuth()
  const fileRef  = useRef(null)

  const saved = loadCreds()
  const [appId,       setAppId]       = useState(saved?.appId       || ENV_APP_ID)
  const [secretKey,   setSecretKey]   = useState(saved?.secretKey   || ENV_SECRET)
  const [redirectUri, setRedirectUri] = useState(saved?.redirectUri || ENV_REDIRECT)
  const [redirectUrl, setRedirectUrl] = useState(null)

  const [pasteClientId, setPasteClientId] = useState(tokenInfo?.clientId || '')
  const [pasteToken_,   setPasteToken_]   = useState('')
  const [showTok,       setShowTok]       = useState(false)
  const [pasteSaving,   setPasteSaving]   = useState(false)
  const [pasteMsg,      setPasteMsg]      = useState('')

  const [dragOver,      setDragOver]      = useState(false)
  const [previewType,   setPreviewType]   = useState(null) // detected type before import

  const updateCreds = (field, val) => {
    const u = { appId, secretKey, redirectUri, [field]: val }
    if (u.appId && u.secretKey) saveCreds(u.appId, u.secretKey, u.redirectUri)
    if (field==='appId')       setAppId(val)
    if (field==='secretKey')   setSecretKey(val)
    if (field==='redirectUri') setRedirectUri(val)
  }

  const handleGenerateUrl = async () => {
    const res = await onConnect(appId, secretKey, redirectUri)
    if (res?.redirectUrl) setRedirectUrl(res.redirectUrl)
  }

  const handlePaste = async () => {
    setPasteSaving(true); setPasteMsg('')
    const res = await onPasteToken(pasteClientId, pasteToken_)
    if (res?.success) setPasteMsg('✓ Connected')
    else if (hookError) setPasteMsg('')
    setPasteSaving(false)
  }

  // Preview file type before importing
  const handleFilePick = async (file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) { alert('Please select a .csv file'); return }
    const text = await file.text()
    const type = detectFileType(text)
    setPreviewType({ type, name: file.name, file })
  }

  const handleImport = () => {
    if (previewType?.file) {
      onImportCSV(previewType.file)
      setPreviewType(null)
    }
  }

  const exportCSV = () => {
    const rows = [
      'id,symbol,segment,side,qty,price,pnl,fee,exchange,productType,time',
      ...(trades||[]).map(t=>[
        t.id,t.symbol,t.segment,t.side,t.qty,t.price,t.pnl,t.fee,
        t.exchange||'',t.productType||'',new Date(t.time).toISOString()
      ].join(','))
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv,' + encodeURIComponent(rows)
    a.download = `bharatlenx_export_${Date.now()}.csv`
    a.click()
  }

  const st = activeStats || {}
  const tokenExpiry = tokenInfo?.expiresAt
    ? new Date(tokenInfo.expiresAt).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
    : null
  const hoursLeft = tokenInfo?.expiresAt ? Math.max(0, Math.round((tokenInfo.expiresAt - Date.now()) / 3600000)) : 0

  const csvTrades = (trades||[]).filter(t=>t.source==='csv').length
  const apiTrades = (trades||[]).filter(t=>t.source==='fyers_api').length

  return (
    <div style={{ padding:'28px 32px', maxWidth:900, fontFamily:T.fontSans }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:9, color:T.accent, letterSpacing:3, textTransform:'uppercase', marginBottom:6 }}>Configuration</div>
        <div style={{ fontSize:30, fontWeight:800 }}>Settings</div>
      </div>

      {/* Account */}
      <Card style={{ marginBottom:14 }}>
        <SectionHead title="Account" sub="Authentication"/>
        {user ? (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>{user.email}</div>
              <div style={{ fontSize:10, color:T.green, marginTop:4 }}>✓ Signed in — trades synced across all devices</div>
            </div>
            <Btn variant="danger" onClick={signOut}>Sign Out</Btn>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:12, color:T.muted, lineHeight:1.7, marginBottom:8 }}>
              Not signed in. <strong style={{ color:T.orange }}>Trades are saved locally on this device only.</strong> Sign in to Supabase to sync across all your devices.
            </div>
            <div style={{ fontSize:11, color:T.muted }}>To sign in, go to the Login page from your Supabase auth setup.</div>
          </div>
        )}
      </Card>

      {/* ── IMPORT CSV ── */}
      <Card style={{ marginBottom:14 }} glow>
        <SectionHead title="Import Fyers CSV" sub="Step 1 — Historical Trade Data"/>

        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:'12px 14px', marginBottom:14, borderLeft:`3px solid ${T.accent}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.accent, marginBottom:6 }}>Which CSV files to upload?</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { type:'tradebook', desc:'Tradebook — best choice, has all trades with segment & value' },
              { type:'global_pnl', desc:'Global P&L — per-instrument realized P&L summary' },
              { type:'orderbook', desc:'Orderbook — use only if Tradebook not available' },
              { type:'ledger', desc:'Ledger — fund deposits & withdrawals for Capital tracker' },
            ].map(item => {
              const info = FILE_TYPE_INFO[item.type]
              return (
                <div key={item.type} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:info.color(T), flexShrink:0, marginTop:3 }}/>
                  <span style={{ fontSize:11, color:T.textMid, lineHeight:1.5 }}>{item.desc}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop:8, fontSize:10, color:T.muted }}>
            Download from: <strong style={{ color:T.text }}>Fyers Web/App → Reports → [Tradebook / Order Book / Global P&L / Ledger] → Download CSV</strong>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e=>{e.preventDefault();setDragOver(true)}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);handleFilePick(e.dataTransfer.files[0])}}
          onClick={()=>fileRef.current?.click()}
          style={{
            border:`2px dashed ${dragOver?T.accent:T.border}`,
            borderRadius:10, padding:'28px 24px', textAlign:'center',
            cursor:'pointer', transition:'all 0.15s',
            background:dragOver?T.accentDim:T.surface, marginBottom:12,
          }}
        >
          <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}}
            onChange={e=>handleFilePick(e.target.files[0])} onClick={e=>{e.target.value=''}}/>
          <div style={{ fontSize:26, marginBottom:8, opacity:0.4 }}>📂</div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>
            {csvImporting ? '⏳ Importing...' : 'Drop Fyers CSV here or click to browse'}
          </div>
          <div style={{ fontSize:11, color:T.muted }}>Tradebook · Orderbook · Global P&L · Ledger</div>
        </div>

        {/* File preview before import */}
        {previewType && !csvImporting && (
          <div style={{ background:T.surface, border:`1px solid ${FILE_TYPE_INFO[previewType.type]?.color(T) || T.border}44`, borderRadius:8, padding:'14px', marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:FILE_TYPE_INFO[previewType.type]?.color(T)||T.text, marginBottom:4 }}>
                  {FILE_TYPE_INFO[previewType.type]?.label || previewType.type} · {previewType.name}
                </div>
                <div style={{ fontSize:11, color:T.muted, lineHeight:1.6 }}>
                  {FILE_TYPE_INFO[previewType.type]?.note}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginLeft:16, flexShrink:0 }}>
                <Btn variant="accent" onClick={handleImport} style={{ padding:'7px 16px', fontSize:12 }}>Import ✓</Btn>
                <Btn variant="ghost" onClick={()=>setPreviewType(null)} style={{ padding:'7px 12px', fontSize:12 }}>Cancel</Btn>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {csvImporting && progress && (
          <div style={{ background:T.accentDim, border:`1px solid ${T.accent}33`, borderRadius:8, padding:'10px 14px', marginBottom:10, fontSize:12, color:T.accent }}>
            ⏳ {progress}
          </div>
        )}

        {/* Import result */}
        {csvResult && !csvImporting && (
          <div style={{ background:T.greenDim, border:`1px solid ${T.green}44`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.green, marginBottom:10 }}>
              ✓ {csvResult.fileType} imported successfully
            </div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginBottom:8 }}>
              {csvResult.imported > 0 && <span style={{ fontSize:12, color:T.textMid }}>📊 {csvResult.imported} {csvResult.fileType.includes('P&L')?'instruments':'trades'}</span>}
              {csvResult.from && <span style={{ fontSize:12, color:T.muted }}>{csvResult.from} → {csvResult.to}</span>}
              {csvResult.symbols > 0 && !csvResult.fileType.includes('P&L') && <span style={{ fontSize:12, color:T.muted }}>{csvResult.symbols} instruments</span>}
            </div>
            {csvResult.note && <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>{csvResult.note}</div>}
            <div style={{ fontSize:11, color:T.textMid }}>
              💾 {csvResult.savedTo}
            </div>
            <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>
              You can upload multiple CSVs (different date ranges or file types) — duplicates are skipped automatically.
            </div>
          </div>
        )}

        {hookError && !csvImporting && (
          <div style={{ marginTop:8, background:T.redDim, border:`1px solid ${T.red}33`, borderRadius:8, padding:'10px 14px', fontSize:12, color:T.red }}>⚠ {hookError}</div>
        )}
      </Card>

      {/* ── DAILY API SYNC ── */}
      <Card style={{ marginBottom:14 }}>
        <SectionHead title="Daily API Sync" sub="Step 2 — Connect Fyers"/>
        <div style={{ fontSize:12, color:T.muted, lineHeight:1.8, marginBottom:12 }}>
          Connect Fyers API to automatically sync today's new trades every time you open the app.
        </div>

        {tokenInfo && (
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:T.greenDim, border:`1px solid ${T.green}33`, borderRadius:8, padding:'7px 14px', fontSize:12, color:T.green, fontWeight:600 }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:T.green }}/>✓ Fyers Connected
            </div>
            {tokenExpiry && (
              <span style={{ fontSize:11, color:hoursLeft<2?T.red:T.muted }}>
                Expires: {tokenExpiry}{hoursLeft<2?' ⚠ Reconnect soon':` (${hoursLeft}h left)`}
              </span>
            )}
            <Btn onClick={onDisconnect} variant="danger" style={{ fontSize:11, marginLeft:'auto' }}>Disconnect</Btn>
          </div>
        )}

        {progress && !csvImporting && (
          <div style={{ marginBottom:10, background:T.accentDim, border:`1px solid ${T.accent}33`, borderRadius:7, padding:'8px 12px', fontSize:12, color:T.accent }}>⏳ {progress}</div>
        )}

        {/* OAuth */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:'14px', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:600, marginBottom:10 }}>OAuth Login (recommended)</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>App ID</div>
              <Input value={appId} onChange={e=>updateCreds('appId',e.target.value)} placeholder="e.g. JHBKBLSUHB-100"/>
            </div>
            <div>
              <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>Secret Key</div>
              <Input type="password" value={secretKey} onChange={e=>updateCreds('secretKey',e.target.value)} placeholder="Your app secret"/>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>Redirect URI</div>
            <Input value={redirectUri} onChange={e=>updateCreds('redirectUri',e.target.value)} placeholder="https://yourapp.netlify.app"/>
            <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>Current: <span style={{ color:T.accent, fontFamily:T.fontMono }}>{typeof window!=='undefined'?window.location.origin:''}</span></div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <Btn variant="accent" onClick={handleGenerateUrl} disabled={!appId||!secretKey} style={{ padding:'9px 18px' }}>🔑 Get Login URL</Btn>
            {redirectUrl && <Btn variant="success" onClick={()=>window.location.href=redirectUrl} style={{ padding:'9px 18px' }}>→ Open Fyers Login</Btn>}
          </div>
          {redirectUrl && (
            <div style={{ marginTop:8, fontSize:10, color:T.muted, wordBreak:'break-all', fontFamily:T.fontMono, background:T.card, padding:'7px 10px', borderRadius:6, border:`1px solid ${T.border}` }}>
              {redirectUrl}
            </div>
          )}
        </div>

        {/* Paste token */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:'14px' }}>
          <div style={{ fontSize:11, fontWeight:600, marginBottom:10 }}>Paste Token (backup)</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>Client ID</div>
              <Input value={pasteClientId} onChange={e=>setPasteClientId(e.target.value)} placeholder="e.g. JHBKBLSUHB-100"/>
            </div>
            <div>
              <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>
                Token <button onClick={()=>setShowTok(s=>!s)} style={{marginLeft:6,background:'none',border:'none',color:T.accent,cursor:'pointer',fontSize:10}}>{showTok?'hide':'show'}</button>
              </div>
              <Input type={showTok?'text':'password'} value={pasteToken_} onChange={e=>setPasteToken_(e.target.value)} placeholder="Paste access token"/>
            </div>
          </div>
          <Btn onClick={handlePaste} disabled={pasteSaving||!pasteClientId||!pasteToken_} style={{ padding:'8px 16px', fontSize:12 }}>
            {pasteSaving?(progress||'Connecting...'):'⚡ Connect'}
          </Btn>
          {pasteMsg && <span style={{ marginLeft:10, fontSize:12, color:T.green }}>{pasteMsg}</span>}
        </div>
      </Card>

      {/* ── Data Summary ── */}
      <Card style={{ marginBottom:14 }}>
        <SectionHead title="Trade History" sub="Summary"/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
          {[
            { l:'Total Trades',  v:(trades||[]).length,                                            c:T.accent },
            { l:'From CSV',      v:csvTrades,                                                       c:T.blue   },
            { l:'From API',      v:apiTrades,                                                       c:T.purple },
            { l:'Instruments',   v:[...new Set((trades||[]).map(t=>t.symbol))].length,              c:T.cyan   },
            { l:'Net P&L',       v:((st.netPnL||0)>=0?'+₹':'-₹')+fmt(Math.abs(st.netPnL||0)),     c:(st.netPnL||0)>=0?T.green:T.red },
          ].map(r=>(
            <div key={r.l} style={{ background:T.surface, borderRadius:9, padding:'11px 14px' }}>
              <div style={{ fontSize:9, color:T.muted, letterSpacing:1.5, textTransform:'uppercase', marginBottom:4 }}>{r.l}</div>
              <div style={{ fontSize:16, fontWeight:700, color:r.c }}>{r.v}</div>
            </div>
          ))}
        </div>
        {(trades||[]).length>0 && (
          <Btn variant="success" onClick={exportCSV} style={{ padding:'9px 18px' }}>↓ Export CSV</Btn>
        )}
      </Card>

      {/* Debug */}
      {rawApiSample && (
        <Card style={{ marginBottom:14 }}>
          <SectionHead title="API Debug" sub="Raw Fyers response"/>
          <pre style={{ background:T.surface, borderRadius:8, padding:'10px', fontFamily:T.fontMono, fontSize:10, color:T.textMid, overflowX:'auto', border:`1px solid ${T.border}`, maxHeight:160, overflowY:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all', lineHeight:1.7 }}>
            {JSON.stringify(rawApiSample, null, 2)}
          </pre>
        </Card>
      )}

      {/* SQL */}
      <Card>
        <SectionHead title="Supabase SQL" sub="Run once to create tables"/>
        <pre style={{ background:T.surface, borderRadius:8, padding:'14px', fontFamily:T.fontMono, fontSize:10, color:T.textMid, overflowX:'auto', border:`1px solid ${T.border}`, lineHeight:1.8 }}>{`-- Trades table (stores all trades from CSV + API)
create table trades (
  id text primary key,
  user_id uuid references auth.users not null,
  symbol text, segment text, side text,
  qty numeric, price numeric,
  pnl numeric default 0, fee numeric default 0,
  equity numeric default 100000,
  exchange text, product_type text,
  trade_time timestamptz,
  source text default 'csv', raw_id text,
  created_at timestamptz default now()
);
alter table trades enable row level security;
create policy "own" on trades for all using (auth.uid() = user_id);
create index trades_user_time on trades(user_id, trade_time);

-- Fyers tokens (cross-device sync)
create table fyers_tokens (
  user_id uuid primary key references auth.users,
  client_id text, access_token text,
  expires_at timestamptz, updated_at timestamptz default now()
);
alter table fyers_tokens enable row level security;
create policy "own" on fyers_tokens for all using (auth.uid() = user_id);`}
        </pre>
      </Card>
    </div>
  )
}

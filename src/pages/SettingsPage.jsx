import { useState, useEffect } from 'react'
import { THEME as T } from '../lib/theme'
import { fmt, fmtDate } from '../lib/data'
import { Card, SectionHead, Btn, Input } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/supabase'
import { loadCreds, saveCreds, exchangeAuthCode, clearTokenLocal } from '../hooks/useTrades'
import { supabase } from '../lib/supabase'

// These are bridged from both VITE_FYERS_* and FYERS_* via vite.config.js
const ENV_APP_ID   = import.meta.env.VITE_FYERS_APP_ID       || ''
const ENV_SECRET   = import.meta.env.VITE_FYERS_SECRET_KEY   || ''
const ENV_REDIRECT = import.meta.env.VITE_FYERS_REDIRECT_URI || 'https://www.google.com'
const CREDS_FROM_ENV = !!(ENV_APP_ID && ENV_SECRET)

export default function SettingsPage({
  trades, activeStats,
  onConnect, onPasteToken, onManualSync, onDisconnect,
  source, error: hookError, progress, syncing,
  tokenInfo, fyersConnected, syncStatus,
}) {
  const { user } = useAuth()

  // Creds — always loaded from env vars (set in Netlify), no need to type them
  const saved = loadCreds()
  const [appId,       setAppId]       = useState(ENV_APP_ID   || saved?.appId       || '')
  const [secretKey,   setSecretKey]   = useState(ENV_SECRET   || saved?.secretKey   || '')
  const [redirectUri, setRedirectUri] = useState(ENV_REDIRECT || saved?.redirectUri || 'https://www.google.com')
  const [redirectUrl, setRedirectUrl] = useState(null)


  // Auth code — accepts full redirect URL OR bare code; extracts auth_code automatically
  const [authCode,      setAuthCode]      = useState('')
  const [authCodeMsg,   setAuthCodeMsg]   = useState('')
  const [authCodeBusy,  setAuthCodeBusy]  = useState(false)

  const extractAuthCode = (raw) => {
    raw = (raw || '').trim()
    if (raw.startsWith('http')) {
      try {
        const url = new URL(raw)
        return url.searchParams.get('auth_code') || url.searchParams.get('code') || raw
      } catch { return raw }
    }
    return raw
  }

  const handleAuthCodeExchange = async () => {
    const code = extractAuthCode(authCode)
    if (!code || !appId || !secretKey) {
      setAuthCodeMsg('Paste the full redirect URL or the auth_code below.')
      return
    }
    setAuthCodeBusy(true); setAuthCodeMsg('')
    try {
      // Client ID auto-filled from saved App ID — no manual entry needed
      const { accessToken, clientId } = await exchangeAuthCode(appId, secretKey, code)
      const res = await onPasteToken(clientId, accessToken)
      if (!res?.error) {
        setAuthCodeMsg('✓ Connected! Trade sync started in background...')
        setAuthCode('')
      }
    } catch (e) {
      setAuthCodeMsg(`Failed: ${e.message}`)
    }
    setAuthCodeBusy(false)
  }

  // Save creds on change
  const updateCreds = (field, val) => {
    const u = { appId, secretKey, redirectUri, [field]: val }
    if (u.appId && u.secretKey) saveCreds(u.appId, u.secretKey, u.redirectUri)
    if (field === 'appId')       setAppId(val)
    if (field === 'secretKey')   setSecretKey(val)
    if (field === 'redirectUri') setRedirectUri(val)
  }

  const handleGenerateUrl = async () => {
    const res = await onConnect(appId, secretKey, redirectUri)
    if (res?.redirectUrl) setRedirectUrl(res.redirectUrl)
  }


  const exportCSV = () => {
    const rows = [
      'id,symbol,segment,side,qty,price,pnl,fee,exchange,productType,time',
      ...(trades || []).map(t => [
        t.id, t.symbol, t.segment, t.side, t.qty, t.price, t.pnl, t.fee,
        t.exchange || '', t.productType || '', new Date(t.time).toISOString()
      ].join(','))
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv,' + encodeURIComponent(rows)
    a.download = `bharatlenx_trades_${Date.now()}.csv`
    a.click()
  }

  const st = activeStats || {}
  const tokenExpiry = tokenInfo?.expiresAt
    ? new Date(tokenInfo.expiresAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const hoursLeft = tokenInfo?.expiresAt
    ? Math.max(0, Math.round((tokenInfo.expiresAt - Date.now()) / 3600000))
    : 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, fontFamily: T.fontSans }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: T.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Configuration</div>
        <div style={{ fontSize: 30, fontWeight: 800 }}>Settings</div>
      </div>

      {/* ── Account ── */}
      <Card style={{ marginBottom: 14 }}>
        <SectionHead title="Account" sub="Supabase Auth"/>
        {user ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user.email}</div>
              <div style={{ fontSize: 10, color: T.green, marginTop: 4 }}>
                ✓ Signed in — trades synced across all your devices
              </div>
            </div>
            <Btn variant="danger" onClick={signOut}>Sign Out</Btn>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
            <span style={{ color: T.orange, fontWeight: 600 }}>Not signed in</span> — trades saved on this device only.
            Sign in via the Login page to sync across devices.
          </div>
        )}
      </Card>

      {/* ── Live Sync Status ── */}
      <Card style={{ marginBottom: 14 }}>
        <SectionHead title="Fyers Connection" sub="Auto-sync status"/>

        {fyersConnected ? (
          <div>
            {/* Connected banner */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: T.greenDim, border: `1px solid ${T.green}44`,
                borderRadius: 8, padding: '8px 16px', fontSize: 12, color: T.green, fontWeight: 600,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, animation: syncing ? 'pulse 1.4s ease-in-out infinite' : 'none' }}/>
                {syncing ? 'Syncing...' : '✓ Fyers Live'}
              </div>
              {tokenExpiry && (
                <div style={{ fontSize: 11, color: hoursLeft < 2 ? T.red : T.muted }}>
                  Token expires: {tokenExpiry}
                  {hoursLeft < 2 && <span style={{ color: T.red, marginLeft: 6, fontWeight: 600 }}>⚠ Reconnect soon</span>}
                </div>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <Btn onClick={onManualSync} disabled={syncing} style={{ fontSize: 11 }}>
                  {syncing ? '⟳ Syncing...' : '⟳ Sync Now'}
                </Btn>
                <Btn onClick={onDisconnect} variant="danger" style={{ fontSize: 11 }}>Disconnect</Btn>
              </div>
            </div>

            {/* Sync stats */}
            {syncStatus && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                {[
                  { l: 'Total Trades in DB', v: syncStatus.count,    c: T.accent },
                  { l: 'New Today',          v: syncStatus.newToday, c: T.green  },
                  { l: 'Last Sync',          v: syncStatus.lastSync, c: T.muted  },
                ].map(r => (
                  <div key={r.l} style={{ background: T.surface, borderRadius: 8, padding: '10px 14px', border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>{r.l}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: r.c }}>{r.v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* How sync works */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px', fontSize: 11, color: T.muted, lineHeight: 1.9 }}>
              <div style={{ fontWeight: 600, color: T.text, marginBottom: 4 }}>How auto-sync works</div>
              ✓ Fetches all trade history from Fyers (up to 2 years) on first connect<br/>
              ✓ Refreshes automatically every 5 minutes while the token is active<br/>
              ✓ All trades saved to Supabase — available on any device after sign-in<br/>
              ✓ Token valid for ~24 hours — reconnect each day via Settings
            </div>

            {progress && (
              <div style={{ marginTop: 10, background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 7, padding: '8px 12px', fontSize: 12, color: T.accent }}>
                ⏳ {progress}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
            Not connected. Use one of the methods below to connect your Fyers account.
          </div>
        )}

        {hookError && (
          <div style={{ marginTop: 10, background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: T.red }}>
            ⚠ {hookError}
          </div>
        )}
      </Card>

      {/* ── Method 1: OAuth Login ── */}
      <Card style={{ marginBottom: 14 }} glow={!fyersConnected}>
        <SectionHead title="Connect via Fyers OAuth" sub="Two-step process"/>

        {/* Credentials */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>
              App ID <span style={{ color:T.green, fontSize:9 }}>{CREDS_FROM_ENV ? '🔒 from Netlify env' : appId ? '✓ saved' : ''}</span>
            </div>
            <Input value={appId} onChange={e => !CREDS_FROM_ENV && updateCreds('appId', e.target.value)} readOnly={CREDS_FROM_ENV} placeholder="e.g. JHBKBLSUHB-100" style={{ opacity: CREDS_FROM_ENV ? 0.7 : 1 }}/>
          </div>
          <div>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>
              Secret Key <span style={{ color:T.green, fontSize:9 }}>{CREDS_FROM_ENV ? '🔒 from Netlify env' : secretKey ? '✓ saved' : ''}</span>
            </div>
            <Input type="password" value={CREDS_FROM_ENV ? "••••••••••" : secretKey} onChange={e => !CREDS_FROM_ENV && updateCreds('secretKey', e.target.value)} readOnly={CREDS_FROM_ENV} placeholder="Your app secret" style={{ opacity: CREDS_FROM_ENV ? 0.7 : 1 }}/>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>Redirect URI</div>
          <Input value={redirectUri} onChange={e => updateCreds('redirectUri', e.target.value)} placeholder="https://www.google.com"/>
          <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>Must match what you set in myapi.fyers.in exactly</div>
        </div>

        {/* Step 1: Open login URL */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:'14px', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:8 }}>Step 1 — Open Fyers Login Page</div>
          <div style={{ fontSize:11, color:T.muted, marginBottom:10, lineHeight:1.7 }}>
            Click the button below → Fyers login page opens in a new tab → sign in with your Fyers account credentials.
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn variant="accent" onClick={handleGenerateUrl} disabled={!appId || !secretKey} style={{ padding:'9px 18px' }}>
              🔑 Get Login URL
            </Btn>
            {redirectUrl && (
              <Btn variant="success" onClick={() => window.open(redirectUrl, '_blank')} style={{ padding:'9px 18px' }}>
                → Open Fyers Login ↗
              </Btn>
            )}
          </div>
          {redirectUrl && (
            <div style={{ marginTop:10, fontSize:10, color:T.textMid, fontFamily:T.fontMono, wordBreak:'break-all', background:T.card, padding:'7px 10px', borderRadius:6, border:`1px solid ${T.border}` }}>
              {redirectUrl}
            </div>
          )}
        </div>

        {/* Step 2: Paste full redirect URL */}
        <div style={{ background:T.surface, border:`1px solid ${T.accent}33`, borderRadius:8, padding:'14px' }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:6 }}>Step 2 — Paste the full redirect URL</div>
          <div style={{ fontSize:11, color:T.muted, marginBottom:12, lineHeight:1.9, background:T.card, padding:'10px 12px', borderRadius:7, border:`1px solid ${T.border}` }}>
            After Fyers login, your browser redirects to a URL like this:<br/>
            <span style={{ fontFamily:T.fontMono, color:T.textMid, fontSize:10, wordBreak:'break-all' }}>https://www.google.com/?s=ok&code=200&<span style={{ color:T.accent, fontWeight:700 }}>auth_code=eyJ0eXAi...</span>&state=None</span><br/><br/>
            <strong style={{ color:T.text }}>Copy the entire URL</strong> from the address bar and paste it below.
            The auth_code is extracted automatically — no need to find it manually.
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:1.2, marginBottom:5 }}>
              Full Redirect URL (or just the auth_code)
            </div>
            <Input
              value={authCode}
              onChange={e => setAuthCode(e.target.value)}
              placeholder="https://www.google.com/?s=ok&code=200&auth_code=eyJ0eXAi..."
            />
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <Btn
              variant="accent"
              onClick={handleAuthCodeExchange}
              disabled={authCodeBusy || !authCode.trim() || !appId || !secretKey}
              style={{ padding:'9px 20px', fontSize:13 }}
            >
              {authCodeBusy ? '⏳ Exchanging...' : '⚡ Exchange Code & Start Sync'}
            </Btn>
          </div>
          {authCodeMsg && (
            <div style={{ marginTop:10, fontSize:12, color:authCodeMsg.startsWith('✓')?T.green:T.red, fontWeight:600 }}>
              {authCodeMsg}
            </div>
          )}
        </div>
      </Card>

      {/* ── Data Summary ── */}
      <Card style={{ marginBottom: 14 }}>
        <SectionHead title="Trade Data" sub="Current Summary"/>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Total Trades',  v: (trades||[]).length,                                              c: T.accent  },
            { l: 'Instruments',   v: [...new Set((trades||[]).map(t => t.symbol))].length,             c: T.blue    },
            { l: 'Options',       v: (trades||[]).filter(t => t.segment==='options').length,           c: T.purple  },
            { l: 'Equity',        v: (trades||[]).filter(t => t.segment==='equity').length,            c: T.cyan    },
            { l: 'Net P&L',       v: ((st.netPnL||0)>=0?'+₹':'-₹')+fmt(Math.abs(st.netPnL||0)),      c: (st.netPnL||0)>=0?T.green:T.red },
          ].map(r => (
            <div key={r.l} style={{ background: T.surface, borderRadius: 9, padding: '11px 14px' }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{r.l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: r.c }}>{r.v}</div>
            </div>
          ))}
        </div>
        {(trades||[]).length > 0 && (
          <Btn variant="success" onClick={exportCSV} style={{ padding: '9px 18px' }}>
            ↓ Export All Trades CSV
          </Btn>
        )}
      </Card>
</div>
  )
}

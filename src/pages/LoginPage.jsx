import { useState } from 'react'
import { signIn } from '../lib/supabase'
import { THEME as T } from '../lib/theme'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:T.bgDeep, fontFamily:T.fontSans, position:'relative', overflow:'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{ position:'absolute',top:'20%',left:'50%',transform:'translateX(-50%)',width:600,height:600,borderRadius:'50%',background:`radial-gradient(circle,${T.accent}0d 0%,transparent 70%)`,pointerEvents:'none' }}/>
      {/* Grid */}
      <div style={{ position:'absolute',inset:0,opacity:0.035,backgroundImage:`linear-gradient(${T.textMid} 1px,transparent 1px),linear-gradient(90deg,${T.textMid} 1px,transparent 1px)`,backgroundSize:'48px 48px',pointerEvents:'none' }}/>

      <div style={{ width:420, position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontSize:40, marginBottom:10, color:T.accent }}>◈</div>
          <div style={{ fontSize:28, fontWeight:800, fontFamily:T.fontDisplay, letterSpacing:1 }}>
            <span style={{ color:T.accent }}>MARKET</span><span style={{ color:T.muted }}>LENS</span>
          </div>
          <div style={{ fontSize:11, color:T.muted, marginTop:6, letterSpacing:2 }}>
            NSE · BSE · NFO · TRADING JOURNAL
          </div>
        </div>

        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:'32px', boxShadow:`0 0 60px rgba(0,0,0,0.7), inset 0 1px 0 ${T.borderMid}` }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:24, color:T.text }}>Sign in to your account</div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:'uppercase', display:'block', marginBottom:6 }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="your@email.com"
                style={{ width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 14px',color:T.text,fontFamily:T.fontSans,fontSize:13,outline:'none' }}/>
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:'uppercase', display:'block', marginBottom:6 }}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 14px',color:T.text,fontFamily:T.fontSans,fontSize:13,outline:'none' }}/>
            </div>
            {error&&<div style={{ background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:8,padding:'10px 14px',color:T.red,fontSize:12,marginBottom:16 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              width:'100%', background:T.accent, color:'#fff', border:'none', borderRadius:10, padding:'12px',
              fontFamily:T.fontSans, fontWeight:700, fontSize:14,
              cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1,
            }}>
              {loading?'Signing in...':'Sign In →'}
            </button>
          </form>
          <div style={{ marginTop:20, padding:'14px', background:T.surface, borderRadius:8, fontSize:11, color:T.muted, lineHeight:1.7 }}>
            <strong style={{ color:T.textMid }}>Setup required:</strong> Create your account in <span style={{ color:T.accent }}>Supabase Authentication</span> dashboard. See Settings → Deployment Guide.
          </div>
        </div>
      </div>
    </div>
  )
}

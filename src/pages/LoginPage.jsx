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
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#000000', fontFamily: T.fontSans, position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle blue radial glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.accent}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }}/>
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage: `radial-gradient(${T.accent} 1px, transparent 1px)`,
        backgroundSize: '32px 32px', pointerEvents: 'none',
      }}/>

      <div style={{ width: 400, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 36, color: T.accent, marginBottom: 12, lineHeight: 1 }}>◈</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, marginBottom: 6 }}>
            <span style={{ color: T.text }}>BHARAT</span><span style={{ color: T.accent }}>LEN</span><span style={{ color: T.text }}>X</span>
          </div>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: 3, textTransform: 'uppercase' }}>
            Indian F&O · Trading Journal
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: '32px',
          boxShadow: `0 0 0 1px ${T.border}, 0 32px 64px rgba(0,0,0,0.8), inset 0 1px 0 ${T.borderMid}`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, color: T.text }}>Sign in to your account</div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Email</div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: T.surface, border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 13, fontFamily: T.fontSans,
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e  => e.target.style.borderColor = T.border}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Password</div>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: T.surface, border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 13, fontFamily: T.fontSans,
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e  => e.target.style.borderColor = T.border}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 8,
                background: T.redDim, border: `1px solid ${T.red}33`,
                fontSize: 12, color: T.red,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                background: loading ? T.borderMid : T.accent,
                border: 'none', color: '#fff',
                fontSize: 14, fontWeight: 700, fontFamily: T.fontSans,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, opacity 0.15s',
                letterSpacing: 0.5,
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.muted, textAlign: 'center', lineHeight: 1.7 }}>
            Private access only. Contact your administrator<br/>to get an account.
          </div>
        </div>
      </div>
    </div>
  )
}

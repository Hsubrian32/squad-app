import { useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      const user = data.user
      // Check admin role via profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single()

      if (profile?.role !== 'admin') {
        await supabase.auth.signOut()
        setError('Access denied. This dashboard is for Squad admins only.')
        setLoading(false)
        return
      }

      navigate('/dashboard', { replace: true })
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    background: '#0f0f1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  }

  const cardStyle: CSSProperties = {
    background: '#1a1a2e',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
  }

  const logoRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  }

  const logoIconStyle: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#6C63FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: '-1px',
  }

  const titleStyle: CSSProperties = {
    color: '#fff',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  }

  const subtitleStyle: CSSProperties = {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  }

  const headingStyle: CSSProperties = {
    color: '#fff',
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 6,
    letterSpacing: '-0.02em',
  }

  const descStyle: CSSProperties = {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 28,
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    color: '#d1d5db',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: '#0f0f1a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const fieldStyle: CSSProperties = {
    marginBottom: 18,
  }

  const btnStyle: CSSProperties = {
    width: '100%',
    padding: '12px 0',
    background: '#6C63FF',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    marginTop: 8,
    letterSpacing: '0.01em',
    transition: 'background 0.15s',
  }

  const errorStyle: CSSProperties = {
    background: 'rgba(220,38,38,0.15)',
    border: '1px solid rgba(220,38,38,0.3)',
    borderRadius: 8,
    color: '#fca5a5',
    fontSize: 13,
    padding: '10px 14px',
    marginBottom: 18,
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={logoRowStyle}>
          <div style={logoIconStyle}>S</div>
          <div>
            <div style={titleStyle}>Squad</div>
            <div style={subtitleStyle}>Admin Dashboard</div>
          </div>
        </div>

        <h1 style={headingStyle}>Sign in</h1>
        <p style={descStyle}>Enter your admin credentials to continue.</p>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="admin@coterieapp.com"
              required
              autoComplete="email"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#6C63FF'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#6C63FF'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}
            />
          </div>

          <button
            type="submit"
            style={btnStyle}
            disabled={loading}
            onMouseEnter={(e) => {
              if (!loading)
                (e.currentTarget as HTMLButtonElement).style.background = '#5a52e0'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = '#6C63FF'
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState, type CSSProperties, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface LayoutProps {
  children: ReactNode
  adminEmail: string
}

const SIDEBAR_WIDTH = 220

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '▦' },
  { path: '/users', label: 'Users', icon: '👥' },
  { path: '/groups', label: 'Groups', icon: '🫂' },
  { path: '/cycles', label: 'Cycles', icon: '🔄' },
  { path: '/venues', label: 'Venues', icon: '📍' },
  { path: '/feedback', label: 'Feedback', icon: '⭐' },
]

export default function Layout({ children, adminEmail }: LayoutProps) {
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const rootStyle: CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    background: '#f5f5f7',
  }

  const sidebarStyle: CSSProperties = {
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    background: '#1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
  }

  const logoAreaStyle: CSSProperties = {
    padding: '24px 20px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  }

  const logoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
  }

  const logoIconStyle: CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: '#6C63FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: 16,
    letterSpacing: '-1px',
    flexShrink: 0,
  }

  const logoTextStyle: CSSProperties = {
    color: '#fff',
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: '-0.02em',
  }

  const adminBadgeStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: '#6C63FF',
    background: 'rgba(108,99,255,0.15)',
    borderRadius: 4,
    padding: '1px 6px',
    marginTop: 2,
  }

  const navStyle: CSSProperties = {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
  }

  const footerStyle: CSSProperties = {
    padding: '16px 12px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  }

  const userInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 8,
    marginBottom: 8,
  }

  const avatarStyle: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(108,99,255,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a89eff',
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  }

  const emailStyle: CSSProperties = {
    color: '#9ca3af',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  const signOutBtnStyle: CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#9ca3af',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  const mainStyle: CSSProperties = {
    marginLeft: SIDEBAR_WIDTH,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  }

  const topBarStyle: CSSProperties = {
    height: 56,
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    padding: '0 28px',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  }

  const contentStyle: CSSProperties = {
    flex: 1,
    padding: 28,
    maxWidth: 1400,
    width: '100%',
  }

  const initials = adminEmail
    ? adminEmail.slice(0, 2).toUpperCase()
    : 'AD'

  return (
    <div style={rootStyle}>
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        <div style={logoAreaStyle}>
          <div style={logoStyle}>
            <div style={logoIconStyle}>S</div>
            <div>
              <div style={logoTextStyle}>Squad</div>
              <div style={adminBadgeStyle}>ADMIN</div>
            </div>
          </div>
        </div>

        <nav style={navStyle}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : '#9ca3af',
                background: isActive ? 'rgba(108,99,255,0.25)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={footerStyle}>
          <div style={userInfoStyle}>
            <div style={avatarStyle}>{initials}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={emailStyle}>{adminEmail}</div>
            </div>
          </div>
          <button
            style={signOutBtnStyle}
            onClick={handleSignOut}
            disabled={signingOut}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background =
                'rgba(255,255,255,0.1)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background =
                'rgba(255,255,255,0.05)'
            }}
          >
            <span>↩</span>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={mainStyle}>
        <header style={topBarStyle}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            Squad Admin Dashboard
          </span>
        </header>
        <main style={contentStyle}>{children}</main>
      </div>
    </div>
  )
}

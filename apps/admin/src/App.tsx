import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import UserDetail from './pages/UserDetail'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import Cycles from './pages/Cycles'
import Venues from './pages/Venues'
import Feedback from './pages/Feedback'

// ─── Auth Context ─────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  email: string
}

// ─── Protected Route ──────────────────────────────────────────────────────────

function ProtectedRoute() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    async function checkSession(session: import('@supabase/supabase-js').Session | null) {
      if (!session) {
        if (mounted) { setLoading(false); navigate('/login', { replace: true }) }
        return
      }
      // Check admin role via profiles table (service role key bypasses RLS)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!mounted) return
      if (profile?.role === 'admin') {
        setAdminUser({ id: session.user.id, email: session.user.email ?? '' })
      } else {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
      }
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (!session) {
        setAdminUser(null)
        navigate('/login', { replace: true })
      } else {
        checkSession(session)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [navigate])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f5f5f7',
        }}
      >
        <div style={{ color: '#6C63FF', fontSize: 18 }}>Loading…</div>
      </div>
    )
  }

  if (!adminUser) return null

  return (
    <Layout adminEmail={adminUser.email}>
      <Outlet />
    </Layout>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/:id" element={<GroupDetail />} />
          <Route path="/cycles" element={<Cycles />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/feedback" element={<Feedback />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

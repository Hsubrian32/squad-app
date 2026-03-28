import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

if (!supabaseUrl) {
  throw new Error('Missing env variable: VITE_SUPABASE_URL')
}
if (!supabaseServiceRoleKey) {
  throw new Error('Missing env variable: VITE_SUPABASE_SERVICE_ROLE_KEY')
}

// Admin client uses service role key — bypasses RLS for full admin access.
// This client must only be used server-side or in a secured admin context.
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export default supabase

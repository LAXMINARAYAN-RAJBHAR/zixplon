import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dfmzipgtvidwfcmccdrx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'zixplon-auth',
    flowType: 'pkce',           // ✅ PKCE is secure + mobile-friendly
  }
})
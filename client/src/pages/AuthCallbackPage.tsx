import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Handles the redirect after a Supabase OAuth flow (e.g. Google sign-in).
 * Supabase puts the session tokens in the URL hash; this page lets the
 * Supabase JS client pick them up, which fires the onAuthStateChange
 * listener in AuthContext, which then saves the token and user.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // onAuthStateChange in AuthContext handles the rest
        navigate('/', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    })
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-4rem)] bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Signing you in…</p>
      </div>
    </div>
  )
}

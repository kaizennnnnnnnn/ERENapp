import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// A new install lands on the Welcome (onboarding), not on a login form: most
// people opening the app for the first time have no account to log into, and
// the Welcome has a "Log in" button for those who do.
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/home')
  } else {
    redirect('/onboarding')
  }
}

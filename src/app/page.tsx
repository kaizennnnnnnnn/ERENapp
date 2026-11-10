import { redirect } from 'next/navigation'

// A new install lands on the Welcome (onboarding), not on a login form: most
// people opening the app for the first time have no account to log into, and
// the Welcome has a "Log in" button for those who do.
export default function RootPage() {
  // The shared client guard resolves the account once. A slow Auth server must
  // not hold the root document hostage before any loading/retry UI can render.
  redirect('/home')
}

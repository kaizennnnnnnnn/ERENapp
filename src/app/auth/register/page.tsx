import { redirect } from 'next/navigation'

// Registration moved into the full onboarding flow. Old links and
// bookmarks land here, so keep the route as a permanent forward.
export default function RegisterPage() {
  redirect('/onboarding')
}

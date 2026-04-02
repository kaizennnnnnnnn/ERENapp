import { redirect } from 'next/navigation'

// The care system is now handled via the bottom nav care mode overlay.
// Navigating directly to /care redirects to home.
export default function CarePage() {
  redirect('/home')
}

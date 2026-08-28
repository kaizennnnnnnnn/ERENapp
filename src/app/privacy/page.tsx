/**
 * /privacy — the published privacy policy.
 *
 * Google Play requires a privacy policy at a stable public URL, declared in
 * Play Console AND linked inside the app. This route sits outside the (app)
 * group so it renders with no session — a Play reviewer, or anyone who has
 * not installed the app, has to be able to read it.
 *
 * The prose lives in ./policy.md; LegalDoc renders it. See that component for
 * why the document is Markdown rather than JSX.
 */

import fs from 'node:fs'
import path from 'node:path'
import { LegalDoc } from '@/components/legal/LegalDoc'

export const metadata = {
  title: 'Privacy Policy — Eren',
  description: 'What Eren stores, who processes it, and how to have it deleted.',
}

export default function PrivacyPage() {
  const md = fs.readFileSync(path.join(process.cwd(), 'src/app/privacy/policy.md'), 'utf8')
  return (
    <LegalDoc
      md={md}
      links={[
        { href: '/terms', label: 'Terms and content rules' },
        { href: '/delete-account', label: 'Delete your account' },
      ]}
    />
  )
}

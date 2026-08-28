/**
 * /terms — the published terms of use and content rules.
 *
 * Google Play's User Generated Content policy requires an app that carries
 * UGC to define objectionable content and behaviour somewhere users can
 * actually read it. §4 of terms.md is that definition, and the in-app report
 * flow points at this page.
 *
 * Like /privacy this sits outside the (app) group so it renders with no
 * session: a Play reviewer must be able to open it, and the registration
 * screen links to it before an account exists.
 */

import fs from 'node:fs'
import path from 'node:path'
import { LegalDoc } from '@/components/legal/LegalDoc'

export const metadata = {
  title: 'Terms and Content Rules — Eren',
  description: 'The agreement for using Eren, what may not be posted, and how to report it.',
}

export default function TermsPage() {
  const md = fs.readFileSync(path.join(process.cwd(), 'src/app/terms/terms.md'), 'utf8')
  return (
    <LegalDoc
      md={md}
      links={[
        { href: '/privacy', label: 'Privacy policy' },
        { href: '/delete-account', label: 'Delete your account' },
      ]}
    />
  )
}

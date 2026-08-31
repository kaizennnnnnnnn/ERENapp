'use client'

import ErenHero from './ErenHero'
import { PixelButton, PixelLink } from './pixelForm'

export default function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: 18 }}>
      <ErenHero
        size={172}
        titleSize={26}
        tagline={
          <p style={{ fontSize: 13, lineHeight: 1.7, color: '#C9B8E8', maxWidth: 250 }}>
            A tiny cat. A big responsibility.
            <br />
            {/* Was "For two." — the first line of the signup flow, and it told
                every solo installer they were the wrong customer before they
                had typed anything. The app still works best with someone else
                in it; that is an invitation to extend later, not a doorway to
                stand in. */}
            Alone, or with someone.
          </p>
        }
      />
      <div className="w-full" style={{ maxWidth: 260, marginTop: 6 }}>
        <PixelButton variant="gold" onClick={onStart}>START</PixelButton>
      </div>
      <div style={{ marginTop: 4 }}>
        <PixelLink href="/auth/login">I ALREADY LIVE HERE → LOG IN</PixelLink>
      </div>
    </div>
  )
}

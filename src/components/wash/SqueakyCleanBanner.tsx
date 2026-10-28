'use client'

import { Card, M, MeadowIcon } from '@/components/meadow'

export default function SqueakyCleanBanner() {
  return (
    <div role="status" className="meadow-root" style={{ width: '100%' }}>
      <Card padding="14px 18px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 3px 0 ${M.overArtLip}` }}>
        <MeadowIcon name="shine" size={24} color={M.leaf} />
        <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.4 }}>Squeaky clean!</span>
      </Card>
    </div>
  )
}

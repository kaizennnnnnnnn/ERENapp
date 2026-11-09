'use client'

import { usePathname } from 'next/navigation'
import { PageSkeleton, SkeletonContent } from './loading/LoadingSkeleton'

export default function PageLoader({ label = 'Loading page', inline = false }: { label?: string; inline?: boolean }) {
  const pathname = usePathname()
  return inline ? <SkeletonContent layout="list" label={label} />
    : <PageSkeleton path={pathname ?? '/home'} label={label} />
}

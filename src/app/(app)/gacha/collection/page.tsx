'use client'

export const dynamic = 'force-dynamic'

// Container for the collection vault: owns the inventory data and the two
// actions (use a can, jump to the closet). All rendering lives in
// components/collection/CollectionView, which stays pure so it can be
// screenshotted with mock ownership.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useInventory } from '@/hooks/useInventory'
import { useCare } from '@/contexts/CareContext'
import CollectionView from '@/components/collection/CollectionView'
import type { GachaCategory, GachaItemDef } from '@/types'

export default function CollectionPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const { ownsItem, getQuantity, useItem, collectionPct, ownedCount, totalItems, loading, loaded } = useInventory()

  const [tab, setTab] = useState<GachaCategory>('skin')
  const [selected, setSelected] = useState<GachaItemDef | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  async function use(item: GachaItemDef) {
    setSelected(null)
    const result = await useItem(item.id)
    if (result.success) {
      setToast(result.message)
      setTimeout(() => setToast(null), 2500)
    }
  }

  return (
    <CollectionView
      tab={tab}
      onTabChange={setTab}
      ownsItem={ownsItem}
      getQuantity={getQuantity}
      collectionPct={collectionPct}
      ownedCount={ownedCount}
      totalItems={totalItems}
      ready={!loading && loaded}
      selected={selected}
      onSelect={setSelected}
      onUse={use}
      onOpenCloset={() => router.push('/closet')}
      onBack={() => router.back()}
      toast={toast}
    />
  )
}

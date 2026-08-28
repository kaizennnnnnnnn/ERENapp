'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from '@/hooks/useAuth'
import type { Memory } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import { Camera, Heart, Plus, Trash2, X, ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCare } from '@/contexts/CareContext'

/** How long a signed photo URL stays valid, and how stale one may get before
 *  a return to the foreground re-signs it. Short because a signed URL is a
 *  bearer token: anyone it is forwarded to can see the photo until it
 *  expires, including someone who has since left the household. */
const SIGN_TTL_SEC   = 60 * 60
const RESIGN_AFTER_MS = 45 * 60 * 1000

/** Reduce whatever `memories.image_url` holds to an object path inside the
 *  `memories` bucket.
 *
 *  Rows written while the bucket was public hold a full URL ending
 *  /object/public/memories/<householdId>/<file>; rows written since hold the
 *  bare path. Accepting both means the migration that flips the bucket and
 *  the deploy that ships this can land in either order — and a row inserted
 *  in between still renders. Returns null for a row with no image, or a URL
 *  pointing somewhere we cannot sign. */
function memoryObjectPath(value: string | null | undefined): string | null {
  if (!value) return null
  const marker = '/object/public/memories/'
  const at = value.indexOf(marker)
  if (at !== -1) return decodeURIComponent(value.slice(at + marker.length).split('?')[0]) || null
  // Not one of our public URLs. A bare path is the new shape; anything else
  // absolute belongs to a host we hold no key for.
  if (/^https?:/i.test(value)) return null
  return value.split('?')[0] || null
}

/** A memory photo, or a quiet placeholder while its signed URL is being
 *  minted. Never renders an <img> with an empty src — that paints a
 *  broken-image glyph, and on the wall it would paint a grid of them. */
function MemoryPhoto({ src, className }: { src: string | null; className: string }) {
  if (!src) return <div className={className} style={{ background: '#F5EBFF' }} />
  return <img src={src} alt="" className={className} />
}

export default function MemoriesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])

  const [memories, setMemories]   = useState<Memory[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [text, setText]           = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [selected, setSelected]   = useState<Memory | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // objectPath -> signed URL. The bucket is private, so a photo has no
  // stable address; every render needs a fresh token.
  const [signed, setSigned]       = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadFailedRef = useRef(false)
  const signedAtRef = useRef(0)

  async function loadMemories() {
    if (!profile?.household_id) return
    // withRetry: a transient Supabase 503 resolves as { data: null } and must
    // not read as "no memories yet" — a false empty wall invites duplicates.
    const { data, error } = await withRetry(() => supabase
      .from('memories')
      .select('*, profile:profiles(name)')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: false }))
    if (data) setMemories(data)
    // On persistent failure keep the loader instead of the empty state.
    loadFailedRef.current = !!error
    if (!error) setLoading(false)
  }

  useEffect(() => { loadMemories() }, [profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Mint a signed URL for every photo currently on screen. One round trip
   *  for the whole wall — signing per <img> would be a request per tile. */
  async function signPhotos() {
    const paths = Array.from(new Set(
      memories.map(m => memoryObjectPath(m.image_url)).filter((p): p is string => !!p)
    ))
    if (paths.length === 0) {
      setSigned(prev => Object.keys(prev).length ? {} : prev)
      return
    }

    const { data } = await withRetry(() => supabase.storage
      .from('memories')
      .createSignedUrls(paths, SIGN_TTL_SEC))
    if (!data) return // transient — the foreground hook below tries again

    // Rebuild rather than merge: a path that has dropped off the wall should
    // not keep a live token sitting in memory.
    const next: Record<string, string> = {}
    for (const row of data) {
      if (row.path && row.signedUrl) next[row.path] = row.signedUrl
    }
    setSigned(next)
    signedAtRef.current = Date.now()
  }

  /** The live URL for a memory's photo, or null while it is being signed. */
  function photoSrc(memory: Memory): string | null {
    const path = memoryObjectPath(memory.image_url)
    return path ? signed[path] ?? null : null
  }

  // Keyed on the set of paths, not on `memories` — a favourite toggle
  // rewrites the array but must not re-sign the whole wall.
  const photoKey = memories.map(m => memoryObjectPath(m.image_url) ?? '').join('|')
  useEffect(() => { signPhotos() }, [photoKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Self-heal on return to the foreground: retry a failed load (the loader is
  // still up), and re-sign before the tokens expire. A PWA left open on this
  // page for an hour would otherwise come back to a wall of broken images.
  useEffect(() => onForeground(() => {
    if (loadFailedRef.current) loadMemories()
    else if (Date.now() - signedAtRef.current > RESIGN_AFTER_MS) signPhotos()
  }), [profile?.household_id, photoKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Close the composer and drop everything it was holding. `imageFile` in
   *  particular: leaving it set meant cancelling, reopening and saving a
   *  note-only memory silently re-uploaded the abandoned photo. */
  function closeAdd() {
    setShowAdd(false)
    setImagePreview(null)
    setImageFile(null)
    setText('')
    setSaveError(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
  }

  async function handleSave() {
    if (!user?.id || !profile?.household_id) return
    if (!text.trim() && !imageFile) return
    setSaving(true)
    setSaveError(null)

    // The object path, not a URL. The bucket is private, so there is no
    // stable address to store — the path is the durable fact and the URL
    // gets signed per view.
    let objectPath: string | null = null

    if (imageFile) {
      const ext  = imageFile.name.split('.').pop()
      const path = `${profile.household_id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('memories')
        .upload(path, imageFile)

      // Saving the note anyway and dropping the photo on the floor is the
      // worst outcome: the memory looks saved, the picture is gone, and
      // nothing said so. Stop and let them retry.
      if (uploadErr) {
        setSaveError(/exceeded the maximum allowed size/i.test(uploadErr.message)
          ? 'That photo is too large — 15 MB max.'
          : 'Photo upload failed. Check your connection and try again.')
        setSaving(false)
        return
      }
      objectPath = path
    }

    const { data, error } = await supabase
      .from('memories')
      .insert({
        household_id: profile.household_id,
        user_id: user.id,
        text: text.trim() || null,
        image_url: objectPath,
      })
      .select('*, profile:profiles(name)')
      .single()

    if (error || !data) {
      // The upload landed but nothing references it now — bin it rather than
      // leave an object no one can reach and no one can delete.
      if (objectPath) await supabase.storage.from('memories').remove([objectPath])
      setSaveError('Could not save that memory. Try again in a moment.')
      setSaving(false)
      return
    }

    // The signing effect picks the new path up from the changed photo key.
    setMemories(prev => [data, ...prev])
    setSaving(false)
    closeAdd()
  }

  async function handleToggleFavorite(memory: Memory) {
    await supabase
      .from('memories')
      .update({ is_favorite: !memory.is_favorite })
      .eq('id', memory.id)
    setMemories(prev => prev.map(m => m.id === memory.id ? { ...m, is_favorite: !m.is_favorite } : m))
  }

  async function handleDelete(id: string) {
    // Delete the image object too, not just the row. An orphaned object still
    // counts against storage and still answers a signed URL minted before the
    // row went — "delete" that leaves the photo behind is not a delete, and it
    // breaks any takedown request.
    //
    // Object first: if the row went first and this failed we would have lost
    // the only pointer to the file.
    const memory = memories.find(m => m.id === id)
    const objectPath = memoryObjectPath(memory?.image_url)
    if (objectPath) {
      await supabase.storage.from('memories').remove([objectPath])
    }

    const { error } = await supabase.from('memories').delete().eq('id', id)
    if (error) return

    setMemories(prev => prev.filter(m => m.id !== id))
    setSelected(null)
  }

  return (
    <div className="page-scroll">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform"
            style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
            <ChevronLeft size={16} className="text-purple-500" />
          </button>
          <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #F5C842)' }}>📸 MEMORIES</span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-white transition-all active:translate-y-[2px]"
          style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', borderRadius: 3, border: '2px solid #CC3366', boxShadow: '0 3px 0 #991A4A' }}
        >
          <Plus size={14} />
          <span className="font-pixel" style={{ fontSize: 7 }}>ADD</span>
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-5">Your moments with Eren 🐾</p>

      {/* ── Add memory modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm" style={{ animation: 'scrimIn 200ms ease-out' }}>
          <div className="w-full max-w-md mx-auto shadow-2xl flex flex-col"
            style={{ background: 'linear-gradient(180deg, #FFF8FF, #FFF0FF)', borderRadius: '16px 16px 0 0', borderTop: '3px solid #F0D0FF', boxShadow: '0 -4px 0 #E0B8FF', height: '82svh', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
              <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)' }}>+ NEW MEMORY</span>
              <button onClick={closeAdd}
                style={{ background: '#F5F0FF', borderRadius: 3, border: '2px solid #DDD0F0', padding: '4px 6px' }}>
                <X size={16} className="text-purple-400" />
              </button>
            </div>

            {/* Photo area */}
            <div className="px-5 flex-shrink-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn('w-full flex items-center justify-center cursor-pointer overflow-hidden transition-all')}
                style={{ height: 160, ...(imagePreview
                  ? { borderRadius: 8, border: '2px solid #FF6B9D', boxShadow: '3px 3px 0 #CC3366' }
                  : { borderRadius: 8, border: '2px dashed #DDD0F0', background: '#FBF8FF' }) }}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Camera size={28} />
                    <span className="font-pixel text-purple-300" style={{ fontSize: 7 }}>TAP TO ADD PHOTO</span>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Note */}
            <div className="px-5 pt-3 flex-1 min-h-0">
              <textarea
                className="input resize-none w-full h-full"
                placeholder="Write a little note about this moment..."
                value={text}
                onChange={e => setText(e.target.value)}
              />
            </div>

            {/* Save failed — say so instead of closing as if it worked */}
            {saveError && (
              <div className="mx-5 mt-3 px-3 py-2 flex-shrink-0"
                style={{ background: '#FFF0F0', borderRadius: 3, border: '2px solid #FFB8B8', boxShadow: '2px 2px 0 #FF9090' }}>
                <p className="text-xs text-red-500">{saveError}</p>
              </div>
            )}

            {/* Buttons — always pinned at bottom */}
            <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid #F0E0FF' }}>
              <button onClick={closeAdd}
                className="flex-1 py-3 transition-all active:translate-y-[1px]"
                style={{ background: '#F5F0FF', borderRadius: 6, border: '2px solid #DDD0F0', boxShadow: '0 3px 0 #C8B8E8', color: '#7C3AED', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                CANCEL
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!text.trim() && !imageFile)}
                className="flex-1 py-3 text-white transition-all active:translate-y-[1px] disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', borderRadius: 6, border: '2px solid #CC3366', boxShadow: '0 3px 0 #991A4A', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                {saving ? 'SAVING...' : 'SAVE ♥'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Memory detail modal ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" style={{ animation: 'scrimIn 200ms ease-out' }} onClick={() => setSelected(null)}>
          <div className="max-w-sm w-full overflow-hidden" style={{ borderRadius: 4, border: '3px solid #F0D0FF', boxShadow: '5px 5px 0 #C090E0', animation: 'modalPop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }} onClick={e => e.stopPropagation()}>
            {selected.image_url && (
              <MemoryPhoto src={photoSrc(selected)} className="w-full aspect-square object-cover" />
            )}
            <div className="p-4 bg-white">
              {selected.text && <p className="text-sm text-gray-700 mb-2">{selected.text}</p>}
              <p className="font-pixel text-gray-400 mb-4" style={{ fontSize: 6 }}>
                {(selected.profile as { name?: string })?.name ?? '??'} · {formatDate(selected.created_at)}
              </p>
              <div className="flex gap-2">
                <button onClick={() => handleToggleFavorite(selected)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-all active:translate-y-[1px]"
                  style={{ borderRadius: 3, border: '2px solid #F0D0FF', boxShadow: '2px 2px 0 #D8B8F0', background: selected.is_favorite ? '#FFF0F7' : 'white' }}>
                  <Heart size={14} className={selected.is_favorite ? 'text-[#FF6B9D] fill-[#FF6B9D]' : 'text-gray-400'} />
                  <span className="font-pixel text-gray-600" style={{ fontSize: 6 }}>{selected.is_favorite ? 'UNFAV' : 'FAV'}</span>
                </button>
                {selected.user_id === user?.id && (
                  <button onClick={() => handleDelete(selected.id)}
                    className="px-4 flex items-center gap-1 transition-all active:translate-y-[1px]"
                    style={{ background: '#FFF0F0', borderRadius: 3, border: '2px solid #FFB8B8', boxShadow: '2px 2px 0 #FF9090' }}>
                    <Trash2 size={14} className="text-red-400" />
                    <span className="font-pixel text-red-400" style={{ fontSize: 6 }}>DEL</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading (also covers a persistent outage; foreground retries) ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-14">
          <p className="font-pixel text-gray-400" style={{ fontSize: 8 }}>LOADING…</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && memories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <div className="text-5xl animate-float">📸</div>
          <p className="font-pixel text-gray-400" style={{ fontSize: 8 }}>NO MEMORIES YET</p>
          <p className="text-xs text-gray-300">Add your first photo of Eren!</p>
          <button onClick={() => setShowAdd(true)}
            className="mt-2 px-5 py-3 text-white transition-all active:translate-y-[2px]"
            style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', borderRadius: 3, border: '2px solid #CC3366', boxShadow: '0 3px 0 #991A4A', fontFamily: '"Press Start 2P"', fontSize: 8 }}>
            + ADD MEMORY
          </button>
        </div>
      )}

      {/* ── Grid ── */}
      {memories.length > 0 && (
        <>
          {/* Favorites row */}
          {memories.some(m => m.is_favorite) && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #FF4080)' }}>♥ FAVS</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
                {memories.filter(m => m.is_favorite).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className="flex-shrink-0 w-20 h-20 overflow-hidden active:scale-95 transition-transform"
                    style={{ borderRadius: 3, border: '2px solid #FF6B9D', boxShadow: '2px 2px 0 #CC3366' }}
                  >
                    {m.image_url
                      ? <MemoryPhoto src={photoSrc(m)} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: '#FFF0F7' }}>💕</div>
                    }
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All memories grid */}
          <div className="grid grid-cols-2 gap-3">
            {memories.map(memory => (
              <button
                key={memory.id}
                onClick={() => setSelected(memory)}
                className="overflow-hidden active:translate-y-[2px] transition-all text-left"
                style={{ borderRadius: 4, border: '2px solid #F0D8FF', boxShadow: '3px 3px 0 #D8C0F0', background: 'white' }}
              >
                {memory.image_url && (
                  <div className="aspect-square relative overflow-hidden">
                    <MemoryPhoto src={photoSrc(memory)} className="w-full h-full object-cover" />
                    {memory.is_favorite && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 2, border: '1px solid #FF6B9D' }}>
                        <Heart size={10} className="text-[#FF6B9D] fill-[#FF6B9D]" />
                      </div>
                    )}
                  </div>
                )}
                <div className="p-2">
                  {memory.text && (
                    <p className="text-xs text-gray-700 line-clamp-2 leading-snug">{memory.text}</p>
                  )}
                  {!memory.image_url && (
                    <div className="h-14 flex items-center">
                      <p className="text-xs text-gray-600 line-clamp-3">{memory.text}</p>
                    </div>
                  )}
                  <p className="font-pixel text-gray-300 mt-1" style={{ fontSize: 6 }}>{formatDate(memory.created_at, 'MMM d')}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

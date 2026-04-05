'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Memory } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import { Camera, Heart, Plus, Trash2, X, ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function MemoriesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()

  const [memories, setMemories]   = useState<Memory[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [text, setText]           = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [selected, setSelected]   = useState<Memory | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadMemories() {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('memories')
      .select('*, profile:profiles(name)')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: false })
    if (data) setMemories(data)
    setLoading(false)
  }

  useEffect(() => { loadMemories() }, [profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

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

    let imageUrl: string | null = null

    if (imageFile) {
      const ext  = imageFile.name.split('.').pop()
      const path = `${profile.household_id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('memories')
        .upload(path, imageFile)

      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from('memories')
          .getPublicUrl(path)
        imageUrl = urlData.publicUrl
      }
    }

    const { data } = await supabase
      .from('memories')
      .insert({
        household_id: profile.household_id,
        user_id: user.id,
        text: text.trim() || null,
        image_url: imageUrl,
      })
      .select('*, profile:profiles(name)')
      .single()

    if (data) setMemories(prev => [data, ...prev])

    setText('')
    setImageFile(null)
    setImagePreview(null)
    setSaving(false)
    setShowAdd(false)
  }

  async function handleToggleFavorite(memory: Memory) {
    await supabase
      .from('memories')
      .update({ is_favorite: !memory.is_favorite })
      .eq('id', memory.id)
    setMemories(prev => prev.map(m => m.id === memory.id ? { ...m, is_favorite: !m.is_favorite } : m))
  }

  async function handleDelete(id: string) {
    await supabase.from('memories').delete().eq('id', id)
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
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md mx-auto shadow-2xl flex flex-col"
            style={{ background: 'linear-gradient(180deg, #FFF8FF, #FFF0FF)', borderRadius: '16px 16px 0 0', borderTop: '3px solid #F0D0FF', boxShadow: '0 -4px 0 #E0B8FF', height: '82svh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
              <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)' }}>+ NEW MEMORY</span>
              <button onClick={() => { setShowAdd(false); setImagePreview(null); setText('') }}
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

            {/* Buttons — always pinned at bottom */}
            <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid #F0E0FF' }}>
              <button onClick={() => { setShowAdd(false); setImagePreview(null); setText('') }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="max-w-sm w-full overflow-hidden" style={{ borderRadius: 4, border: '3px solid #F0D0FF', boxShadow: '5px 5px 0 #C090E0' }} onClick={e => e.stopPropagation()}>
            {selected.image_url && (
              <img src={selected.image_url} alt="" className="w-full aspect-square object-cover" />
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
                      ? <img src={m.image_url} alt="" className="w-full h-full object-cover" />
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
                    <img src={memory.image_url} alt="" className="w-full h-full object-cover" />
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

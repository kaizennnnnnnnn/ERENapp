'use client'

import { useState, useRef, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'

interface Props { onClose: () => void }
interface Bubble { id: number; x: number; y: number; size: number }

export default function WashScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()

  const sceneRef  = useRef<HTMLDivElement>(null)
  const soapRef   = useRef<HTMLDivElement>(null)
  const showerRef = useRef<HTMLDivElement>(null)

  // Soap drag
  const [soapPos,       setSoapPos]       = useState({ x: 12, y: 62 })
  const [dragSoap,      setDragSoap]      = useState(false)
  const [coverage,      setCoverage]      = useState(0)
  const [bubbles,       setBubbles]       = useState<Bubble[]>([])
  const bubbleId = useRef(0)

  // Shower drag
  const [showerPos,    setShowerPos]    = useState({ x: 50, y: 18 })
  const [dragShower,   setDragShower]   = useState(false)
  const [showShower,   setShowShower]   = useState(false)

  // State
  const [done, setDone]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState<string | null>(null)
  const rinseCovRef = useRef(coverage)
  rinseCovRef.current = coverage

  // Refs so onPointerMove never reads stale closure values
  const dragSoapRef    = useRef(false)
  const dragShowerRef  = useRef(false)
  const doneRef        = useRef(false)
  const showShowerRef  = useRef(false)

  const cleanliness = stats?.cleanliness ?? 100

  // ── Soap pointer handlers ───────────────────────────────────────────────
  function onSoapDown(e: React.PointerEvent) {
    if (doneRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragSoapRef.current = true
    setDragSoap(true)
  }

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((e.clientX - rect.left) / rect.width)  * 100
    const py = ((e.clientY - rect.top)  / rect.height) * 100

    if (dragSoapRef.current && !doneRef.current) {
      setSoapPos({ x: px, y: py })
      if (px > 28 && px < 72 && py > 22 && py < 66) {
        setCoverage(c => {
          const next = Math.min(100, c + 0.7)
          if (next >= 60 && !showShowerRef.current) {
            showShowerRef.current = true
            setShowShower(true)
          }
          return next
        })
        setBubbles(bs => {
          const next = [...bs, { id: bubbleId.current++, x: px, y: py, size: 14 + Math.random() * 12 }]
          return next.slice(-40)
        })
      }
    }

    if (dragShowerRef.current && !doneRef.current) {
      setShowerPos({ x: px, y: py })
      if (px > 25 && px < 75 && py > 20 && py < 80) {
        setCoverage(c => Math.max(0, c - 2.5))
        setBubbles(bs => bs.slice(0, Math.max(0, bs.length - 3)))
      }
    }
  }, []) // stable — reads only refs

  function onSoapUp() {
    dragSoapRef.current = false
    setDragSoap(false)
  }

  function onShowerDown(e: React.PointerEvent) {
    if (doneRef.current || rinseCovRef.current < 50) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragShowerRef.current = true
    setDragShower(true)
  }
  function onShowerUp() {
    dragShowerRef.current = false
    setDragShower(false)
    if (rinseCovRef.current <= 10 && !doneRef.current) finishWash()
  }

  async function finishWash() {
    if (!user?.id || doneRef.current) return
    doneRef.current = true
    setDone(true)
    setSaving(true)
    try {
      const result = await applyAction(user.id, 'wash')
      setToast(result.message)
      if (result.success) completeTask('daily_wash')
    } catch {
      setToast('Something went wrong')
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const erenMood = done ? 'happy' : dragSoap ? 'angry' : dragShower ? 'angry' : cleanliness < 40 ? 'angry' : 'idle'

  const SOAP_SEGMENTS = 12
  const soapFilled = Math.round((coverage / 100) * SOAP_SEGMENTS)
  const rinseFilled = coverage >= 60 ? Math.round(((100 - coverage) / 40) * SOAP_SEGMENTS) : 0

  return (
    <div
      ref={sceneRef}
      className="fixed inset-0 z-40 overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* ══ BATHROOM ROOM ═════════════════════════════════════════════════ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        {/* ── SKY WALL — soft blue gradient ── */}
        <div className="absolute left-0 right-0 top-0" style={{ height: '58%', background: 'linear-gradient(180deg, #EAF6FF 0%, #D4EEFA 60%, #C8E8F8 100%)' }} />

        {/* ── Warm morning light bloom (top-left) ── */}
        <div className="absolute" style={{ top: '-10%', left: '-5%', width: '60%', height: '60%', background: 'radial-gradient(ellipse, rgba(255,245,220,0.22) 0%, transparent 65%)', pointerEvents: 'none' }} />

        {/* ── SUBWAY TILES — full upper wall ── */}
        {Array.from({ length: 60 }).map((_, i) => {
          const tilesPerRow = 12
          const col = i % tilesPerRow
          const row = Math.floor(i / tilesPerRow)
          const offsetX = (row % 2) * (100 / tilesPerRow / 2)
          const isAccent = row === 2 && (col === 1 || col === 4 || col === 7 || col === 10)
          return (
            <div key={i} className="absolute"
              style={{
                left: `${col * (100 / tilesPerRow) + offsetX}%`,
                top: `${row * 11.5}%`,
                width: `${100 / tilesPerRow - 0.4}%`,
                height: '11%',
                background: isAccent
                  ? 'linear-gradient(135deg, #A8E8F8 0%, #88D4EC 50%, #70C4E0 100%)'
                  : 'linear-gradient(135deg, #FDFEFF 0%, #F2FAFD 40%, #E8F5FB 100%)',
                border: '1px solid #C4DCE8',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.75), inset -1px -1px 1px rgba(190,215,230,0.3)',
                borderRadius: 1,
              }} />
          )
        })}

        {/* ── DECORATIVE BORDER STRIP at wall/floor join ── */}
        <div className="absolute left-0 right-0" style={{ top: '57%', height: 16 }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0"
              style={{
                left: `${i * (100 / 24)}%`,
                width: `${100 / 24 - 0.2}%`,
                background: i % 3 === 0
                  ? 'linear-gradient(90deg, #5BC8DC, #3AAEC4)'
                  : i % 3 === 1
                  ? 'linear-gradient(90deg, #FDFEFF, #EEF8FF)'
                  : 'linear-gradient(90deg, #5BC8DC, #3AAEC4)',
              }} />
          ))}
          <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: '#2A9AB0' }} />
          <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: '#2A9AB0' }} />
        </div>

        {/* ── HEXAGONAL FLOOR TILES ── */}
        <div className="absolute left-0 right-0" style={{ top: '57.5%', bottom: 0, background: 'linear-gradient(180deg, #D0E8F8 0%, #BCD8EE 100%)' }} />
        {Array.from({ length: 30 }).map((_, i) => {
          const col = i % 6, row = Math.floor(i / 6)
          const offsetX = (row % 2) * (100 / 6 / 2)
          const isDark = (col + row) % 2 === 0
          return (
            <div key={i} className="absolute"
              style={{
                left: `${col * (100 / 6) + offsetX}%`,
                top: `${58 + row * 8.2}%`,
                width: `${100 / 6 - 0.5}%`,
                height: '8%',
                background: isDark
                  ? 'linear-gradient(135deg, #D8EEFA 0%, #C4DCEA 100%)'
                  : 'linear-gradient(135deg, #E8F6FF 0%, #D4ECF8 100%)',
                border: '1px solid #B0CCE0',
                boxShadow: isDark ? 'inset 1px 1px 2px rgba(255,255,255,0.4)' : 'inset 1px 1px 3px rgba(255,255,255,0.6)',
              }} />
          )
        })}

        {/* ── FLOOR BASEBOARD ── */}
        <div className="absolute left-0 right-0" style={{ top: '57.8%', height: 6, background: 'linear-gradient(180deg, #A8C4D8 0%, #90B0C8 100%)', boxShadow: '0 2px 4px rgba(60,100,140,0.2)' }} />

        {/* ══ WINDOW — left side with outdoor morning garden ── */}
        <div className="absolute" style={{ top: '4%', left: '3%', width: 76, height: 64 }}>
          {/* Outer frame */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #C8D8E0, #A8B8C4)', borderRadius: 3, padding: 4, boxShadow: '2px 3px 8px rgba(0,0,0,0.18), inset 0 1px 2px rgba(255,255,255,0.4)' }}>
            {/* Sky outside */}
            <div className="absolute inset-0 overflow-hidden" style={{ margin: 4, borderRadius: 2 }}>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #B8E0FF 0%, #D8F0FF 60%, #C8EAD8 100%)' }} />
              {/* Sun */}
              <div className="absolute" style={{ top: 3, right: 8, width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%, #FFF8C0, #FFD840)', boxShadow: '0 0 8px rgba(255,220,80,0.6)' }} />
              {/* Sun rays */}
              {[0,45,90,135].map(angle => (
                <div key={angle} className="absolute" style={{ top: 3, right: 8, width: 14, height: 14, transform: `rotate(${angle}deg)` }}>
                  <div style={{ position: 'absolute', top: -6, left: '50%', marginLeft: -1, width: 2, height: 5, background: 'rgba(255,220,80,0.6)', borderRadius: 2 }} />
                </div>
              ))}
              {/* Cloud */}
              <div className="absolute" style={{ top: 6, left: 4, width: 20, height: 8, background: 'rgba(255,255,255,0.85)', borderRadius: 6, boxShadow: '2px 2px 0 rgba(200,230,255,0.5)' }}>
                <div style={{ position: 'absolute', top: -4, left: 4, width: 10, height: 10, background: 'rgba(255,255,255,0.85)', borderRadius: '50%' }} />
              </div>
              {/* Garden strip */}
              <div className="absolute bottom-0 left-0 right-0" style={{ height: 18, background: 'linear-gradient(180deg, #90D870 0%, #60B840 100%)' }} />
              {/* Flowers in garden */}
              {[4, 12, 22, 34].map((fx, fi) => (
                <div key={fi} className="absolute" style={{ bottom: 10, left: fx }}>
                  <div style={{ width: 4, height: 8, background: '#48A030', margin: '0 auto' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ['#FF6B9D','#FFD840','#A78BFA','#FF9860'][fi], marginLeft: -2, marginTop: -4, boxShadow: '0 0 4px rgba(255,150,100,0.4)' }} />
                </div>
              ))}
            </div>
            {/* Window cross bars */}
            <div className="absolute" style={{ top: 4, bottom: 4, left: '50%', marginLeft: -1, width: 2, background: '#A8B8C4' }} />
            <div className="absolute" style={{ top: '50%', left: 4, right: 4, height: 2, background: '#A8B8C4', marginTop: -1 }} />
          </div>
          {/* Window sill */}
          <div className="absolute left-0 right-0 bottom-0" style={{ height: 6, background: 'linear-gradient(180deg, #C0D0DC, #98B0C0)', borderRadius: '0 0 3px 3px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
          {/* Window sill items — small candle & potted plant */}
          <div className="absolute" style={{ bottom: -2, left: 6, width: 6, height: 14 }}>
            <div style={{ width: 6, height: 10, background: 'linear-gradient(180deg, #FFF8C0, #FFE060)', borderRadius: '2px 2px 1px 1px', border: '1px solid #E8C840' }} />
            {/* Flame */}
            <div style={{ position: 'absolute', top: -4, left: 2, width: 2, height: 5, background: 'linear-gradient(180deg, #FFE060, #FF9020)', borderRadius: '50% 50% 0 0', animation: 'flicker 1s ease-in-out infinite' }} />
          </div>
          {/* Small CSS plant on sill */}
          <div className="absolute" style={{ bottom: -2, right: 8 }}>
            <div style={{ width: 8, height: 7, background: 'linear-gradient(180deg, #B05030, #8A3818)', borderRadius: '1px 1px 3px 3px', border: '1px solid #6A2810', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -1, left: -1, right: -1, height: 3, background: '#C06040', borderRadius: 1 }} />
            </div>
            {[[-2,-7,20],[0,-10,-10],[2,-7,12]].map(([lx,ly,rot], i) => (
              <div key={i} style={{ position: 'absolute', bottom: 7, left: 0 + lx, width: 7, height: 9, background: 'linear-gradient(180deg, #50C040, #38A028)', borderRadius: '50% 50% 30% 70%', border: '1px solid #289018', transform: `rotate(${rot}deg)`, transformOrigin: 'bottom center' }} />
            ))}
          </div>
          {/* Light beam */}
          <div className="absolute -right-10 top-0 bottom-0" style={{ width: 36, background: 'linear-gradient(90deg, rgba(220,245,255,0.35) 0%, transparent 100%)' }} />
        </div>

        {/* ══ HOLLYWOOD MIRROR — right side with light bulbs ── */}
        <div className="absolute" style={{ top: '2%', right: '4%', width: 76, height: 76 }}>
          {/* Outer chrome ring */}
          <div className="absolute inset-0" style={{ borderRadius: '50%', background: 'linear-gradient(135deg, #E0E0E0 0%, #C0C0C0 40%, #F0F0F0 65%, #D0D0D0 100%)', padding: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.6)' }}>
            {/* Mirror surface */}
            <div className="w-full h-full overflow-hidden" style={{ borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%, #FAFDFF 0%, #E0F2FF 45%, #C4E4F8 100%)' }}>
              {/* Main reflection highlight */}
              <div className="absolute" style={{ top: '8%', left: '12%', width: '38%', height: '22%', background: 'rgba(255,255,255,0.5)', borderRadius: '50%', transform: 'rotate(-28deg)' }} />
              {/* Small glint */}
              <div className="absolute" style={{ top: '14%', left: '52%', width: '10%', height: '8%', background: 'rgba(255,255,255,0.35)', borderRadius: '50%' }} />
            </div>
          </div>
          {/* Light bulbs around mirror — 8 bulbs */}
          {Array.from({ length: 8 }).map((_, bi) => {
            const angle = (bi / 8) * 360 - 90
            const rad = (angle * Math.PI) / 180
            const bx = 38 + 36 * Math.cos(rad)
            const by = 38 + 36 * Math.sin(rad)
            return (
              <div key={bi} className="absolute" style={{ left: bx - 5, top: by - 5, width: 10, height: 10, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #FFFDE0, #FFE860)', border: '1px solid #E8C840', boxShadow: '0 0 6px rgba(255,230,80,0.7), 0 0 2px rgba(255,200,0,0.5)' }} />
            )
          })}
          {/* Mirror glow */}
          <div className="absolute -inset-3" style={{ borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,140,0.12) 0%, transparent 70%)', zIndex: -1 }} />
        </div>

        {/* ══ SHAMPOO SHELF — on wall above tub, left-center ── */}
        <div className="absolute" style={{ top: '24%', left: '2%', width: 72 }}>
          {/* Bottles sit on top of shelf */}
          <div className="flex gap-1 px-1 items-end">
            {[
              { h: 32, bg: '#FF6B9D', cap: '#E03080', w: 11 },
              { h: 26, bg: '#6BAED6', cap: '#4090BC', w: 10 },
              { h: 30, bg: '#A78BFA', cap: '#7C55D8', w: 11 },
              { h: 22, bg: '#68D89A', cap: '#40B870', w: 9 },
              { h: 28, bg: '#FFB840', cap: '#E0901A', w: 10 },
            ].map((b, i) => (
              <div key={i} className="relative flex-shrink-0"
                style={{ width: b.w, height: b.h }}>
                {/* Cap */}
                <div style={{ width: b.w - 2, height: 5, background: `linear-gradient(180deg, ${b.cap}, ${b.cap}CC)`, borderRadius: '2px 2px 0 0', marginLeft: 1, border: `1px solid ${b.cap}88` }} />
                {/* Neck */}
                <div style={{ width: b.w - 4, height: 4, background: b.bg, margin: '0 auto', borderLeft: `1px solid ${b.bg}88`, borderRight: `1px solid ${b.bg}88` }} />
                {/* Body */}
                <div className="relative" style={{ width: b.w, height: b.h - 12, background: `linear-gradient(180deg, ${b.bg}EE, ${b.bg}AA)`, borderRadius: '2px 2px 4px 4px', border: `1px solid ${b.bg}66` }}>
                  {/* Label stripe */}
                  <div className="absolute inset-x-0.5 inset-y-1" style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
                    <div style={{ position: 'absolute', top: '30%', left: 2, right: 2, height: 1.5, background: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
                    <div style={{ position: 'absolute', top: '55%', left: 2, right: 2, height: 1.5, background: 'rgba(255,255,255,0.35)', borderRadius: 1 }} />
                  </div>
                  {/* Highlight streak */}
                  <div className="absolute left-1" style={{ top: 2, width: 2, height: '50%', background: 'rgba(255,255,255,0.45)', borderRadius: 2 }} />
                </div>
              </div>
            ))}
            {/* Loofah */}
            <div style={{ width: 14, height: 20, background: 'radial-gradient(circle at 40% 40%, #FFE8A0, #E8C870)', borderRadius: 5, border: '1px solid #D4B040', boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 8, left: 2, right: 2, height: 2, background: 'rgba(0,0,0,0.1)', borderRadius: 2 }} />
            </div>
          </div>
          {/* Shelf board — bottles rest on this */}
          <div className="w-full" style={{ height: 5, background: 'linear-gradient(180deg, #B8D4E4 0%, #90B8CC 100%)', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.4)' }} />
          {/* Shelf brackets hang below the board */}
          <div style={{ position: 'relative', height: 12 }}>
            <div className="absolute" style={{ left: 4, top: 0, width: 4, height: 12, background: 'linear-gradient(180deg, #90B8CC, #70A0B8)', borderRadius: '0 0 2px 0' }} />
            <div className="absolute" style={{ right: 4, top: 0, width: 4, height: 12, background: 'linear-gradient(180deg, #90B8CC, #70A0B8)', borderRadius: '0 0 2px 2px' }} />
          </div>
        </div>

        {/* ══ TOWEL RACK — right side, two towels ── */}
        <div className="absolute" style={{ right: '3%', top: '26%' }}>
          {/* Top rack bar */}
          <div style={{ position: 'relative', width: 42, height: 4, background: 'linear-gradient(180deg, #E4E4E4, #C0C0C0)', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)' }} />
          {/* Posts */}
          <div className="absolute" style={{ top: 0, left: -1, width: 4, height: 58, background: 'linear-gradient(180deg, #D4D4D4, #B0B0B0)', borderRadius: '3px 3px 2px 2px', boxShadow: '1px 0 3px rgba(0,0,0,0.15)' }} />
          <div className="absolute" style={{ top: 0, right: -1, width: 4, height: 58, background: 'linear-gradient(180deg, #D4D4D4, #B0B0B0)', borderRadius: '3px 3px 2px 2px', boxShadow: '1px 0 3px rgba(0,0,0,0.15)' }} />
          {/* Second bar */}
          <div style={{ marginTop: 26, width: 42, height: 4, background: 'linear-gradient(180deg, #E4E4E4, #C0C0C0)', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)' }} />
          {/* Pink-purple towel on top bar */}
          <div className="absolute" style={{ top: 4, left: 2, width: 38, height: 26, background: 'linear-gradient(180deg, #F0E0FF, #DEC0F8)', borderRadius: '0 0 3px 3px', boxShadow: '1px 2px 5px rgba(0,0,0,0.12)' }}>
            {[0,1,2,3,4].map(k => (
              <div key={k} className="absolute left-0 right-0" style={{ top: `${k * 20}%`, height: '10%', background: k % 2 === 0 ? '#B880F0' : 'transparent', opacity: 0.35 }} />
            ))}
            {/* Border strip */}
            <div className="absolute top-0 left-0 right-0" style={{ height: 3, background: '#A060D8', opacity: 0.6, borderRadius: '0 0 1px 1px' }} />
          </div>
          {/* Sky-blue towel on lower bar */}
          <div className="absolute" style={{ top: 30, left: 2, width: 38, height: 26, background: 'linear-gradient(180deg, #D8F0FF, #B8DEFA)', borderRadius: '0 0 3px 3px', boxShadow: '1px 2px 5px rgba(0,0,0,0.12)' }}>
            {[0,1,2,3,4].map(k => (
              <div key={k} className="absolute left-0 right-0" style={{ top: `${k * 20}%`, height: '10%', background: k % 2 === 0 ? '#70C0E8' : 'transparent', opacity: 0.35 }} />
            ))}
            <div className="absolute top-0 left-0 right-0" style={{ height: 3, background: '#48A8D0', opacity: 0.6, borderRadius: '0 0 1px 1px' }} />
          </div>
        </div>

        {/* ══ VANITY / SINK — left side ── */}
        <div className="absolute left-1" style={{ bottom: '57%', width: 68 }}>
          {/* Counter top — white marble-ish */}
          <div style={{ height: 7, background: 'linear-gradient(180deg, #F4F8FC, #E4EEF8)', borderRadius: '3px 3px 0 0', border: '1px solid #C0D4E4', boxShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>
            {/* Vein */}
            <div style={{ position: 'absolute', top: 2, left: 8, width: 30, height: 1, background: 'rgba(180,200,220,0.4)', borderRadius: 2, transform: 'rotate(-8deg)' }} />
          </div>
          {/* Sink basin */}
          <div style={{ height: 24, background: 'linear-gradient(180deg, #EEF8FF, #D4EAF8)', border: '2px solid #A8C4D8', borderTop: 'none', borderRadius: '0 0 8px 8px', position: 'relative', boxShadow: 'inset 0 2px 6px rgba(100,160,200,0.2)' }}>
            {/* Inner basin shadow */}
            <div style={{ position: 'absolute', inset: 3, borderRadius: '0 0 6px 6px', background: 'radial-gradient(ellipse at center bottom, rgba(100,160,210,0.15) 0%, transparent 60%)' }} />
            {/* Faucet */}
            <div style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', width: 16, height: 10, background: 'linear-gradient(135deg, #E4E4E4, #C0C0C0)', borderRadius: '3px 3px 5px 5px', border: '1px solid #B0B0B0', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' }} />
            {/* Drain */}
            <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 10, height: 5, borderRadius: '50%', background: '#B0C8DC', border: '1px solid #90B0C8' }}>
              {[0,1,2].map(li => <div key={li} style={{ position: 'absolute', top: '40%', left: `${25 + li * 18}%`, width: 1, height: '20%', background: '#90A8BC' }} />)}
            </div>
            {/* Water if coverage > 20 */}
            {coverage > 20 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(120,180,220,0.4)', borderRadius: '0 0 8px 8px' }} />}
          </div>
          {/* Soap dispenser on counter */}
          <div style={{ position: 'absolute', top: -14, right: 4, width: 10, height: 18 }}>
            <div style={{ width: 10, height: 14, background: 'linear-gradient(180deg, #F8C8E8, #EEA8D0)', borderRadius: '3px 3px 2px 2px', border: '1px solid #E090C0' }} />
            <div style={{ width: 4, height: 6, background: '#D070A8', margin: '0 auto', borderRadius: '2px 2px 0 0', marginTop: -2 }} />
          </div>
          {/* Cabinet below */}
          <div style={{ height: 30, background: 'linear-gradient(180deg, #C4D8E8, #A4B8CC)', border: '1px solid #90A8BC', borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
            {/* Cabinet door */}
            <div style={{ margin: '3px 4px', height: 24, background: 'linear-gradient(180deg, #D4EAF8, #B4C8DA)', border: '1px solid #90A8C0', borderRadius: 2, position: 'relative' }}>
              {/* Door knob */}
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 8, width: 7, height: 7, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #E0E0E0, #B8B8B8)', border: '1px solid #A0A0A0' }} />
              {/* Wood grain lines */}
              <div style={{ position: 'absolute', top: 4, left: 4, right: 4, height: 1, background: 'rgba(120,160,190,0.2)' }} />
              <div style={{ position: 'absolute', top: 8, left: 4, right: 4, height: 1, background: 'rgba(120,160,190,0.2)' }} />
            </div>
          </div>
        </div>

        {/* ══ SMALL STOOL beside tub (right of tub) ── */}
        <div className="absolute" style={{ bottom: '27%', right: '8%', width: 32 }}>
          {/* Stool top */}
          <div style={{ height: 6, background: 'linear-gradient(180deg, #E8D0B8, #D0B898)', borderRadius: 2, border: '1px solid #C0A080', boxShadow: '1px 1px 3px rgba(0,0,0,0.12)' }}>
            <div style={{ position: 'absolute', top: 2, left: 3, width: 12, height: 1, background: 'rgba(160,100,50,0.2)' }} />
          </div>
          {/* Stool legs */}
          {[4, 22].map(lx => (
            <div key={lx} style={{ position: 'absolute', top: 6, left: lx, width: 3, height: 12, background: 'linear-gradient(180deg, #C8A878, #A08858)', borderRadius: '0 0 2px 2px' }} />
          ))}
          {/* CSS candle on stool */}
          <div style={{ position: 'absolute', top: -16, left: 8, width: 10 }}>
            <div style={{ width: 8, height: 12, background: 'linear-gradient(180deg, #FFF8D0, #FFE060)', borderRadius: '2px 2px 1px 1px', border: '1px solid #E0C040', margin: '0 auto', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, left: 2, width: 3, height: '60%', background: 'rgba(255,255,220,0.5)', borderRadius: 2 }} />
            </div>
            {/* Flame */}
            <div style={{ width: 4, height: 7, background: 'linear-gradient(180deg, #FFF080, #FF9020)', borderRadius: '50% 50% 0 0', margin: '0 auto', boxShadow: '0 0 5px 2px rgba(255,180,40,0.5)' }} />
            {/* Wick */}
            <div style={{ width: 1.5, height: 3, background: '#4A3010', margin: '0 auto', borderRadius: 1, marginTop: -2 }} />
          </div>
        </div>

        {/* ══ PLANT in corner ── */}
        <div className="absolute" style={{ bottom: '21%', left: '2%', width: 28 }}>
          {/* Pot */}
          <div style={{ width: 22, height: 16, background: 'linear-gradient(180deg, #D07050, #B05030)', borderRadius: '2px 2px 5px 5px', border: '1px solid #904020', margin: '0 auto', position: 'relative', boxShadow: '1px 2px 4px rgba(0,0,0,0.15)' }}>
            {/* Pot rim */}
            <div style={{ position: 'absolute', top: -3, left: -2, right: -2, height: 5, background: 'linear-gradient(180deg, #E08060, #C06040)', borderRadius: 2, border: '1px solid #A04020' }} />
            {/* Soil */}
            <div style={{ position: 'absolute', top: 2, left: 2, right: 2, height: 5, background: '#604020', borderRadius: 2 }} />
          </div>
          {/* Plant leaves */}
          {[[-6,-16,35],[-2,-22,-10],[4,-18,15],[8,-14,-25]].map(([lx,ly,rot], li) => (
            <div key={li} style={{ position: 'absolute', bottom: 14, left: 4 + lx, width: 14, height: 22, background: 'linear-gradient(180deg, #50C040, #38A028)', borderRadius: '50% 50% 30% 70%', border: '1px solid #289818', transform: `rotate(${rot}deg)`, transformOrigin: 'bottom center' }} />
          ))}
        </div>

        {/* ══ RUBBER DUCK on floor — CSS ── */}
        <div className="absolute" style={{ bottom: '21%', right: '17%' }}>
          <div style={{ position: 'relative', width: 26, height: 22 }}>
            {/* Body */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: 24, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 38% 38%, #FFE878, #F5C820)', border: '1.5px solid #D4A010', boxShadow: '0 2px 4px rgba(0,0,0,0.18)' }} />
            {/* Head */}
            <div style={{ position: 'absolute', top: 0, right: 2, width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%, #FFE878, #F5C820)', border: '1.5px solid #D4A010' }}>
              {/* Eye */}
              <div style={{ position: 'absolute', top: 4, left: 3, width: 3, height: 3, borderRadius: '50%', background: '#1A1A2A' }} />
              {/* Beak */}
              <div style={{ position: 'absolute', bottom: 3, right: -3, width: 6, height: 4, background: 'linear-gradient(90deg, #E87030, #C05010)', borderRadius: '2px 3px 3px 1px' }} />
            </div>
          </div>
        </div>

        {/* ══ SOAP DISH on tub edge ── */}
        <div className="absolute" style={{ bottom: '35%', left: '28%', width: 22, height: 8 }}>
          {/* Ceramic dish */}
          <div style={{ width: 22, height: 6, background: 'linear-gradient(180deg, #F8F8F8, #E8E8E8)', borderRadius: '3px 3px 5px 5px', border: '1px solid #D0D0D0', boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>
            {/* Dish drain lines */}
            {[0,1,2].map(li => <div key={li} style={{ position: 'absolute', top: 2, left: `${li * 33 + 10}%`, width: 1, height: '40%', background: 'rgba(160,160,160,0.4)' }} />)}
          </div>
          {/* Bar of soap on dish */}
          <div style={{ position: 'absolute', top: -5, left: 4, width: 14, height: 7, background: 'linear-gradient(135deg, #F0E0FF, #D8C8F8)', borderRadius: '3px 3px 2px 2px', border: '1px solid #C0B0E8', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <div style={{ position: 'absolute', top: 2, left: 3, width: 6, height: 1.5, background: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
          </div>
        </div>

        {/* ══ TOWEL RING on wall (right side below towel rack) ── */}
        <div className="absolute" style={{ right: '2%', top: '52%', width: 28 }}>
          {/* Wall mount */}
          <div style={{ position: 'absolute', right: 0, top: 8, width: 6, height: 16, background: 'linear-gradient(180deg, #D8D8D8, #B8B8B8)', borderRadius: 2, border: '1px solid #A0A0A0' }} />
          {/* Chrome ring */}
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '3px solid #C8C8C8', background: 'transparent', position: 'relative', boxShadow: '1px 1px 4px rgba(0,0,0,0.15)' }}>
            <div style={{ position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', borderRadius: '50%', border: '1px solid rgba(200,200,200,0.4)' }} />
          </div>
          {/* Hand towel on ring */}
          <div style={{ position: 'absolute', top: 14, left: 3, width: 16, height: 28, background: 'linear-gradient(180deg, #E0F8F8, #C8EEF0)', borderRadius: '0 0 4px 4px', boxShadow: '1px 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#78C8CC', opacity: 0.7 }} />
            {[1,2,3].map(k => <div key={k} style={{ position: 'absolute', left: 0, right: 0, top: `${k * 25}%`, height: '8%', background: k % 2 === 0 ? '#78C8CC' : 'transparent', opacity: 0.25 }} />)}
          </div>
        </div>

        {/* ══ BATH MAT in front of tub ── */}
        <div className="absolute" style={{ bottom: '20%', left: '20%', right: '20%', height: 14, borderRadius: 7, overflow: 'visible' }}>
          {/* Mat body with stripes */}
          <div className="absolute inset-0" style={{ borderRadius: 7, overflow: 'hidden' }}>
            {['#A8D8F0','#FFFFFF','#C8B8F8','#FFFFFF','#A8D8F0'].map((c, i) => (
              <div key={i} className="absolute top-0 bottom-0" style={{ left: `${i * 20}%`, width: '20%', background: c }} />
            ))}
          </div>
          {/* Mat tufts / fringe bottom */}
          {Array.from({ length: 10 }).map((_, fi) => (
            <div key={fi} style={{ position: 'absolute', bottom: -5, left: `${fi * 10 + 2}%`, width: 2.5, height: 6, background: '#A8D8F0', borderRadius: 2, opacity: 0.8 }} />
          ))}
          {/* Mat tufts top */}
          {Array.from({ length: 10 }).map((_, fi) => (
            <div key={fi} style={{ position: 'absolute', top: -5, left: `${fi * 10 + 2}%`, width: 2.5, height: 6, background: '#A8D8F0', borderRadius: 2, opacity: 0.8 }} />
          ))}
          <div className="absolute inset-0" style={{ borderRadius: 7, border: '1px solid rgba(100,160,200,0.3)' }} />
        </div>

        {/* ══ CLAWFOOT BATHTUB — centered, detailed ── */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '23%', width: 240 }}>
          {/* Tub cast shadow */}
          <div style={{ width: 210, height: 8, borderRadius: '50%', background: 'rgba(80,130,180,0.18)', margin: '0 auto', marginBottom: -4 }} />

          {/* Tub body */}
          <div className="relative" style={{ height: 66 }}>
            <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 28, background: 'linear-gradient(180deg, #FDFEFF 0%, #EEF8FF 35%, #E0F2FF 100%)', border: '4px solid #B4D4EE', boxShadow: '0 4px 18px rgba(100,160,210,0.22), inset 0 2px 5px rgba(255,255,255,0.85)' }}>
              {/* Tub outer rim highlight */}
              <div className="absolute top-0 left-0 right-0" style={{ height: 9, background: 'linear-gradient(180deg, #FAFEFF 0%, #E8F6FF 100%)', borderBottom: '1px solid #C4D8EA' }} />
              {/* Rim inner gloss */}
              <div className="absolute top-2 left-10 right-10" style={{ height: 3, background: 'rgba(255,255,255,0.65)', borderRadius: 4 }} />
              {/* Tub side panel detail lines */}
              <div className="absolute" style={{ top: 12, left: 8, right: 8, height: 2, background: 'rgba(180,210,230,0.35)', borderRadius: 4 }} />
              <div className="absolute" style={{ top: 18, left: 12, right: 12, height: 1, background: 'rgba(180,210,230,0.2)', borderRadius: 4 }} />

              {/* Water level */}
              <div className="absolute bottom-0 left-0 right-0 transition-all duration-700"
                style={{ height: coverage > 30 ? 28 : 14, borderRadius: '0 0 24px 24px', background: coverage > 30 ? 'linear-gradient(180deg, #8CD4F8 0%, #60B8E4 100%)' : 'linear-gradient(180deg, #D4EEFF 0%, #B8DCF4 100%)' }}>
                {/* Surface ripple */}
                <div className="absolute top-0 left-4 right-4" style={{ height: 2, background: 'rgba(255,255,255,0.45)', borderRadius: 4 }} />
                {/* Secondary ripple */}
                {coverage > 30 && <div className="absolute top-3 left-8 right-8" style={{ height: 1, background: 'rgba(255,255,255,0.25)', borderRadius: 4 }} />}
              </div>

              {/* Soap bubbles in water */}
              {coverage > 20 && Array.from({ length: 7 }).map((_, k) => (
                <div key={k} className="absolute rounded-full"
                  style={{ bottom: 5 + k * 2, left: `${10 + k * 11}%`, width: 8 + k * 2, height: 8 + k * 2, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.75), rgba(180,220,255,0.4))', border: '1px solid rgba(160,210,255,0.5)', boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.6)' }} />
              ))}

              {/* Bath bomb — CSS sphere */}
              {coverage > 5 && coverage < 40 && (
                <div className="absolute" style={{ bottom: 16, right: '20%', width: 16, height: 16 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FF9EC8, #E05888)', border: '1px solid #C04070', boxShadow: '0 0 6px rgba(255,100,160,0.5)' }}>
                    <div style={{ position: 'absolute', top: 3, left: 3, width: 5, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                  </div>
                </div>
              )}

              {/* Steam when shower active */}
              {dragShower && Array.from({ length: 4 }).map((_, k) => (
                <div key={k} className="absolute"
                  style={{ bottom: `${28 + k * 12}%`, left: `${18 + k * 18}%`, width: 10, height: 26, background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%)', borderRadius: 8, animation: `float ${1.2 + k * 0.35}s ease-in-out infinite` }} />
              ))}
            </div>

            {/* Chrome faucet assembly */}
            <div className="absolute" style={{ top: -9, left: '50%', transform: 'translateX(-50%)', width: 54 }}>
              {/* Left handle */}
              <div className="absolute left-0 top-2" style={{ width: 12, height: 9, background: 'linear-gradient(135deg, #E4E4E4, #C0C0C0)', borderRadius: '2px 2px 3px 3px', border: '1px solid #B0B0B0', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' }}>
                <div style={{ position: 'absolute', top: 1, left: 2, width: 8, height: 2, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
                {/* Hot indicator */}
                <div style={{ position: 'absolute', bottom: 1, left: '50%', marginLeft: -2, width: 4, height: 2, background: '#FF8080', borderRadius: 1 }} />
              </div>
              {/* Spout */}
              <div className="absolute" style={{ left: '50%', transform: 'translateX(-50%)', top: 0, width: 18, height: 14, background: 'linear-gradient(135deg, #ECECEC, #C8C8C8)', borderRadius: '4px 4px 7px 7px', border: '1px solid #B8B8B8', boxShadow: '0 1px 5px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.5)' }}>
                <div style={{ position: 'absolute', top: 2, left: 2, width: 10, height: 2, background: 'rgba(255,255,255,0.55)', borderRadius: 2 }} />
              </div>
              {/* Right handle */}
              <div className="absolute right-0 top-2" style={{ width: 12, height: 9, background: 'linear-gradient(135deg, #E4E4E4, #C0C0C0)', borderRadius: '2px 2px 3px 3px', border: '1px solid #B0B0B0', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' }}>
                <div style={{ position: 'absolute', top: 1, left: 2, width: 8, height: 2, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
                {/* Cold indicator */}
                <div style={{ position: 'absolute', bottom: 1, left: '50%', marginLeft: -2, width: 4, height: 2, background: '#80C0FF', borderRadius: 1 }} />
              </div>
            </div>

            {/* Bath tray/caddy over tub */}
            <div className="absolute" style={{ top: 8, left: '18%', right: '18%', height: 5, background: 'linear-gradient(180deg, #E8D0B8, #C8B090)', borderRadius: 3, border: '1px solid #B89068', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {/* CSS book on tray */}
              <div style={{ position: 'absolute', top: -10, left: '10%', width: 14, height: 10 }}>
                <div style={{ width: 14, height: 10, background: 'linear-gradient(135deg, #6080E0, #4060C0)', borderRadius: '1px 2px 2px 1px', border: '1px solid #3050A8', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 2, width: 2, background: '#3050A8', borderRadius: '1px 0 0 1px' }} />
                  <div style={{ position: 'absolute', top: 2, left: 5, right: 2, height: 1, background: 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
                  <div style={{ position: 'absolute', top: 5, left: 5, right: 2, height: 1, background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
                </div>
              </div>
              {/* CSS small bottle on tray */}
              <div style={{ position: 'absolute', top: -12, right: '15%', width: 8, height: 12 }}>
                <div style={{ width: 5, height: 3, background: '#C8E840', borderRadius: '1px 1px 0 0', margin: '0 auto', border: '1px solid #A8C020' }} />
                <div style={{ width: 3, height: 2, background: '#D0F040', margin: '0 auto' }} />
                <div style={{ width: 8, height: 8, background: 'linear-gradient(180deg, #D0F040, #A8C820)', borderRadius: '1px 1px 3px 3px', border: '1px solid #90B010' }}>
                  <div style={{ position: 'absolute', top: 1, left: 1, width: 2, height: '50%', background: 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
                </div>
              </div>
            </div>
          </div>

          {/* 4 ornate gold claw feet — 2 at each end */}
          {[10, 30, 192, 212].map((lx, i) => (
            <div key={i} className="absolute" style={{ bottom: -16, left: lx, width: 18, height: 18 }}>
              <div style={{ width: 10, height: 14, background: 'linear-gradient(180deg, #ECD040, #C8A020)', borderRadius: '0 0 5px 5px', border: '1px solid #A07810', marginLeft: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.2)', position: 'relative' }}>
                {/* Highlight */}
                <div style={{ position: 'absolute', top: 2, left: 2, width: 3, height: '40%', background: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />
              </div>
              {/* Claw toes */}
              <div className="absolute bottom-0 left-1" style={{ width: 6, height: 6, background: 'linear-gradient(180deg, #D8B830, #B09020)', borderRadius: '0 0 0 4px', border: '1px solid #9A7810' }} />
              <div className="absolute bottom-0 right-1" style={{ width: 6, height: 6, background: 'linear-gradient(180deg, #D8B830, #B09020)', borderRadius: '0 0 4px 0', border: '1px solid #9A7810' }} />
            </div>
          ))}
        </div>

        {/* ══ TOILET — right corner ── */}
        <div className="absolute" style={{ bottom: '42%', right: '1%', width: 46 }}>
          {/* Tank */}
          <div style={{ width: 36, height: 28, background: 'linear-gradient(180deg, #F2F8FC, #E0EEF8)', borderRadius: '4px 4px 2px 2px', border: '1.5px solid #B8D0E0', margin: '0 auto', position: 'relative', boxShadow: '1px 1px 4px rgba(0,0,0,0.1)' }}>
            {/* Tank lid */}
            <div style={{ position: 'absolute', top: -5, left: -2, right: -2, height: 6, background: 'linear-gradient(180deg, #F8FCFF, #E8F4FA)', borderRadius: 4, border: '1px solid #C0D8E8' }} />
            {/* Flush button */}
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 10, height: 7, borderRadius: 4, background: 'linear-gradient(180deg, #E4EEF8, #C8DCF0)', border: '1px solid #A8C0D8' }} />
            {/* Water line */}
            <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, height: 1, background: 'rgba(130,180,220,0.35)' }} />
          </div>
          {/* Bowl top */}
          <div style={{ width: 46, height: 10, background: 'linear-gradient(180deg, #F2F8FC, #E0EEF8)', borderRadius: '50%', border: '1.5px solid #B8D0E0', margin: '0 auto', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }} />
          {/* Bowl body */}
          <div style={{ width: 40, height: 22, background: 'linear-gradient(180deg, #EEF6FC, #DCE8F4)', borderRadius: '0 0 20px 20px', border: '1.5px solid #B8D0E0', borderTop: 'none', margin: '0 auto', position: 'relative', boxShadow: 'inset 0 4px 8px rgba(100,160,200,0.1)' }}>
            {/* Water in bowl */}
            <div style={{ position: 'absolute', bottom: 4, left: 8, right: 8, height: 8, borderRadius: '0 0 12px 12px', background: 'rgba(160,210,240,0.3)', borderTop: '1px solid rgba(120,190,230,0.3)' }} />
          </div>
        </div>

        {/* ── Floor shadow at wall base ── */}
        <div className="absolute left-0 right-0" style={{ top: '58%', height: 12, background: 'linear-gradient(180deg, rgba(80,140,180,0.12) 0%, transparent 100%)' }} />

      </div>

      {/* ══ SOAP SUDS on Eren ═════════════════════════════════════════════ */}
      <div className="absolute inset-0 pointer-events-none">
        {bubbles.map(b => (
          <div key={b.id} className="absolute rounded-full"
            style={{
              left: `${b.x}%`, top: `${b.y}%`,
              width: b.size, height: b.size,
              transform: 'translate(-50%,-50%)',
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.92), rgba(200,235,255,0.5))',
              border: '1px solid rgba(150,200,255,0.4)',
              boxShadow: '0 0 5px rgba(150,200,255,0.3)',
            }} />
        ))}
      </div>

      {/* ══ WATER DROPS from shower ═══════════════════════════════════════ */}
      {dragShower && (
        <div className="absolute pointer-events-none overflow-hidden"
          style={{ left: `${showerPos.x}%`, top: `${showerPos.y}%`, transform: 'translateX(-50%)', width: 60, height: 120 }}>
          {[-18,-10,-3,4,12,20].map((ox, i) => (
            <div key={i} className="absolute rounded-full bg-sky-400/80"
              style={{ left: 30 + ox, top: 24, width: 2, height: 18, animation: `fall 0.5s linear ${i * 0.06}s infinite` }} />
          ))}
        </div>
      )}

      {/* ══ PIXEL EREN in tub ════════════════════════════════════════════ */}
      <div className={cn('absolute transition-all duration-500', done ? 'bottom-[32%]' : 'bottom-[30%]', 'left-[35%]')}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 130, height: 130, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ SHOWER HEAD (draggable when soap done) ═══════════════════════ */}
      <div
        ref={showerRef}
        className={cn('absolute z-30 transition-all', showShower ? 'opacity-100' : 'opacity-0 pointer-events-none', dragShower ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ left: `${showerPos.x}%`, top: `${showerPos.y}%`, transform: 'translate(-50%, -50%)', touchAction: 'none' }}
        onPointerDown={onShowerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onShowerUp}
      >
        {/* Hose pipe */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-7" style={{ background: 'linear-gradient(180deg, #9ECAE1, #6BAED6)', borderRadius: 3 }} />
        {/* Head body */}
        <div className="relative mt-6 flex items-center justify-center"
          style={{ width: 44, height: 18, background: 'linear-gradient(135deg, #AADDF0, #70B8D8)', borderRadius: '4px 4px 10px 10px', border: '2px solid #4A9AB8', boxShadow: '1px 2px 0 #3080A0, inset 0 1px 2px rgba(255,255,255,0.4)' }}>
          {/* Nozzle row */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {[0,1,2,3,4].map(ni => (
              <div key={ni} className="rounded-full" style={{ width: 3, height: 3, background: 'rgba(30,80,120,0.5)' }} />
            ))}
          </div>
          {/* Highlight */}
          <div style={{ position: 'absolute', top: 2, left: 4, width: 14, height: 3, background: 'rgba(255,255,255,0.45)', borderRadius: 3 }} />
          {/* Water streams */}
          {dragShower && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none" style={{ marginTop: 2 }}>
              {[0,3,7,11,15].map((ox, si) => (
                <div key={si} className="rounded-full"
                  style={{ width: 2, height: 28 + si * 2, background: 'rgba(100,190,240,0.8)', animation: `fall 0.45s linear ${si * 0.05}s infinite` }} />
              ))}
            </div>
          )}
        </div>
        {showShower && coverage >= 50 && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-sky-600" style={{ fontSize: 6 }}>
            {coverage <= 15 ? 'DONE SOON!' : 'DRAG TO RINSE!'}
          </div>
        )}
      </div>

      {/* ══ SOAP BAR (draggable) ══════════════════════════════════════════ */}
      <div
        ref={soapRef}
        className={cn('absolute z-30', dragSoap ? 'cursor-grabbing scale-110' : 'cursor-grab', done && 'opacity-30 pointer-events-none')}
        style={{ left: `${soapPos.x}%`, top: `${soapPos.y}%`, transform: 'translate(-50%,-50%)', transition: dragSoap ? 'none' : 'all 0.2s', touchAction: 'none' }}
        onPointerDown={onSoapDown}
        onPointerMove={onPointerMove}
        onPointerUp={onSoapUp}
      >
        <div className="flex flex-col items-center justify-center"
          style={{ width: 48, height: 30, background: 'linear-gradient(135deg, #FFE4F2 0%, #FF9EC8 45%, #FF6B9D 100%)', borderRadius: 4, border: '2px solid #CC4080', boxShadow: '2px 3px 0 #991A5A' }}>
          <span className="font-pixel text-white/90" style={{ fontSize: 6, letterSpacing: 1 }}>SOAP</span>
          <div className="flex gap-1 mt-0.5">
            {[0,1,2,3].map(k => <div key={k} className="rounded-full" style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.4)' }} />)}
          </div>
          {/* Highlight streak */}
          <div style={{ position: 'absolute', top: 4, left: 5, width: 12, height: 3, background: 'rgba(255,255,255,0.4)', borderRadius: 3 }} />
        </div>
        {!dragSoap && coverage < 60 && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-pink-500" style={{ fontSize: 6 }}>
            DRAG ON EREN!
          </div>
        )}
      </div>

      {/* ══ PIXEL BACK BUTTON ════════════════════════════════════════════ */}
      <button onClick={onClose} className="absolute top-4 left-4 z-50 flex items-center gap-1.5 active:translate-y-[2px] transition-transform"
        style={{ background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 3, border: '2px solid #D8C0F0', boxShadow: '0 3px 0 #C0A0E0', padding: '6px 10px' }}>
        <ChevronLeft size={14} className="text-purple-500" />
        <span className="font-pixel text-purple-500" style={{ fontSize: 6 }}>BACK</span>
      </button>

      {/* ══ PIXEL SCENE LABEL ════════════════════════════════════════════ */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <span className="font-pixel text-sky-700 px-3 py-1.5"
          style={{ background: 'linear-gradient(135deg, #E8F8FF, #D0EEFF)', borderRadius: 3, border: '2px solid #A8D4F0', boxShadow: '2px 2px 0 #88B8D8', fontSize: 7 }}>
          BATHROOM
        </span>
      </div>

      {/* ══ TOAST ════════════════════════════════════════════════════════ */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2.5 animate-float whitespace-nowrap"
          style={{ background: '#1F3A4E', borderRadius: 3, border: '2px solid #3A6A8E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {/* ══ PIXEL PROGRESS BARS + DONE ═══════════════════════════════════ */}
      <div className="absolute bottom-4 inset-x-0 px-5 flex flex-col gap-2 items-center pointer-events-none">
        {!done && (
          <div className="w-full max-w-xs pointer-events-none"
            style={{ background: 'linear-gradient(180deg, #1A2A38, #1A2A38)', borderRadius: 4, border: '2px solid #3A5A70', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', padding: '10px 12px' }}>
            {/* Soap coverage */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-pixel text-sky-300" style={{ fontSize: 6 }}>SOAP</span>
              <span className="font-pixel text-sky-400" style={{ fontSize: 6 }}>{Math.round(coverage)}%</span>
            </div>
            <div className="flex gap-0.5 mb-2.5">
              {Array.from({ length: SOAP_SEGMENTS }).map((_, si) => {
                const lit = si < soapFilled
                return (
                  <div key={si} style={{
                    flex: 1, height: 8, borderRadius: 1,
                    background: lit ? '#FF6B9D' : '#2A3A48',
                    border: lit ? '1px solid #FF4080' : '1px solid #3A4A58',
                    boxShadow: lit ? 'inset 0 1px 0 rgba(255,255,255,0.3), 0 0 4px rgba(255,100,160,0.4)' : 'none',
                    transition: 'all 0.15s',
                    transitionDelay: `${si * 20}ms`,
                  }} />
                )
              })}
            </div>
            {/* Rinse progress */}
            {coverage >= 60 && (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-pixel text-sky-300" style={{ fontSize: 6 }}>RINSE</span>
                  <span className="font-pixel text-sky-400" style={{ fontSize: 6 }}>{Math.max(0, Math.round(100 - coverage))}%</span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: SOAP_SEGMENTS }).map((_, si) => {
                    const lit = si < rinseFilled
                    return (
                      <div key={si} style={{
                        flex: 1, height: 8, borderRadius: 1,
                        background: lit ? '#6BAED6' : '#2A3A48',
                        border: lit ? '1px solid #4A90BC' : '1px solid #3A4A58',
                        boxShadow: lit ? 'inset 0 1px 0 rgba(255,255,255,0.3), 0 0 4px rgba(100,170,220,0.4)' : 'none',
                        transition: 'all 0.15s',
                        transitionDelay: `${si * 20}ms`,
                      }} />
                    )
                  })}
                </div>
              </>
            )}
            {coverage >= 60 && !saving && (
              <p className="font-pixel text-sky-400 text-center mt-2" style={{ fontSize: 6 }}>DRAG SHOWER TO RINSE!</p>
            )}
            {saving && <p className="font-pixel text-sky-400 text-center mt-2 animate-pulse" style={{ fontSize: 6 }}>SAVING...</p>}
          </div>
        )}

        {done && (
          <div className="w-full max-w-xs pointer-events-auto text-center py-3 active:translate-y-[2px] transition-transform"
            style={{ background: 'linear-gradient(135deg, #50D890, #30C070)', borderRadius: 3, border: '2px solid #20A050', boxShadow: '0 4px 0 #108030', fontFamily: '"Press Start 2P"', fontSize: 8, color: 'white', letterSpacing: 0.5 }}>
            SQUEAKY CLEAN!
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fall {
          from { transform: translateY(-4px); opacity: 1; }
          to   { transform: translateY(40px); opacity: 0; }
        }
        @keyframes flicker {
          0%, 100% { transform: scaleX(1) scaleY(1); opacity: 1; }
          50% { transform: scaleX(0.8) scaleY(1.1); opacity: 0.85; }
        }
      `}</style>
    </div>
  )
}

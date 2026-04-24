'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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

  const sceneRef   = useRef<HTMLDivElement>(null)
  const soapRef    = useRef<HTMLDivElement>(null)
  const showerRef  = useRef<HTMLDivElement>(null)

  // Positions stored in refs — updated directly on DOM, no re-render
  const soapPosRef   = useRef({ x: 12, y: 62 })
  const showerPosRef = useRef({ x: 75, y: 30 })

  const [dragSoap,   setDragSoap]   = useState(false)
  const [dragShower, setDragShower] = useState(false)
  const [coverage,   setCoverage]   = useState(0)
  const [bubbles,    setBubbles]    = useState<Bubble[]>([])
  const [showShower, setShowShower] = useState(false)
  const [done,       setDone]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<string | null>(null)

  const bubbleId      = useRef(0)
  const dragSoapRef   = useRef(false)
  const dragShowerRef = useRef(false)
  const doneRef       = useRef(false)
  const showShowerRef = useRef(false)
  const coverageRef   = useRef(0)

  const cleanliness = stats?.cleanliness ?? 100

  // Apply initial positions to DOM
  useEffect(() => {
    if (soapRef.current) {
      soapRef.current.style.left = `${soapPosRef.current.x}%`
      soapRef.current.style.top  = `${soapPosRef.current.y}%`
    }
    if (showerRef.current) {
      showerRef.current.style.left = `${showerPosRef.current.x}%`
      showerRef.current.style.top  = `${showerPosRef.current.y}%`
    }
  }, [])

  // Stop touch events from bubbling to CareSceneHost swipe handler
  function stopTouchBubble(e: React.TouchEvent) { e.stopPropagation() }

  // ── Soap pointer handlers ─────────────────────────────────────────────────
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
      // Move soap directly via DOM — no re-render
      soapPosRef.current = { x: px, y: py }
      if (soapRef.current) {
        soapRef.current.style.left = `${px}%`
        soapRef.current.style.top  = `${py}%`
      }
      if (px > 22 && px < 78 && py > 55 && py < 95) {
        setCoverage(c => {
          const next = Math.min(100, c + 1.5)
          coverageRef.current = next
          if (next >= 95 && !showShowerRef.current) {
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
      // Move shower directly via DOM — no re-render
      showerPosRef.current = { x: px, y: py }
      if (showerRef.current) {
        showerRef.current.style.left = `${px}%`
        showerRef.current.style.top  = `${py}%`
      }
      if (px > 22 && px < 78 && py > 55 && py < 95) {
        setCoverage(c => {
          const next = Math.max(0, c - 0.6)
          coverageRef.current = next
          return next
        })
        setBubbles(bs => bs.slice(0, Math.max(0, bs.length - 3)))
      }
    }
  }, [])

  function onSoapUp() {
    dragSoapRef.current = false
    setDragSoap(false)
  }

  function onShowerDown(e: React.PointerEvent) {
    if (doneRef.current || coverageRef.current < 80) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragShowerRef.current = true
    setDragShower(true)
  }

  function onShowerUp() {
    dragShowerRef.current = false
    setDragShower(false)
    if (coverageRef.current <= 10 && !doneRef.current) finishWash()
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

  const SOAP_SEGMENTS = 12
  const soapFilled  = Math.round((coverage / 100) * SOAP_SEGMENTS)
  const rinseFilled = showShower ? Math.round(Math.max(0, (100 - coverage) / 100) * SOAP_SEGMENTS) : 0

  return (
    <div
      ref={sceneRef}
      className="fixed inset-0 z-40 overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: 'url(/bathroom.png)', backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* ══ TAP DRIP ══════════════════════════════════════════════════════ */}
      <div className="absolute pointer-events-none" style={{ left: '50%', top: 'calc(50% + 6px)', zIndex: 15 }}>
        <div className="tap-drop" />
        <div className="tap-splash" />
      </div>

      {/* ══ PIXEL EREN ════════════════════════════════════════════════════ */}
      <div className={cn('absolute transition-all duration-500', done ? 'bottom-[12%]' : 'bottom-[10%]')}
        style={{ left: '50%', transform: 'translateX(-50%)' }}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 200, height: 200, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ SOAP SUDS ═════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {bubbles.map(b => (
          <div key={b.id} className="absolute rounded-full"
            style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.size, height: b.size, transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), rgba(200,230,255,0.6))', border: '1px solid rgba(150,200,255,0.5)', boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8)', opacity: 0.85 }} />
        ))}
      </div>

      {/* ══ SHOWER HEAD ═══════════════════════════════════════════════════ */}
      <div
        ref={showerRef}
        className={cn('absolute z-30', showShower ? 'opacity-100' : 'opacity-0 pointer-events-none', dragShower ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ left: '75%', top: '30%', transform: 'translate(-50%, -50%)', touchAction: 'none' }}
        onPointerDown={onShowerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onShowerUp}
        onTouchStart={stopTouchBubble}
        onTouchMove={stopTouchBubble}
        onTouchEnd={stopTouchBubble}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-7" style={{ background: 'linear-gradient(180deg, #9ECAE1, #6BAED6)', borderRadius: 3 }} />
        <div className="relative mt-6 flex items-center justify-center"
          style={{ width: 44, height: 18, background: 'linear-gradient(135deg, #AADDF0, #70B8D8)', borderRadius: '4px 4px 10px 10px', border: '2px solid #4A9AB8', boxShadow: '1px 2px 0 #3080A0, inset 0 1px 2px rgba(255,255,255,0.4)' }}>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {[0,1,2,3,4].map(ni => (
              <div key={ni} className="rounded-full" style={{ width: 3, height: 3, background: 'rgba(30,80,120,0.5)' }} />
            ))}
          </div>
          <div style={{ position: 'absolute', top: 2, left: 4, width: 14, height: 3, background: 'rgba(255,255,255,0.45)', borderRadius: 3 }} />
          {dragShower && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none" style={{ marginTop: 2 }}>
              {[0,3,7,11,15].map((ox, si) => (
                <div key={si} className="rounded-full"
                  style={{ width: 2, height: 28 + si * 2, background: 'rgba(100,190,240,0.8)', animation: `fall 0.45s linear ${si * 0.05}s infinite` }} />
              ))}
            </div>
          )}
        </div>
        {showShower && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-sky-600" style={{ fontSize: 6 }}>
            {coverage <= 15 ? 'DONE SOON!' : 'DRAG TO RINSE!'}
          </div>
        )}
      </div>

      {/* ══ SOAP BAR ══════════════════════════════════════════════════════ */}
      <div
        ref={soapRef}
        className={cn('absolute z-30', dragSoap ? 'cursor-grabbing scale-110' : 'cursor-grab', done && 'opacity-30 pointer-events-none')}
        style={{ left: '12%', top: '62%', transform: 'translate(-50%,-50%)', touchAction: 'none' }}
        onPointerDown={onSoapDown}
        onPointerMove={onPointerMove}
        onPointerUp={onSoapUp}
        onTouchStart={stopTouchBubble}
        onTouchMove={stopTouchBubble}
        onTouchEnd={stopTouchBubble}
      >
        <div className="flex flex-col items-center justify-center"
          style={{ width: 48, height: 30, background: 'linear-gradient(135deg, #FFE4F2 0%, #FF9EC8 45%, #FF6B9D 100%)', borderRadius: 4, border: '2px solid #CC4080', boxShadow: '2px 3px 0 #991A5A' }}>
          <span className="font-pixel text-white/90" style={{ fontSize: 6, letterSpacing: 1 }}>SOAP</span>
          <div className="flex gap-1 mt-0.5">
            {[0,1,2,3].map(k => <div key={k} className="rounded-full" style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.4)' }} />)}
          </div>
          <div style={{ position: 'absolute', top: 4, left: 5, width: 12, height: 3, background: 'rgba(255,255,255,0.4)', borderRadius: 3 }} />
        </div>
        {!dragSoap && !showShower && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-pink-500" style={{ fontSize: 6 }}>
            DRAG ON EREN!
          </div>
        )}
      </div>

      {/* ══ SCENE LABEL ══════════════════════════════════════════════════ */}
      <div className="absolute left-1/2 -translate-x-1/2 z-50" style={{ top: 110 }}>
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

      {/* ══ PROGRESS BARS ════════════════════════════════════════════════ */}
      <div className="absolute bottom-4 inset-x-0 px-5 flex flex-col gap-2 items-center pointer-events-none">
        {!done && (
          <div className="w-full max-w-xs pointer-events-none"
            style={{ background: '#1A2A38', borderRadius: 4, border: '2px solid #3A5A70', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', padding: '10px 12px' }}>
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
            {showShower && (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-pixel text-sky-300" style={{ fontSize: 6 }}>RINSE</span>
                  <span className="font-pixel text-sky-400" style={{ fontSize: 6 }}>{Math.round(Math.max(0, 100 - coverage))}%</span>
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
            {showShower && !saving && coverage > 10 && (
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

        .tap-drop {
          position: absolute;
          left: 0;
          top: 0;
          margin-left: -2px;
          width: 4px;
          height: 6px;
          background: linear-gradient(180deg, rgba(200,230,245,0.85) 0%, rgba(110,180,225,0.98) 100%);
          border-radius: 50% 50% 55% 55% / 35% 35% 85% 85%;
          box-shadow:
            0 0 3px rgba(110,180,230,0.7),
            inset 1px 1px 0 rgba(255,255,255,0.7),
            inset -1px -1px 0 rgba(70,140,190,0.25);
          animation: tapDrop 1.6s cubic-bezier(0.45, 0, 0.85, 0.4) infinite;
          transform-origin: top center;
          opacity: 0;
        }
        @keyframes tapDrop {
          0%   { transform: translateY(-3px) scale(0.6, 0.4); opacity: 0; }
          5%   { transform: translateY(0) scale(1, 1); opacity: 1; }
          22%  { transform: translateY(calc(4vh + 4px)) scale(0.85, 1.3); opacity: 1; }
          23%, 100% { transform: translateY(calc(4vh + 4px)) scale(1, 1); opacity: 0; }
        }

        .tap-splash {
          position: absolute;
          left: 0;
          top: calc(4vh + 4px);
          margin-left: -6px;
          width: 12px;
          height: 2px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(150,205,235,0.85) 0%, rgba(110,180,230,0.35) 55%, rgba(110,180,230,0) 80%);
          opacity: 0;
          animation: tapSplash 1.6s linear infinite;
        }
        @keyframes tapSplash {
          0%, 22%  { opacity: 0; transform: scale(0.3); }
          23%      { opacity: 0.95; transform: scale(1); }
          28%      { opacity: 0.95; transform: scale(1.4); }
          29%, 100% { opacity: 0; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

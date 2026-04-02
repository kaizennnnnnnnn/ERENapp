'use client'

import { useState, useRef, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import PixelEren from '@/components/PixelEren'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { cn } from '@/lib/utils'

interface Props { onClose: () => void }
interface BallPos { x: number; y: number }

export default function PlayScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)

  const [ballPos,      setBallPos]      = useState<BallPos>({ x: 50, y: 44 })
  const [throwCount,   setThrowCount]   = useState(0)
  const [done,         setDone]         = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)
  const [lookDir,      setLookDir]      = useState<'left'|'right'>('right')
  const [ballMoving,   setBallMoving]   = useState(false)
  const [trailDots,    setTrailDots]    = useState<{id:number;x:number;y:number}[]>([])
  const sceneRef = useRef<HTMLDivElement>(null)
  const animRef  = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const trailId  = useRef(0)

  const animateBall = useCallback((sx: number, sy: number, vx: number, vy: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    let x = sx, y = sy, dvx = vx, dvy = vy
    const step = () => {
      x += dvx; y += dvy; dvy += 0.45
      if (x <= 3 || x >= 97) { dvx *= -0.75; x = x <= 3 ? 3 : 97 }
      if (y >= 60)            { dvy *= -0.65; y = 60; dvx *= 0.88 }
      if (y <= 5)             { dvy *= -0.8;  y = 5 }
      setBallPos({ x, y })
      setTrailDots(ts => [...ts.slice(-8), { id: trailId.current++, x, y }])
      if (Math.sqrt(dvx * dvx + dvy * dvy) > 0.35) {
        animRef.current = requestAnimationFrame(step)
      } else {
        setBallMoving(false)
        setTrailDots([])
      }
    }
    animRef.current = requestAnimationFrame(step)
  }, [])

  function handleThrow(e: React.MouseEvent<HTMLDivElement>) {
    if (done) return
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = ((e.clientX - rect.left) / rect.width)  * 100
    const cy = ((e.clientY - rect.top)  / rect.height) * 100
    const dx = cx - ballPos.x, dy = cy - ballPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = Math.min(dist * 0.28, 9)
    setBallMoving(true)
    setLookDir(cx > 50 ? 'right' : 'left')
    animateBall(ballPos.x, ballPos.y, (dx / dist) * speed, (dy / dist) * speed)
    setThrowCount(c => c + 1)
  }

  async function handleDone() {
    if (!user?.id || saving || throwCount < 1) return
    setSaving(true)
    const result = await applyAction(user.id, 'play')
    setSaving(false)
    setDone(true)
    setToast(result.message)
    setTimeout(() => setToast(null), 2500)
  }

  const mood = done ? 'happy' : throwCount >= 3 ? 'playful' : 'idle'
  const energy = stats?.energy ?? 100

  return (
    <div ref={sceneRef}
      className="fixed inset-0 z-40 overflow-hidden select-none"
      onClick={handleThrow}>

      {/* ══ WALL — soft lilac with subtle paint texture ══ */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #EDE4FF 0%, #E0D4FF 60%, #D8CCFF 100%)' }} />
      {/* Wall texture dots */}
      <div className="absolute inset-0 pointer-events-none opacity-15" style={{ backgroundImage: 'radial-gradient(circle, #9060C0 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      {/* Ambient light from window */}
      <div className="absolute pointer-events-none" style={{ top: 0, left: '5%', width: 160, height: 250, background: 'radial-gradient(ellipse at 20% 0%, rgba(200,180,255,0.35) 0%, transparent 70%)' }} />

      {/* ══ CEILING TRIM ══ */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 7, background: 'linear-gradient(180deg, #C8B8F0 0%, #B8A8E0 100%)', boxShadow: '0 2px 6px rgba(120,80,200,0.15)' }} />

      {/* ══ BUNTING FLAGS ══ */}
      <svg className="absolute left-0 right-0 top-0 pointer-events-none" style={{ zIndex: 4 }} width="100%" height="42" viewBox="0 0 400 42" preserveAspectRatio="none">
        <path d="M0,6 Q40,18 80,6 Q120,0 160,8 Q200,18 240,6 Q280,0 320,8 Q360,18 400,6" stroke="#B090E0" strokeWidth="1.8" fill="none" />
        {[18,56,96,136,176,216,256,296,336,374].map((cx, i) => (
          <g key={i}>
            <polygon points={`${cx},7 ${cx-10},30 ${cx+10},30`}
              fill={['#FF6B9D','#F5C842','#A78BFA','#6BAED6','#98FB98','#FF9E5C','#FF6B9D','#A78BFA','#F5C842','#6BAED6'][i]}
              opacity="0.9" />
            {/* Small shine */}
            <polygon points={`${cx-3},10 ${cx-7},20 ${cx},20`} fill="rgba(255,255,255,0.25)" />
          </g>
        ))}
      </svg>

      {/* ══ FLOOR — warm honey planks ══ */}
      <div className="absolute left-0 right-0 bottom-0" style={{ height: '38%' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0" style={{
            left: `${i * 12.5}%`, width: '12.5%',
            background: i % 2 === 0
              ? 'linear-gradient(180deg, #D8BC7E 0%, #C4A864 100%)'
              : 'linear-gradient(180deg, #CEB070 0%, #B89C58 100%)',
            borderRight: '1px solid #A88840',
          }}>
            {/* Wood grain */}
            <div className="absolute left-1 right-1" style={{ top: '28%', height: 1, background: 'rgba(120,80,20,0.12)' }} />
            <div className="absolute left-1 right-1" style={{ top: '62%', height: 1, background: 'rgba(120,80,20,0.08)' }} />
          </div>
        ))}
        {/* Shadow at wall */}
        <div className="absolute top-0 left-0 right-0" style={{ height: 12, background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 100%)' }} />
        {/* Floor gloss */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 20, background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.05))' }} />
      </div>

      {/* ══ BASEBOARD ══ */}
      <div className="absolute left-0 right-0" style={{ bottom: '37.5%', height: 8 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #9A7850, #6A4820)', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }} />
        <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: 'rgba(255,200,120,0.25)' }} />
      </div>

      {/* ══ LEFT WINDOW ══ */}
      <div className="absolute pointer-events-none" style={{ top: '7%', left: '3%', width: 90, height: 76 }}>
        <div className="absolute inset-0" style={{ background: '#7858A8', padding: 5, borderRadius: 3, boxShadow: '2px 4px 12px rgba(80,30,140,0.4), inset 0 1px 0 rgba(200,160,255,0.3)' }}>
          <div className="w-full h-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #B4E0FF 0%, #84CCFF 55%, #5EAA5E 55%, #489A48 100%)' }}>
            {/* Sky glow */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)', top: 0, bottom: '45%' }} />
            {/* Sun */}
            <div className="absolute" style={{ top: 5, right: 10, width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle at 38% 38%, #FFFF88, #F5C030)', boxShadow: '0 0 16px 6px rgba(255,220,50,0.55)' }} />
            {/* Light rays */}
            <div className="absolute" style={{ top: 0, right: 14, width: 3, height: '55%', background: 'linear-gradient(180deg, rgba(255,240,100,0.3), transparent)', transform: 'rotate(8deg)' }} />
            {/* Cloud */}
            <div className="absolute" style={{ top: 8, left: 4, width: 28, height: 12, borderRadius: 8, background: 'rgba(255,255,255,0.92)' }} />
            <div className="absolute" style={{ top: 6, left: 10, width: 18, height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.92)' }} />
            {/* Grass */}
            <div className="absolute bottom-0 left-0 right-0" style={{ height: '45%', background: 'linear-gradient(180deg, #68BB68, #4A9E4A)' }} />
          </div>
          {/* Window bars */}
          <div className="absolute inset-0 flex" style={{ padding: 5 }}><div className="flex-1 border-r-2 border-[#7858A8]" /></div>
          <div className="absolute inset-0 flex flex-col" style={{ padding: 5 }}><div className="flex-1 border-b-2 border-[#7858A8]" /></div>
        </div>
        {/* Curtains */}
        <div className="absolute -left-4 top-0 bottom-0 w-6 rounded-r-xl" style={{ background: 'linear-gradient(160deg, #C884FC, #9060D8)', opacity: 0.85, boxShadow: '2px 0 5px rgba(0,0,0,0.15)' }}>
          {[0.3,0.6].map(y => <div key={y} className="absolute left-0 right-0" style={{ top: `${y*100}%`, height: 1.5, background: 'rgba(0,0,0,0.1)' }} />)}
        </div>
        <div className="absolute -right-4 top-0 bottom-0 w-6 rounded-l-xl" style={{ background: 'linear-gradient(200deg, #C884FC, #9060D8)', opacity: 0.85, boxShadow: '-2px 0 5px rgba(0,0,0,0.15)' }}>
          {[0.3,0.6].map(y => <div key={y} className="absolute left-0 right-0" style={{ top: `${y*100}%`, height: 1.5, background: 'rgba(0,0,0,0.1)' }} />)}
        </div>
        {/* Sill flower */}
        <span className="absolute text-base" style={{ bottom: -2, right: -14 }}>🌸</span>
      </div>

      {/* ══ WALL ART — right side ══ */}
      <div className="absolute pointer-events-none" style={{ top: '8%', right: '4%', width: 72, height: 72 }}>
        {/* Frame */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #D8C8F8, #C0B0E8)', borderRadius: 3, border: '4px solid #9878D0', boxShadow: '3px 3px 0 #7850A8, inset 0 0 0 2px rgba(255,255,255,0.3)' }}>
          {/* Pixel cat art canvas */}
          <div className="absolute inset-2" style={{ background: 'linear-gradient(135deg, #FFF8E8, #F0E8D8)', borderRadius: 1 }}>
            {/* Simple pixel cat face drawing */}
            <div className="absolute" style={{ top: '15%', left: '50%', transform: 'translateX(-50%)', width: 36, height: 36 }}>
              {/* Head */}
              <div style={{ width: 36, height: 28, borderRadius: '50%', background: 'linear-gradient(180deg, #F8E8D0, #EED8C0)', border: '2px solid #D0B890' }} />
              {/* Ears */}
              <div style={{ position: 'absolute', top: -6, left: 3, width: 10, height: 10, background: '#F8E8D0', border: '2px solid #D0B890', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
              <div style={{ position: 'absolute', top: -6, right: 3, width: 10, height: 10, background: '#F8E8D0', border: '2px solid #D0B890', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
              {/* Eyes */}
              <div style={{ position: 'absolute', top: 8, left: 6, width: 8, height: 6, borderRadius: '50%', background: '#4898D4', border: '1.5px solid #2870A8' }} />
              <div style={{ position: 'absolute', top: 8, right: 6, width: 8, height: 6, borderRadius: '50%', background: '#4898D4', border: '1.5px solid #2870A8' }} />
              {/* Nose */}
              <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 5, height: 4, borderRadius: '50%', background: '#F28898' }} />
            </div>
            <p className="absolute bottom-1 left-0 right-0 text-center text-[7px] font-bold text-purple-400">EREN</p>
          </div>
        </div>
      </div>

      {/* ══ WALL SHELF — right side ══ */}
      <div className="absolute pointer-events-none" style={{ right: '3%', top: '42%' }}>
        {/* Shelf board */}
        <div style={{ width: 70, height: 7, background: 'linear-gradient(180deg, #C0A870, #A88848)', borderRadius: 2, boxShadow: '0 3px 6px rgba(0,0,0,0.2), 0 1px 0 rgba(255,220,140,0.3)' }} />
        {/* Brackets */}
        <div style={{ position: 'absolute', top: 7, left: 6, width: 4, height: 14, background: '#9878C0', borderRadius: '0 0 2px 2px' }} />
        <div style={{ position: 'absolute', top: 7, right: 6, width: 4, height: 14, background: '#9878C0', borderRadius: '0 0 2px 2px' }} />
        {/* Items on shelf */}
        <div style={{ position: 'absolute', top: -18, left: 4 }}>
          <span style={{ fontSize: 13 }}>🏆</span>
        </div>
        <div style={{ position: 'absolute', top: -16, left: 26 }}>
          <span style={{ fontSize: 11 }}>⭐</span>
        </div>
        <div style={{ position: 'absolute', top: -16, right: 4 }}>
          <span style={{ fontSize: 12 }}>🎀</span>
        </div>
      </div>

      {/* ══ CAT TOWER — left ══ */}
      <div className="absolute pointer-events-none" style={{ left: 8, bottom: '38%', width: 48 }}>
        {/* Base platform */}
        <div className="absolute" style={{ bottom: 0, left: 0, right: 0, height: 10, background: 'linear-gradient(180deg, #B888E8, #9060C8)', borderRadius: 4, border: '2px solid #6840A0', boxShadow: '0 3px 0 #4A2880' }} />
        {/* Main post — rope texture */}
        <div className="absolute" style={{ bottom: 10, left: '50%', transform: 'translateX(-50%)', width: 13, height: 78, background: 'repeating-linear-gradient(0deg, #C89A5C 0px, #A87A40 4px, #C89A5C 8px)', borderRadius: 2, border: '1px solid #8A6030', boxShadow: 'inset 1px 0 2px rgba(255,200,120,0.2)' }} />
        {/* Side post */}
        <div className="absolute" style={{ bottom: 36, right: 3, width: 8, height: 42, background: 'repeating-linear-gradient(0deg, #C89A5C 0px, #A87A40 4px, #C89A5C 8px)', borderRadius: 2, border: '1px solid #8A6030' }} />
        {/* Platforms */}
        {[{ b: 25, w: 46 }, { b: 50, w: 40 }, { b: 74, w: 46 }].map((p, i) => (
          <div key={i} className="absolute" style={{ bottom: p.b, left: '50%', transform: 'translateX(-50%)', width: p.w, height: 10, background: `linear-gradient(180deg, ${['#D09AFC','#F090FF','#C884F8'][i]} 0%, ${['#9050D8','#C040E0','#9050D8'][i]} 100%)`, borderRadius: 5, border: '2px solid #7030B0', boxShadow: '0 3px 0 #5020A0' }}>
            <div className="absolute inset-x-3 top-1.5 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
          </div>
        ))}
        {/* Top hammock / cozy hole */}
        <div className="absolute" style={{ bottom: 90, left: '50%', transform: 'translateX(-50%)', width: 36, height: 28, borderRadius: '50%', background: 'linear-gradient(180deg, #C884FC, #9060D8)', border: '3px solid #7030B0', boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.2)' }}>
          <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: 'linear-gradient(180deg, #2A1A40, #1A1030)' }} />
          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-55%)', fontSize: 10 }}>😴</span>
        </div>
        {/* Dangling toy */}
        <div className="absolute pointer-events-none" style={{ bottom: '86%', right: 2 }}>
          <div style={{ width: 1, height: 14, background: '#C090E0', margin: '0 auto' }} />
          <span style={{ fontSize: 10 }}>🐭</span>
        </div>
      </div>

      {/* ══ TOY CHEST — right ══ */}
      <div className="absolute pointer-events-none" style={{ right: 8, bottom: '38%', width: 58, height: 48 }}>
        {/* Chest body */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #E05838 0%, #B82818 100%)', borderRadius: '2px 2px 4px 4px', border: '2px solid #901010', boxShadow: '0 4px 0 #780808, 0 5px 10px rgba(0,0,0,0.3)' }}>
          {/* Metal band */}
          <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, height: 4, background: 'linear-gradient(180deg, #E8C030, #C09018)', border: '1px solid #A07010' }} />
          {/* Lock */}
          <div className="absolute" style={{ top: '22%', left: '50%', transform: 'translateX(-50%)', width: 14, height: 10, background: 'linear-gradient(180deg, #F5D840, #C8A020)', borderRadius: 3, border: '1px solid #A07818', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
            <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%', background: '#8A6010', border: '1px solid #6A4008' }} />
          </div>
          {/* Side rivets */}
          {[10, 40].map(x => (
            <div key={x} className="absolute" style={{ top: '70%', left: x, width: 5, height: 5, borderRadius: '50%', background: 'radial-gradient(circle at 35%, #E8D060, #B09020)', border: '1px solid #907010' }} />
          ))}
        </div>
        {/* Lid with hinge */}
        <div className="absolute" style={{ top: -20, left: 0, right: 0, height: 22, background: 'linear-gradient(180deg, #E86850 0%, #C84030 100%)', border: '2px solid #901010', borderRadius: '4px 4px 0 0', transformOrigin: 'bottom center', transform: 'rotate(-35deg)', transformBox: 'fill-box', boxShadow: '0 -2px 5px rgba(0,0,0,0.2)' }}>
          <div style={{ position: 'absolute', top: 4, left: 8, right: 8, height: 2, background: 'rgba(255,200,160,0.4)', borderRadius: 2 }} />
        </div>
        {/* Toys spilling out */}
        <div className="absolute flex gap-0.5 items-end" style={{ top: -12, left: 4, right: 4, justifyContent: 'center' }}>
          <span style={{ fontSize: 13 }}>🎾</span>
          <span style={{ fontSize: 12 }}>🧸</span>
          <span style={{ fontSize: 11 }}>🪀</span>
        </div>
      </div>

      {/* ══ RUG ══ */}
      <div className="absolute pointer-events-none" style={{ bottom: '38%', left: '18%', right: '18%', height: 18, borderRadius: '50%' }}>
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg, #FF6B9D60, #A78BFA60, #6BAED660)', border: '2px solid #A78BFA55' }} />
        {/* Inner ring */}
        <div className="absolute inset-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, #FF6B9D30, #A78BFA30, #6BAED630)' }} />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ width: 8, height: 5, borderRadius: '50%', background: '#A78BFA55' }} />
        </div>
      </div>

      {/* ══ SCATTERED TOYS ══ */}
      <div className="absolute pointer-events-none text-base" style={{ bottom: '39%', left: '63%', transform: 'rotate(15deg)' }}>🧶</div>
      <div className="absolute pointer-events-none text-base" style={{ bottom: '39%', left: '16%', transform: 'rotate(-10deg)' }}>⭐</div>
      <div className="absolute pointer-events-none text-sm" style={{ bottom: '39.5%', left: '75%', transform: 'rotate(20deg)' }}>🎈</div>
      {/* Chalk paw prints on floor */}
      {[[22,62],[34,68],[46,64],[58,70]].map(([l,b], i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left: `${l}%`, bottom: `${b - 38 + 38}%`, opacity: 0.15 }}>
          <div style={{ fontSize: 10, transform: `rotate(${i * 15}deg)` }}>🐾</div>
        </div>
      ))}

      {/* ══ BALL TRAIL ══ */}
      <div className="absolute inset-0 pointer-events-none">
        {trailDots.map((d, i) => (
          <div key={d.id} className="absolute rounded-full"
            style={{ left: `${d.x}%`, top: `${d.y}%`, width: 6 + i * 1.5, height: 6 + i * 1.5, transform: 'translate(-50%,-50%)', opacity: (i + 1) / trailDots.length * 0.45, background: 'radial-gradient(circle, #FF9EC8, #FF6B9D)' }} />
        ))}
      </div>

      {/* ══ BALL ══ */}
      <div className="absolute pointer-events-none z-10"
        style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%`, transform: 'translate(-50%,-50%)', transition: ballMoving ? 'none' : 'all 0.1s' }}>
        <div className="relative" style={{ width: 36, height: 36 }}>
          <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 32% 28%, #FF9EC8, #FF6B9D 55%, #CC3366 100%)', boxShadow: '0 5px 14px rgba(255,107,157,0.55), inset 0 -3px 5px rgba(0,0,0,0.15), inset 2px 2px 4px rgba(255,255,255,0.25)' }} />
          {/* Seam lines */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div style={{ position: 'absolute', top: '20%', left: '10%', right: '10%', height: 1.5, background: 'rgba(180,30,80,0.25)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: '60%', left: '15%', right: '15%', height: 1.5, background: 'rgba(180,30,80,0.2)', borderRadius: 2 }} />
          </div>
          <div className="absolute top-2 left-3 w-3 h-1.5 bg-white/55 rounded-full" />
          <div className="absolute top-4 left-2 w-1.5 h-1.5 bg-white/30 rounded-full" />
        </div>
        {/* Shadow */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 22, height: 5, background: 'rgba(0,0,0,0.14)' }} />
      </div>

      {/* ══ EREN ══ */}
      <div className={cn('absolute z-10 transition-all duration-500', lookDir === 'right' ? 'left-[28%]' : 'left-[52%]')}
        style={{ bottom: '40%', transform: lookDir === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}>
        <PixelEren mood={mood} size={8} animate />
      </div>

      {/* ══ UI ══ */}
      <button onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-4 left-4 z-50 active:scale-95"
        style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', borderRadius: 3, border: '2px solid rgba(160,120,230,0.4)', boxShadow: '2px 2px 0 rgba(120,80,200,0.2)', padding: 8 }}>
        <ChevronLeft size={20} className="text-purple-700" />
      </button>

      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap"
          style={{ background: '#1F1F2E', borderRadius: 3, border: '2px solid #3A3A5E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {throwCount === 0 && !done && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 pointer-events-none animate-pulse-soft"
          style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 3, border: '2px solid #C0A0E8', boxShadow: '2px 2px 0 rgba(150,100,220,0.2)', fontFamily: '"Press Start 2P"', fontSize: 7, color: '#7C3AED' }}>
          TAP TO THROW THE BALL! 🎾
        </div>
      )}

      {/* ══ BOTTOM UI ══ */}
      <div className="absolute bottom-5 inset-x-0 flex flex-col items-center gap-2 px-8 z-20" onClick={e => e.stopPropagation()}>
        {/* Energy bar — pixel segments */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-pixel text-purple-600" style={{ fontSize: 7 }}>⚡ ENERGY</span>
            <span className="font-pixel text-purple-600" style={{ fontSize: 7 }}>{energy}</span>
          </div>
          <div className="flex gap-[3px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1" style={{ height: 10, borderRadius: 2, background: i < Math.round(energy / 100 * 12) ? (energy > 50 ? '#A78BFA' : energy > 25 ? '#F5C842' : '#F87171') : '#E8E0FF', boxShadow: i < Math.round(energy / 100 * 12) ? '0 1px 0 rgba(0,0,0,0.15)' : 'none' }} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-pixel text-purple-600" style={{ fontSize: 7 }}>THROWS: {throwCount}</span>
          {throwCount >= 3 && !done && (
            <span className="font-pixel text-green-600 px-2 py-0.5" style={{ fontSize: 6, background: '#D1FAE5', borderRadius: 2, border: '1px solid #6EE7B7' }}>READY! ★</span>
          )}
        </div>

        <button onClick={handleDone} disabled={throwCount < 1 || done || saving}
          className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px] disabled:opacity-40"
          style={done
            ? { background: '#4ade80', borderRadius: 3, border: '2px solid #16a34a', boxShadow: '0 3px 0 #15803d', fontFamily: '"Press Start 2P"', fontSize: 8 }
            : saving
              ? { background: '#C084FC', borderRadius: 3, border: '2px solid #9333ea', boxShadow: '0 3px 0 #7e22ce', fontFamily: '"Press Start 2P"', fontSize: 8 }
              : throwCount < 1
                ? { background: '#D0C8E8', borderRadius: 3, border: '2px solid #B0A8D0', fontFamily: '"Press Start 2P"', fontSize: 8, color: '#9090B0' }
                : { background: 'linear-gradient(135deg, #C084FC, #A855F7)', borderRadius: 3, border: '2px solid #7C3AED', boxShadow: '0 3px 0 #5B21B6', fontFamily: '"Press Start 2P"', fontSize: 8 }
          }>
          {done ? '✓ GREAT SESSION!' : saving ? 'SAVING...' : 'DONE PLAYING 🎾'}
        </button>
      </div>
    </div>
  )
}

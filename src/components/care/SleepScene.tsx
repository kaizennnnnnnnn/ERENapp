'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'

interface Props { onClose: () => void }

export default function SleepScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()

  const [tuckedIn, setTuckedIn] = useState(false)
  const [tucking,  setTucking]  = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)

  const sleepVal  = stats?.sleep_quality ?? 100
  const isSleepy  = sleepVal < 50

  async function handleTuckIn() {
    if (!user?.id || tucking || tuckedIn) return
    setTucking(true)
    await new Promise(r => setTimeout(r, 700))
    const result = await applyAction(user.id, 'sleep')
    setTucking(false)
    setTuckedIn(true)
    setToast(result.message)
    if (result.success) completeTask('daily_sleep')
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ NIGHT SKY BACKGROUND ══ */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #060418 0%, #0C0830 40%, #130B40 54%, #1A0E08 54%, #110600 100%)' }} />

      {/* Milky way glow */}
      <div className="absolute pointer-events-none" style={{ top: '2%', left: '10%', right: '10%', height: '45%', background: 'radial-gradient(ellipse at 50% 40%, rgba(80,60,160,0.18) 0%, transparent 70%)', transform: 'rotate(-15deg)' }} />

      {/* ══ STARS ══ */}
      {[
        {t:'2%',l:'4%',s:2.5,d:0},{t:'6%',l:'16%',s:1.5,d:0.4},{t:'3%',l:'30%',s:2,d:0.8},{t:'8%',l:'45%',s:1.5,d:1.2},{t:'4%',l:'60%',s:2.5,d:0.6},
        {t:'10%',l:'74%',s:1.5,d:1.0},{t:'5%',l:'86%',s:2,d:0.2},{t:'14%',l:'9%',s:1.5,d:0.7},{t:'17%',l:'26%',s:2.5,d:1.4},{t:'12%',l:'42%',s:1,d:0.3},
        {t:'16%',l:'56%',s:2,d:0.9},{t:'11%',l:'70%',s:1.5,d:0.5},{t:'20%',l:'84%',s:1,d:1.1},{t:'23%',l:'18%',s:1.5,d:0.2},{t:'26%',l:'35%',s:2,d:0.8},
        {t:'21%',l:'52%',s:1,d:1.3},{t:'25%',l:'66%',s:2,d:0.4},{t:'28%',l:'80%',s:1.5,d:0.7},{t:'31%',l:'7%',s:1,d:1.0},{t:'34%',l:'28%',s:1.5,d:0.6},
        {t:'29%',l:'90%',s:1,d:0.3},{t:'7%',l:'95%',s:2,d:1.5},{t:'19%',l:'2%',s:1.5,d:0.1},{t:'32%',l:'49%',s:1,d:1.1},
      ].map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none"
          style={{ top: s.t, left: s.l, width: s.s, height: s.s, background: i % 5 === 0 ? '#FFE8D0' : '#FFF8D0', boxShadow: `0 0 ${s.s * 3}px ${s.s}px rgba(255,248,180,0.65)`, animation: `pulse ${1.8 + i * 0.13}s ease-in-out ${s.d}s infinite` }} />
      ))}

      {/* Shooting star */}
      <div className="absolute pointer-events-none" style={{ top: '12%', left: '60%', width: 60, height: 1.5, background: 'linear-gradient(90deg, rgba(255,255,200,0.9), transparent)', borderRadius: 2, transform: 'rotate(-30deg)', animation: 'float 4s ease-in-out 2s infinite', opacity: 0.7 }} />

      {/* Moon removed — only visible through window, not floating on the wall */}

      {/* ══ FAIRY LIGHTS ══ */}
      <div className="absolute left-0 right-0 pointer-events-none" style={{ top: 0 }}>
        <svg width="100%" height="28" viewBox="0 0 400 28" preserveAspectRatio="none">
          <path d="M0,8 Q40,18 80,8 Q120,2 160,10 Q200,18 240,8 Q280,2 320,10 Q360,18 400,8" stroke="#2A1A08" strokeWidth="1.8" fill="none" />
        </svg>
        {[4,14,26,39,52,64,77,89].map((pct, i) => {
          const colors = ['#FFD700','#FF6B9D','#A78BFA','#6BAED6','#98FB98','#FF9EC8','#F5C842','#C084FC']
          return (
            <div key={i} className="absolute pointer-events-none" style={{ left: `${pct}%`, top: 6, marginLeft: -5 }}>
              {/* Wire hang */}
              <div style={{ width: 1, height: 5, background: '#2A1A08', margin: '0 auto' }} />
              {/* Bulb */}
              <div style={{ width: 10, height: 12, borderRadius: '4px 4px 50% 50%', background: tuckedIn ? colors[i] : `${colors[i]}55`, boxShadow: tuckedIn ? `0 0 10px 4px ${colors[i]}88, 0 0 20px 8px ${colors[i]}44` : 'none', transition: 'all 1.2s ease', border: `1px solid ${colors[i]}88` }}>
                {/* Bulb tip */}
                <div style={{ width: 4, height: 3, background: `${colors[i]}88`, margin: '0 auto', borderRadius: '0 0 2px 2px' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Warm room glow when tucked */}
      {tuckedIn && (
        <div className="absolute pointer-events-none inset-0" style={{ background: 'radial-gradient(ellipse at 60% 75%, rgba(255,160,30,0.06) 0%, transparent 60%)', transition: 'opacity 2s ease' }} />
      )}

      {/* ══ CENTER WINDOW ══ */}
      <div className="absolute pointer-events-none" style={{ top: '5%', left: '50%', transform: 'translateX(-50%)', width: 104, height: 84 }}>
        {/* Frame */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #4A2068, #2E0848)', padding: 6, borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(200,150,255,0.2)' }}>
          {/* Night sky view */}
          <div className="w-full h-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #040210 0%, #0A0620 100%)' }}>
            {/* Stars in window */}
            {[{t:'12%',l:'18%'},{t:'35%',l:'58%'},{t:'60%',l:'25%'},{t:'22%',l:'72%'},{t:'48%',l:'42%'}].map((s, i) => (
              <div key={i} className="absolute rounded-full" style={{ top: s.t, left: s.l, width: i % 2 === 0 ? 2 : 1.5, height: i % 2 === 0 ? 2 : 1.5, background: '#FFF8C0', boxShadow: '0 0 4px 2px rgba(255,248,180,0.6)' }} />
            ))}
            {/* Moon in window */}
            <div className="absolute" style={{ top: '15%', right: '12%', width: 24, height: 24, borderRadius: '50%', background: 'radial-gradient(circle at 42% 42%, #FFF0A0, #E8C840)', boxShadow: '0 0 14px 5px rgba(240,200,60,0.2)' }} />
            <div className="absolute rounded-full" style={{ top: '13%', right: '9%', width: 19, height: 19, background: '#040210' }} />
            {/* City silhouette at bottom */}
            <div className="absolute bottom-0 left-0 right-0" style={{ height: '35%', background: '#0A0614' }}>
              {[0,10,18,28,36,46,55,64,72,80,90].map((x, i) => (
                <div key={i} className="absolute bottom-0" style={{ left: `${x}%`, width: `${5 + (i % 3) * 3}%`, height: `${40 + (i % 4) * 15}%`, background: '#0A0614', borderTop: '1px solid #1A1028' }} />
              ))}
            </div>
          </div>
          {/* Window bars */}
          <div className="absolute inset-0 flex" style={{ padding: 6 }}><div className="flex-1 border-r-2 border-[#4A2068]" /></div>
          <div className="absolute inset-0 flex flex-col" style={{ padding: 6 }}><div className="flex-1 border-b-2 border-[#4A2068]" /></div>
          {/* Glass reflection */}
          <div className="absolute" style={{ top: 6, left: 6, width: '30%', height: '40%', background: 'linear-gradient(135deg, rgba(255,255,255,0.04), transparent)', borderRadius: 2 }} />
        </div>
        {/* Velvet curtains */}
        <div className="absolute -left-6 top-0 bottom-0 w-8 rounded-r-xl" style={{ background: 'linear-gradient(170deg, #5A2080 0%, #3A0858 70%, #280640 100%)', opacity: 0.95, boxShadow: '3px 0 8px rgba(0,0,0,0.4)' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, background: 'rgba(180,120,255,0.25)' }} />
          {[20,40,60,80].map(y => <div key={y} className="absolute left-0 right-0" style={{ top: `${y}%`, height: 2, background: 'rgba(0,0,0,0.12)' }} />)}
        </div>
        <div className="absolute -right-6 top-0 bottom-0 w-8 rounded-l-xl" style={{ background: 'linear-gradient(190deg, #5A2080 0%, #3A0858 70%, #280640 100%)', opacity: 0.95, boxShadow: '-3px 0 8px rgba(0,0,0,0.4)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'rgba(180,120,255,0.25)' }} />
          {[20,40,60,80].map(y => <div key={y} className="absolute left-0 right-0" style={{ top: `${y}%`, height: 2, background: 'rgba(0,0,0,0.12)' }} />)}
        </div>
        {/* Curtain tiebacks */}
        <div className="absolute w-3 h-3 rounded-full" style={{ left: -3, top: '60%', background: 'radial-gradient(circle at 35% 35%, #F5E060, #C09810)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
        <div className="absolute w-3 h-3 rounded-full" style={{ right: -3, top: '60%', background: 'radial-gradient(circle at 35% 35%, #F5E060, #C09810)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
      </div>

      {/* ══ BOOKSHELF — left, floor-anchored ══ */}
      <div className="absolute pointer-events-none" style={{ left: 3, bottom: '44%', width: 52, height: 165 }}>
        {/* Back panel */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #2E1A0C 0%, #1E1008 100%)', border: '2px solid #180C04', borderRadius: 3, boxShadow: '3px 0 10px rgba(0,0,0,0.5)' }}>
          {/* Side highlight */}
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: 'linear-gradient(90deg, rgba(100,60,20,0.4), transparent)' }} />
          {/* Shelves */}
          {[30, 62, 94, 126].map(y => (
            <div key={y} className="absolute left-0 right-0" style={{ top: y, height: 5, background: 'linear-gradient(180deg, #4A3018, #2E1808)', boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }} />
          ))}
          {/* Row 1 — books */}
          <div className="absolute flex items-end gap-[1px] left-1.5" style={{ top: 5, height: 24 }}>
            {[{w:8,h:20,c:'#FF6B9D'},{w:6,h:16,c:'#6BAED6'},{w:9,h:22,c:'#A78BFA'},{w:7,h:18,c:'#F5C842'},{w:5,h:14,c:'#98FB98'}].map((b, i) => (
              <div key={i} style={{ width: b.w, height: b.h, background: `linear-gradient(180deg, ${b.c} 0%, ${b.c}BB 100%)`, borderRadius: '2px 2px 0 0', alignSelf: 'flex-end', boxShadow: 'inset -1px 0 1px rgba(0,0,0,0.2)' }}>
                {/* Spine text line */}
                <div style={{ width: '60%', height: 1, background: 'rgba(255,255,255,0.2)', margin: '3px auto' }} />
              </div>
            ))}
          </div>
          {/* Row 2 — books + stuffed bear */}
          <div className="absolute flex items-end gap-[1px] left-1.5" style={{ top: 35, height: 26 }}>
            {[{w:7,h:18,c:'#98FB98'},{w:6,h:16,c:'#FF9EC8'},{w:8,h:20,c:'#C084FC'},{w:6,h:14,c:'#6BAED6'}].map((b, i) => (
              <div key={i} style={{ width: b.w, height: b.h, background: `linear-gradient(180deg, ${b.c} 0%, ${b.c}BB 100%)`, borderRadius: '2px 2px 0 0', alignSelf: 'flex-end', boxShadow: 'inset -1px 0 1px rgba(0,0,0,0.2)' }} />
            ))}
            {/* Mini bear */}
            <div style={{ alignSelf: 'flex-end', position: 'relative', width: 11, height: 13 }}>
              <div style={{ width: 11, height: 9, borderRadius: '50%', background: 'linear-gradient(180deg, #E8C090, #D4A870)', border: '1px solid #C09050' }} />
              <div style={{ position: 'absolute', top: -3, left: 0, width: 4, height: 4, borderRadius: '50%', background: '#E8C090', border: '1px solid #C09050' }} />
              <div style={{ position: 'absolute', top: -3, right: 0, width: 4, height: 4, borderRadius: '50%', background: '#E8C090', border: '1px solid #C09050' }} />
              <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 3, borderRadius: '50%', background: '#D4A060' }} />
              <div style={{ width: 11, height: 4, background: '#D4A870', borderRadius: '0 0 3px 3px', border: '1px solid #C09050', borderTop: 'none' }} />
            </div>
          </div>
          {/* Row 3 — books */}
          <div className="absolute flex items-end gap-[1px] left-1.5" style={{ top: 67, height: 26 }}>
            {[{w:9,h:22,c:'#FFD700'},{w:6,h:16,c:'#FF6B9D'},{w:8,h:18,c:'#6BAED6'},{w:7,h:20,c:'#A78BFA'}].map((b, i) => (
              <div key={i} style={{ width: b.w, height: b.h, background: `linear-gradient(180deg, ${b.c} 0%, ${b.c}BB 100%)`, borderRadius: '2px 2px 0 0', alignSelf: 'flex-end', boxShadow: 'inset -1px 0 1px rgba(0,0,0,0.2)' }} />
            ))}
          </div>
          {/* Row 4 — books + plant pot */}
          <div className="absolute flex items-end gap-[1px] left-1.5" style={{ top: 99, height: 26 }}>
            {[{w:7,h:22,c:'#A78BFA'},{w:9,h:18,c:'#FF9E5C'},{w:6,h:24,c:'#98FB98'}].map((b, i) => (
              <div key={i} style={{ width: b.w, height: b.h, background: `linear-gradient(180deg, ${b.c} 0%, ${b.c}BB 100%)`, borderRadius: '2px 2px 0 0', alignSelf: 'flex-end', boxShadow: 'inset -1px 0 1px rgba(0,0,0,0.2)' }} />
            ))}
            {/* Mini plant pot */}
            <div style={{ alignSelf: 'flex-end', position: 'relative', width: 12, height: 18 }}>
              <div style={{ position: 'absolute', bottom: 0, left: 1, width: 10, height: 8, background: 'linear-gradient(180deg, #C06040, #9A4020)', borderRadius: '2px 2px 3px 3px', border: '1px solid #803010' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, height: 3, background: '#D07050', borderRadius: 1, border: '1px solid #A04020' }} />
              {[[-2,-12,30],[0,-15,-10],[2,-12,15]].map(([lx,ly,rot], i) => (
                <div key={i} style={{ position: 'absolute', bottom: 8, left: 2 + lx, width: 7, height: 10, background: 'linear-gradient(180deg, #48C038, #309020)', borderRadius: '50% 50% 30% 70%', border: '1px solid #208010', transform: `rotate(${rot}deg)`, transformOrigin: 'bottom center' }} />
              ))}
            </div>
          </div>
          {/* Bottom row — storage box + CSS star + crescent */}
          <div className="absolute flex items-end gap-[1px] left-1.5" style={{ top: 131, height: 26 }}>
            {/* Storage box */}
            <div style={{ width: 14, height: 18, background: 'linear-gradient(180deg, #5A3828, #3A2010)', border: '1px solid #6A4030', borderRadius: 2 }}>
              <div style={{ width: '100%', height: 5, background: '#6A4030', borderRadius: '1px 1px 0 0', borderBottom: '1px solid #3A2010' }} />
            </div>
            {/* 4-point star */}
            <div style={{ alignSelf: 'flex-end', marginBottom: 2, position: 'relative', width: 9, height: 9 }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, transform: 'translateY(-50%)', background: '#F5C820', borderRadius: 2 }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, transform: 'translateX(-50%)', background: '#F5C820', borderRadius: 2 }} />
            </div>
            {/* Small candle */}
            <div style={{ alignSelf: 'flex-end', marginBottom: 2, position: 'relative', width: 8, height: 16 }}>
              <div style={{ position: 'absolute', bottom: 0, width: 8, height: 10, background: 'linear-gradient(180deg, #FFF8DC, #F0E0B0)', borderRadius: '1px 1px 2px 2px', border: '1px solid #D8C888' }} />
              <div style={{ position: 'absolute', bottom: 9, left: '50%', transform: 'translateX(-50%)', width: 1.5, height: 3, background: '#4A3010', borderRadius: 1 }} />
              <div style={{ position: 'absolute', bottom: 11, left: '50%', transform: 'translateX(-50%)', width: 4, height: 5, background: 'linear-gradient(180deg, #FFF060, #FF9020)', borderRadius: '50% 50% 0 0', boxShadow: '0 0 4px 2px rgba(255,200,40,0.5)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ WALL PICTURE FRAME ══ */}
      <div className="absolute pointer-events-none" style={{ top: '18%', right: '8%', width: 56, height: 46 }}>
        {/* Outer frame */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #4A3060, #2E1A48)', borderRadius: 3, padding: 4, boxShadow: '2px 3px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(200,150,255,0.15)' }}>
          {/* Canvas */}
          <div className="w-full h-full" style={{ background: 'linear-gradient(160deg, #0A0618 0%, #150A28 100%)', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
            {/* Moon landscape */}
            <div style={{ position: 'absolute', top: 4, right: 8, width: 12, height: 12, borderRadius: '50%', background: 'radial-gradient(circle at 42% 42%, #FFF0A0, #E8C840)', boxShadow: '0 0 8px 3px rgba(240,200,60,0.2)' }} />
            {/* Reflection on water */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(180deg, #1A1040, #0A0820)' }}>
              <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: '60%', background: 'rgba(240,200,60,0.2)', borderRadius: 2 }} />
            </div>
            {/* Silhouette hills */}
            <div style={{ position: 'absolute', bottom: '40%', left: 0, right: 0, height: 12, background: '#08041A', borderRadius: '50% 50% 0 0' }} />
          </div>
          {/* Frame inner bevel */}
          <div style={{ position: 'absolute', inset: 3, border: '1px solid rgba(160,100,255,0.15)', borderRadius: 1, pointerEvents: 'none' }} />
        </div>
      </div>

      {/* ══ NIGHTSTAND — right ══ */}
      <div className="absolute pointer-events-none" style={{ right: 8, bottom: '44%', width: 58, height: 62 }}>
        {/* Nightstand body */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #3E2414 0%, #2A1408 100%)', border: '2px solid #1A0C04', borderRadius: 4, boxShadow: '3px 3px 10px rgba(0,0,0,0.6)' }}>
          {/* Drawer divider */}
          <div className="absolute left-0 right-0" style={{ top: '48%', height: 2, background: '#4E2E18' }} />
          {/* Drawer handles */}
          <div className="absolute" style={{ top: '22%', left: '50%', transform: 'translateX(-50%)', width: 10, height: 6, borderRadius: 4, background: 'radial-gradient(circle at 35% 35%, #F0D068, #B09028)', border: '1px solid #907018', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
          <div className="absolute" style={{ top: '66%', left: '50%', transform: 'translateX(-50%)', width: 10, height: 6, borderRadius: 4, background: 'radial-gradient(circle at 35% 35%, #F0D068, #B09028)', border: '1px solid #907018', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
          {/* Wood grain */}
          {[15,40,65,88].map(y => <div key={y} className="absolute left-2 right-2" style={{ top: `${y}%`, height: 1, background: 'rgba(255,200,120,0.06)' }} />)}
        </div>
        {/* Lamp on nightstand */}
        <div className="absolute" style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column-reverse', alignItems: 'center' }}>
          {/* Lamp base */}
          <div style={{ width: 20, height: 5, borderRadius: '50%', background: 'linear-gradient(180deg, #5A4030, #3A2010)', marginTop: -1 }} />
          {/* Lamp neck */}
          <div style={{ width: 3, height: 16, background: 'linear-gradient(180deg, #6A5040, #4A3020)' }} />
          {/* Lamp shade */}
          <div style={{ width: 36, height: 22, borderRadius: '60% 60% 4px 4px', background: !tuckedIn ? 'linear-gradient(180deg, #FFE898 0%, #E8A828 80%, #D89018 100%)' : 'linear-gradient(180deg, #4A3020 0%, #2A1808 100%)', border: '2px solid #1A0C04', transition: 'background 1s ease', boxShadow: !tuckedIn ? '0 8px 24px 10px rgba(255,180,30,0.35), inset 0 2px 4px rgba(255,240,120,0.2)' : 'none', position: 'relative' }}>
            {/* Shade bottom glow */}
            {!tuckedIn && <div style={{ position: 'absolute', bottom: -1, left: 4, right: 4, height: 3, borderRadius: '0 0 50% 50%', background: 'rgba(255,200,60,0.6)' }} />}
          </div>
          {/* Light cone when on */}
          {!tuckedIn && <div style={{ width: 0, height: 0, borderLeft: '24px solid transparent', borderRight: '24px solid transparent', borderTop: '20px solid rgba(255,210,80,0.08)' }} />}
        </div>
        {/* Lamp cord going down to floor */}
        <div className="absolute" style={{ bottom: 0, left: '50%', marginLeft: -0.5, width: 1, height: 'calc(100% + 28px)', background: 'rgba(30,10,5,0.5)', borderRadius: 1, pointerEvents: 'none' }} />
        {/* Mini clock on nightstand */}
        <div className="absolute" style={{ bottom: 'calc(100% + 28px)', left: '50%', transform: 'translateX(-50%)', width: 14, height: 14 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%, #2E2050, #1A1030)', border: '1.5px solid #3C2870', boxShadow: '0 0 6px 2px rgba(100,80,200,0.15)' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 1, height: 4, background: '#A090D8', transformOrigin: 'bottom', transform: 'translate(-50%, -100%) rotate(-30deg)', borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 1, height: 3, background: '#C0B0F0', transformOrigin: 'bottom', transform: 'translate(-50%, -100%) rotate(90deg)', borderRadius: 1 }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 2, height: 2, borderRadius: '50%', background: '#A090D8' }} />
            </div>
          </div>
        </div>
        {/* Items on nightstand top — CSS water glass + phone */}
        {/* Small glass of water */}
        <div className="absolute" style={{ bottom: 'calc(100% + 28px)', right: 6, width: 8, height: 12 }}>
          <div style={{ width: 8, height: 10, background: 'linear-gradient(180deg, rgba(160,220,255,0.4), rgba(120,190,240,0.55))', borderRadius: '1px 1px 3px 3px', border: '1px solid #80B8D8' }}>
            <div style={{ position: 'absolute', top: 2, left: 1, width: 3, height: 1.5, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
          </div>
          <div style={{ width: 10, height: 2, background: '#80B8D8', borderRadius: 1, marginLeft: -1, marginTop: 0 }} />
        </div>
        {/* Phone */}
        <div className="absolute" style={{ bottom: 'calc(100% + 28px)', left: 6, width: 8, height: 12 }}>
          <div style={{ width: 8, height: 12, background: 'linear-gradient(180deg, #2A2A3A, #1A1A2A)', borderRadius: 2, border: '1px solid #4A4A5A' }}>
            <div style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 2, background: 'linear-gradient(135deg, #1A2040, #0A1030)', borderRadius: 1 }}>
              <div style={{ position: 'absolute', inset: 1, background: 'rgba(100,120,200,0.2)', borderRadius: 1 }} />
            </div>
            <div style={{ position: 'absolute', bottom: 0.5, left: '50%', transform: 'translateX(-50%)', width: 3, height: 1, borderRadius: 1, background: '#4A4A5A' }} />
          </div>
        </div>
      </div>

      {/* ══ FLOOR — dark wood planks ══ */}
      <div className="absolute left-0 right-0 bottom-0" style={{ height: '44%' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0" style={{
            left: `${i * 14.3}%`, width: '14.3%',
            background: i % 2 === 0 ? 'linear-gradient(180deg, #2C1C0A, #201408)' : 'linear-gradient(180deg, #241608, #181008)',
            borderRight: '1px solid #100800',
          }}>
            <div className="absolute left-2 right-2" style={{ top: '20%', height: 1, background: 'rgba(100,60,20,0.25)' }} />
            <div className="absolute left-2 right-2" style={{ top: '60%', height: 1, background: 'rgba(100,60,20,0.15)' }} />
            {/* Knot detail */}
            {i % 3 === 1 && <div style={{ position: 'absolute', top: '40%', left: '30%', width: 5, height: 4, borderRadius: '50%', background: 'rgba(60,30,5,0.3)', border: '1px solid rgba(60,30,5,0.15)' }} />}
          </div>
        ))}
        {/* Wall-floor shadow */}
        <div className="absolute top-0 left-0 right-0" style={{ height: 10, background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 100%)' }} />
        {/* Floor gloss */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 30, background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.03))' }} />
      </div>

      {/* ══ BASEBOARD ══ */}
      <div className="absolute left-0 right-0" style={{ bottom: '43.5%', height: 7, background: 'linear-gradient(180deg, #3A2010, #200C04)', boxShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
        <div className="absolute top-0 left-0 right-0" style={{ height: 1.5, background: 'rgba(80,50,20,0.3)' }} />
      </div>

      {/* ══ RUG — bedside, with fringe ══ */}
      <div className="absolute pointer-events-none" style={{ bottom: '43.5%', left: '6%', width: '38%', height: 18 }}>
        {/* Rug body */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #3A1A78 0%, #2A0E58 50%, #3E2080 100%)', borderRadius: 4, border: '1px solid #5A3A90', opacity: 0.92 }}>
          {/* Rug pattern stripes */}
          {[20,40,60,80].map(p => <div key={p} className="absolute top-0 bottom-0" style={{ left: `${p}%`, width: 2, background: 'rgba(180,140,255,0.18)' }} />)}
          {/* Center diamond */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(45deg)', width: 8, height: 8, background: 'rgba(180,140,255,0.2)', border: '1px solid rgba(200,160,255,0.25)' }} />
          {/* Inner border */}
          <div style={{ position: 'absolute', inset: 2, border: '1px solid rgba(180,140,255,0.2)', borderRadius: 2 }} />
        </div>
        {/* Left fringe */}
        {Array.from({ length: 6 }).map((_, fi) => (
          <div key={fi} style={{ position: 'absolute', left: `${fi * 17 + 3}%`, bottom: -4, width: 2, height: 5, background: '#5A3A90', borderRadius: 2, opacity: 0.7 }} />
        ))}
        {/* Right fringe */}
        {Array.from({ length: 6 }).map((_, fi) => (
          <div key={fi} style={{ position: 'absolute', left: `${fi * 17 + 3}%`, top: -4, width: 2, height: 5, background: '#5A3A90', borderRadius: 2, opacity: 0.7 }} />
        ))}
      </div>

      {/* Lamp glow on floor */}
      {tuckedIn && (
        <div className="absolute pointer-events-none" style={{ bottom: '44%', right: '8%', width: 100, height: 60, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,180,30,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
      )}

      {/* ══ CAT BED ══ */}
      <div className="absolute pointer-events-none" style={{ bottom: '44%', left: '50%', transform: 'translateX(-50%)' }}>
        {/* Headboard */}
        <div className="absolute" style={{ bottom: 44, left: 0, right: 0, height: 32, background: 'linear-gradient(180deg, #3E2214 0%, #2A1408 100%)', borderRadius: '10px 10px 0 0', border: '2px solid #1A0C04', boxShadow: '0 -3px 10px rgba(0,0,0,0.5)' }}>
          {/* Headboard arch detail */}
          <div className="absolute" style={{ top: 5, left: '50%', transform: 'translateX(-50%)', width: 50, height: 17, borderRadius: '50%', background: 'linear-gradient(180deg, #4A2A18, #3A1A0A)', border: '1px solid #2A1008' }} />
          {/* Small decorative knobs */}
          {[10, 148].map((x, i) => (
            <div key={i} className="absolute" style={{ top: 4, left: x, width: 7, height: 16, background: 'linear-gradient(180deg, #4A2A18, #2A1208)', borderRadius: 3, border: '1px solid #1A0808' }} />
          ))}
        </div>
        {/* Bed frame base */}
        <div style={{ position: 'relative', width: 168, height: 46 }}>
          {/* Mattress */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #FF9EC8 0%, #FF6B9D 60%, #EE5890 100%)', border: '3px solid #CC3366', borderRadius: 6, boxShadow: '0 5px 14px rgba(180,30,80,0.35), inset 0 2px 4px rgba(255,200,220,0.3)' }}>
            {/* Mattress tufting lines */}
            <div style={{ position: 'absolute', top: 4, left: 14, right: 14, height: 1, background: 'rgba(200,50,90,0.25)' }} />
            <div style={{ position: 'absolute', top: 8, left: 14, right: 14, height: 1, background: 'rgba(200,50,90,0.15)' }} />
          </div>
          {/* Footboard rails */}
          <div className="absolute top-0 bottom-0 left-0" style={{ width: 9, background: 'linear-gradient(90deg, #3E1C0C, #2E1008)', borderRadius: '5px 0 0 5px', border: '1px solid #1A0804', boxShadow: '2px 0 4px rgba(0,0,0,0.3)' }} />
          <div className="absolute top-0 bottom-0 right-0" style={{ width: 9, background: 'linear-gradient(270deg, #3E1C0C, #2E1008)', borderRadius: '0 5px 5px 0', border: '1px solid #1A0804', boxShadow: '-2px 0 4px rgba(0,0,0,0.3)' }} />
          {/* Pillow */}
          <div className="absolute top-2.5 left-12 w-18 h-10 rounded-2xl" style={{ width: 68, height: 38, background: 'linear-gradient(135deg, #FFFFFF 0%, #F4EEF8 100%)', border: '2px solid #E0D0F0', boxShadow: '0 2px 5px rgba(100,60,160,0.15)' }}>
            <div style={{ position: 'absolute', top: 6, left: 6, right: 6, height: 1.5, background: 'rgba(180,140,220,0.3)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: 10, left: 6, width: 30, height: 1.5, background: 'rgba(180,140,220,0.2)', borderRadius: 2 }} />
            {/* Small embroidery cross-stitch */}
            <div style={{ position: 'absolute', bottom: 4, right: 6, width: 8, height: 8 }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, transform: 'translateY(-50%)', background: 'rgba(200,140,200,0.5)', borderRadius: 1 }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, transform: 'translateX(-50%)', background: 'rgba(200,140,200,0.5)', borderRadius: 1 }} />
            </div>
          </div>
          {/* Blanket — expands when tucked */}
          <div className={cn('absolute right-2 top-2 transition-all duration-1000')}
            style={{ width: tuckedIn ? 134 : 36, height: tuckedIn ? 41 : 40, background: 'linear-gradient(135deg, #B09AFC 0%, #8A5AED 50%, #7030D8 100%)', border: '2px solid #6028C8', borderRadius: 8, boxShadow: '0 3px 10px rgba(100,40,200,0.35), inset 0 2px 3px rgba(200,180,255,0.2)' }}>
            {tuckedIn && (
              <>
                {[25, 52, 78].map((t, k) => (
                  <div key={k} className="absolute left-3 right-3 rounded-full" style={{ top: `${t}%`, height: 1.5, background: 'rgba(210,190,255,0.35)' }} />
                ))}
                {/* Star pattern on blanket */}
                <div style={{ position: 'absolute', top: 4, right: 8, fontSize: 9, opacity: 0.6 }}>✦</div>
                <div style={{ position: 'absolute', bottom: 4, left: 20, fontSize: 8, opacity: 0.5 }}>✦</div>
              </>
            )}
          </div>
        </div>
        {/* Bed shadow */}
        <div style={{ width: '90%', height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', margin: '2px auto 0' }} />
      </div>

      {/* Slippers on floor — CSS */}
      <div className="absolute pointer-events-none" style={{ bottom: '44.5%', right: '12%' }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, -1].map((flip, i) => (
            <div key={i} style={{ width: 16, height: 9, background: 'linear-gradient(180deg, #C090E0, #9060C0)', borderRadius: flip > 0 ? '8px 4px 4px 8px' : '4px 8px 8px 4px', border: '1px solid #7040A0', boxShadow: '0 2px 3px rgba(80,20,140,0.3)', transform: flip < 0 ? 'scaleX(-1)' : 'none' }}>
              <div style={{ position: 'absolute', top: 1, left: 3, width: 6, height: 3, borderRadius: '3px 3px 0 0', background: 'rgba(255,255,255,0.2)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ══ EREN ══ */}
      <div className={cn('absolute z-10 transition-all duration-700', tuckedIn ? 'bottom-[46%]' : 'bottom-[44%]')} style={{ left: '36%' }}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 130, height: 130, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ ZZZs ══ */}
      {tuckedIn && (
        <div className="absolute pointer-events-none z-20" style={{ bottom: '65%', left: '60%' }}>
          {[{z:'z',s:10,d:0},{z:'z',s:14,d:0.5},{z:'Z',s:18,d:1.0}].map((zz, i) => (
            <span key={i} className="absolute font-bold select-none"
              style={{ fontSize: zz.s, left: i * 16, top: -i * 16, color: '#A5B4FC', opacity: 0.9, fontFamily: '"Press Start 2P"', animation: `float ${1.2 + i * 0.4}s ease-in-out ${zz.d}s infinite` }}>
              {zz.z}
            </span>
          ))}
        </div>
      )}

      {/* Dream cloud when deeply sleeping */}
      {tuckedIn && (
        <div className="absolute pointer-events-none" style={{ bottom: '72%', left: '40%', animation: 'float 5s ease-in-out infinite' }}>
          <div style={{ width: 60, height: 28, borderRadius: 20, background: 'rgba(160,150,240,0.15)', border: '1px solid rgba(180,170,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {/* CSS fish */}
            <div style={{ position: 'relative', width: 12, height: 8, opacity: 0.65 }}>
              <div style={{ width: 9, height: 7, borderRadius: '50% 40% 40% 50%', background: '#6BAED6' }} />
              <div style={{ position: 'absolute', right: -3, top: 0, width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '5px solid #4A90BC' }} />
            </div>
            {/* CSS paw */}
            <div style={{ position: 'relative', width: 9, height: 9, opacity: 0.6 }}>
              <div style={{ width: 5, height: 4, borderRadius: '50%', background: '#C0A0E0', margin: '0 auto' }} />
              {[[-3,1],[3,1],[-1.5,4],[1.5,4]].map(([px,py], k) => (
                <div key={k} style={{ position: 'absolute', left: 4.5 + px, top: py, width: 2.5, height: 2, borderRadius: '50%', background: '#C0A0E0' }} />
              ))}
            </div>
            {/* CSS 4-star */}
            <div style={{ position: 'relative', width: 9, height: 9, opacity: 0.55 }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', background: '#F5E060', borderRadius: 1 }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%)', background: '#F5E060', borderRadius: 1 }} />
            </div>
          </div>
        </div>
      )}

      {/* ══ UI ══ */}
      <button onClick={onClose} className="absolute top-4 left-4 z-50 active:scale-95"
        style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 3, border: '2px solid rgba(200,180,255,0.2)', boxShadow: '2px 2px 0 rgba(0,0,0,0.3)', padding: 8 }}>
        <ChevronLeft size={20} className="text-indigo-200" />
      </button>

      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap"
          style={{ background: '#2E2860', borderRadius: 3, border: '2px solid #4A40A0', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {/* ══ BOTTOM UI ══ */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3 px-8 z-20">
        {/* Sleep quality — pixel bar */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-pixel text-indigo-300" style={{ fontSize: 7 }}>SLEEP QUALITY</span>
            <span className="font-pixel text-indigo-300" style={{ fontSize: 7 }}>{sleepVal}</span>
          </div>
          <div className="flex gap-[3px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1" style={{ height: 10, borderRadius: 2, background: i < Math.round(sleepVal / 100 * 12) ? (sleepVal > 50 ? '#818CF8' : sleepVal > 25 ? '#C084FC' : '#F87171') : '#1E1848', boxShadow: i < Math.round(sleepVal / 100 * 12) ? '0 0 4px rgba(130,120,255,0.5)' : 'none' }} />
            ))}
          </div>
        </div>

        <button onClick={handleTuckIn} disabled={tucking || tuckedIn}
          className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px] disabled:opacity-50"
          style={tuckedIn
            ? { background: '#312E81', borderRadius: 3, border: '2px solid #4338CA', boxShadow: '0 2px 0 #2D3748', fontFamily: '"Press Start 2P"', fontSize: 8 }
            : tucking
              ? { background: '#4F46E5', borderRadius: 3, border: '2px solid #6366F1', fontFamily: '"Press Start 2P"', fontSize: 8 }
              : { background: 'linear-gradient(135deg, #6366F1, #4F46E5)', borderRadius: 3, border: '2px solid #3730A3', boxShadow: '0 3px 0 #2D2A7A', fontFamily: '"Press Start 2P"', fontSize: 8 }
          }>
          {tuckedIn ? 'SLEEPING SOUNDLY...' : tucking ? 'TUCKING IN...' : 'TUCK IN'}
        </button>
      </div>
    </div>
  )
}

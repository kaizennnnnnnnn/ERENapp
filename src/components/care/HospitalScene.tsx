'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { cn } from '@/lib/utils'

interface Props { onClose: () => void }

export default function HospitalScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)

  const [medGiven, setMedGiven] = useState(false)
  const [giving,   setGiving]   = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)

  const reasons: string[] = []
  if ((stats?.cleanliness ?? 100) < 20) reasons.push('Low cleanliness')
  if ((stats?.sleep_quality ?? 100) < 15) reasons.push('Sleep deprived')
  if ((stats?.weight ?? 4) > 7.5) reasons.push('Overweight')

  async function giveMedicine() {
    if (!user?.id || giving || medGiven) return
    setGiving(true)
    await new Promise(r => setTimeout(r, 800))
    const result = await applyAction(user.id, 'medicine')
    setGiving(false)
    setMedGiven(true)
    setToast(result.message)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ WALL — clinical white/cream ══ */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #F6F8FC 0%, #ECEEf4 100%)' }} />
      {/* Subtle wall grid texture */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(170,180,210,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(170,180,210,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* ══ CEILING TRIM ══ */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 6, background: 'linear-gradient(180deg, #D4D8E4 0%, #C0C4D0 100%)', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />

      {/* ══ FLUORESCENT CEILING LIGHT ══ */}
      <div className="absolute pointer-events-none" style={{ top: 6, left: '50%', transform: 'translateX(-50%)', width: 170, height: 14 }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #DDE2F4 0%, #C4CCEC 100%)', border: '1px solid #B0B8D4', borderTop: 'none', borderRadius: '0 0 4px 4px', boxShadow: '0 6px 28px 6px rgba(190,200,250,0.20)' }}>
          {[28, 62, 96, 130].map(x => (
            <div key={x} className="absolute top-2 bottom-2" style={{ left: x, width: 1.5, background: 'linear-gradient(180deg, #9AA8D4, #C4CEE8)', borderRadius: 2 }} />
          ))}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.12)', borderRadius: '0 0 4px 4px' }} />
        </div>
        <div style={{ position: 'absolute', top: 14, left: -50, right: -50, height: 70, background: 'radial-gradient(ellipse at 50% 0%, rgba(200,210,255,0.16) 0%, transparent 70%)' }} />
      </div>

      {/* ══ WAINSCOTING DIVIDER ══ */}
      <div className="absolute left-0 right-0" style={{ top: '58%', height: 8, background: 'linear-gradient(180deg, #D0D4E0 0%, #BCC0CC 100%)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />

      {/* ══ FLOOR — white/grey checkerboard tiles ══ */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: '58%' }}>
        {Array.from({ length: 30 }).map((_, i) => {
          const col = i % 6, row = Math.floor(i / 6)
          return (
            <div key={i} className="absolute" style={{
              left: `${col * (100 / 6)}%`, top: `${row * 20}%`,
              width: `${100 / 6 - 0.3}%`, height: '21%',
              background: (col + row) % 2 === 0
                ? 'linear-gradient(135deg, #F6F8FC 0%, #EAECF4 100%)'
                : 'linear-gradient(135deg, #ECEEF6 0%, #DDE0EC 100%)',
              border: '1px solid rgba(170,180,210,0.35)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
            }} />
          )
        })}
        <div className="absolute top-0 left-0 right-0" style={{ height: 12, background: 'linear-gradient(180deg, rgba(0,0,0,0.07) 0%, transparent 100%)' }} />
      </div>

      {/* ══ BASEBOARD ══ */}
      <div className="absolute left-0 right-0" style={{ top: 'calc(58% + 8px)', height: 6, background: 'linear-gradient(180deg, #D8DCE8, #C0C4D0)', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }} />

      {/* ══ LEFT WINDOW — venetian blinds ══ */}
      <div className="absolute pointer-events-none" style={{ top: '7%', left: '3%', width: 88, height: 76 }}>
        <div className="absolute inset-0" style={{ background: '#BCC0CC', padding: 5, borderRadius: 3, boxShadow: '2px 3px 10px rgba(0,0,0,0.18), inset 0 1px 2px rgba(255,255,255,0.4)' }}>
          <div className="w-full h-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #C8E4F8 0%, #A8D4F8 55%, #72B858 55%, #56A038 100%)' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #B8DCF4 0%, #D4ECFF 55%, transparent 55%)' }} />
            <div className="absolute" style={{ top: 6, right: 10, width: 16, height: 16, borderRadius: '50%', background: 'radial-gradient(circle at 38%, #FFF080, #F4C028)', boxShadow: '0 0 10px 3px rgba(250,200,40,0.45)' }} />
            <div className="absolute" style={{ top: 8, left: 5, width: 22, height: 10, borderRadius: 7, background: 'rgba(255,255,255,0.88)' }} />
            <div className="absolute" style={{ top: 6, left: 12, width: 14, height: 12, borderRadius: 7, background: 'rgba(255,255,255,0.88)' }} />
            <div className="absolute bottom-0 left-0 right-0" style={{ height: '45%', background: 'linear-gradient(180deg, #68B858, #48983A)' }} />
            {/* Venetian blinds overlay */}
            {Array.from({ length: 7 }).map((_, bi) => (
              <div key={bi} className="absolute left-0 right-0" style={{ top: `${bi * 14.3}%`, height: '9%', background: 'rgba(235,240,252,0.62)', border: '1px solid rgba(180,192,220,0.45)', boxShadow: '0 1px 1px rgba(0,0,0,0.04)' }} />
            ))}
            {/* Blind cord */}
            <div className="absolute" style={{ top: 0, right: 9, width: 1, height: '100%', background: 'rgba(180,190,215,0.55)' }} />
          </div>
          {/* Window cross bars */}
          <div className="absolute inset-0 flex" style={{ padding: 5 }}><div className="flex-1 border-r-2 border-[#BCC0CC]" /></div>
          <div className="absolute inset-0 flex flex-col" style={{ padding: 5 }}><div className="flex-1 border-b-2 border-[#BCC0CC]" /></div>
        </div>
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 8, background: 'linear-gradient(180deg, #CCD0DC, #B0B4C4)', borderRadius: '0 0 3px 3px', boxShadow: '0 2px 4px rgba(0,0,0,0.12)' }} />
      </div>

      {/* ══ MEDICAL CROSS (framed on wall) ══ */}
      <div className="absolute pointer-events-none" style={{ top: '7%', left: '50%', transform: 'translateX(-50%)' }}>
        <div className="relative" style={{ width: 56, height: 56 }}>
          <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, #F4EEED, #EDE4E4)', border: '2px solid #D8CCCC', boxShadow: '2px 3px 8px rgba(0,0,0,0.14)' }} />
          <div className="absolute" style={{ top: '50%', left: '14%', right: '14%', height: 13, transform: 'translateY(-50%)', background: 'linear-gradient(180deg, #E22828, #C01414)', borderRadius: 3, boxShadow: 'inset 0 1px 2px rgba(255,120,120,0.3)' }} />
          <div className="absolute" style={{ left: '50%', top: '14%', bottom: '14%', width: 13, transform: 'translateX(-50%)', background: 'linear-gradient(180deg, #E22828, #C01414)', borderRadius: 3, boxShadow: 'inset 1px 0 2px rgba(255,120,120,0.3)' }} />
          <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%)' }} />
        </div>
      </div>

      {/* ══ MEDICAL POSTER (right side) ══ */}
      <div className="absolute pointer-events-none" style={{ top: '6%', right: '4%', width: 60, height: 76 }}>
        <div className="absolute inset-0" style={{ background: '#C8CCD8', padding: 3, borderRadius: 2, boxShadow: '2px 3px 6px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.4)' }}>
          <div className="w-full h-full" style={{ background: '#F9FBFF', borderRadius: 1 }}>
            {/* Header bar */}
            <div style={{ height: 10, background: 'linear-gradient(90deg, #C01414, #A00C0C)', borderRadius: '1px 1px 0 0', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
              <div style={{ width: '55%', height: 2.5, background: 'rgba(255,200,200,0.55)', borderRadius: 2 }} />
            </div>
            {/* Cat silhouette */}
            <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', width: 26, height: 26 }}>
              <div style={{ width: 26, height: 20, borderRadius: '50%', background: '#E4E8F2', border: '1.5px solid #B8BCD0' }} />
              <div style={{ position: 'absolute', top: -4, left: 2, width: 9, height: 9, background: '#E4E8F2', border: '1.5px solid #B8BCD0', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
              <div style={{ position: 'absolute', top: -4, right: 2, width: 9, height: 9, background: '#E4E8F2', border: '1.5px solid #B8BCD0', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
              <div style={{ position: 'absolute', top: 6, left: 4, width: 5, height: 5, borderRadius: '50%', background: '#5C6488' }} />
              <div style={{ position: 'absolute', top: 6, right: 4, width: 5, height: 5, borderRadius: '50%', background: '#5C6488' }} />
              <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 4, height: 3, borderRadius: '50%', background: '#D080A0' }} />
            </div>
            {/* Data lines */}
            {[42, 52, 62].map(t => (
              <div key={t} style={{ position: 'absolute', left: 6, right: 6, top: t, height: 2, background: '#C4C8D8', borderRadius: 2, opacity: 0.7 }} />
            ))}
            {/* Scale bar at bottom */}
            <div style={{ position: 'absolute', bottom: 5, left: 5, right: 5, height: 7, background: '#EFF1F8', border: '1px solid #CDD0E0', borderRadius: 2 }}>
              {[0,1,2,3].map(k => (
                <div key={k} style={{ position: 'absolute', left: `${k * 33}%`, top: 0, bottom: 0, width: 1, background: '#B0B4C8' }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ MEDICINE CABINET (right wall) ══ */}
      <div className="absolute pointer-events-none" style={{ right: 10, top: '20%', width: 74, height: 118 }}>
        {/* Red cross above cabinet */}
        <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20 }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 5, transform: 'translateY(-50%)', background: '#E22828', borderRadius: 1 }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, transform: 'translateX(-50%)', background: '#E22828', borderRadius: 1 }} />
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #E4E8F4 0%, #D0D4E4 100%)', border: '3px solid #ACB0C4', borderRadius: 4, boxShadow: '3px 3px 10px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.45)' }}>
          {/* Glass door */}
          <div className="absolute inset-2" style={{ background: 'linear-gradient(135deg, rgba(238,242,255,0.88) 0%, rgba(218,226,252,0.72) 100%)', border: '1px solid #B8C0D8', borderRadius: 2, boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.65)' }}>
            <div style={{ position: 'absolute', top: 3, left: 3, width: '32%', height: '38%', background: 'linear-gradient(135deg, rgba(255,255,255,0.42), transparent)', borderRadius: 2 }} />
            {/* Shelves */}
            {[28, 57, 86].map(y => (
              <div key={y} style={{ position: 'absolute', left: 3, right: 3, top: y, height: 2, background: '#A8B0C8', borderRadius: 1 }} />
            ))}
            {/* Row 1 — pill bottles */}
            <div style={{ position: 'absolute', top: 8, left: 5, width: 11, height: 17, background: 'linear-gradient(180deg, #E02020, #BC0C0C)', borderRadius: '3px 3px 2px 2px', border: '1px solid #9A0808' }}>
              <div style={{ position: 'absolute', top: -3, left: 1, width: 9, height: 4, background: '#D8D8D8', borderRadius: '2px 2px 0 0', border: '1px solid #B8B8B8' }} />
              <div style={{ position: 'absolute', top: 4, left: 2, right: 2, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
            </div>
            <div style={{ position: 'absolute', top: 6, left: 18, width: 14, height: 19, background: 'linear-gradient(180deg, #3878D4, #1A58B0)', borderRadius: 3, border: '1px solid #1040A0' }}>
              <div style={{ position: 'absolute', top: 2, left: 2, right: 2, height: 4, background: 'rgba(255,255,255,0.28)', borderRadius: 2 }} />
            </div>
            <div style={{ position: 'absolute', top: 8, left: 35, width: 11, height: 17, background: 'linear-gradient(180deg, #32A032, #1A7A1A)', borderRadius: 3, border: '1px solid #0E6010' }}>
              <div style={{ position: 'absolute', top: -3, left: 1, width: 9, height: 4, background: '#D8D8D8', borderRadius: '2px 2px 0 0', border: '1px solid #B8B8B8' }} />
            </div>
            {/* Row 2 */}
            <div style={{ position: 'absolute', top: 34, left: 4, width: 18, height: 20, background: 'linear-gradient(180deg, #E8980C, #C07806)', borderRadius: 3, border: '1px solid #A05E04' }}>
              <div style={{ position: 'absolute', top: 3, left: 2, right: 2, height: 3, background: 'rgba(255,255,255,0.32)', borderRadius: 2 }} />
            </div>
            <div style={{ position: 'absolute', top: 34, left: 25, width: 12, height: 17, background: 'linear-gradient(180deg, #9844D8, #7224BC)', borderRadius: 3, border: '1px solid #5C1AA8' }}>
              <div style={{ position: 'absolute', top: -3, left: 2, width: 8, height: 4, background: '#D8D8D8', borderRadius: '2px 2px 0 0', border: '1px solid #B8B8B8' }} />
            </div>
            {/* Row 3 — bandage box + thermometer */}
            <div style={{ position: 'absolute', top: 62, left: 4, width: 30, height: 14, background: 'linear-gradient(90deg, #F8E8DC, #F0D4C4)', borderRadius: 2, border: '1px solid #D8C0B0' }}>
              {[0,1,2].map(k => (
                <div key={k} style={{ position: 'absolute', top: '30%', left: `${k * 30 + 8}%`, width: 2, height: '40%', background: '#D89898', borderRadius: 1 }} />
              ))}
              <div style={{ position: 'absolute', top: 1, left: 2, right: 2, height: 2, background: '#E22828', borderRadius: 1, opacity: 0.4 }} />
            </div>
            <div style={{ position: 'absolute', top: 63, right: 4, width: 10, height: 18 }}>
              <div style={{ width: 4, height: 14, background: 'linear-gradient(180deg, #D0D4E0, #B0B8C8)', borderRadius: 3, margin: '0 auto' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E82020', border: '1px solid #C01010', margin: '0 auto', marginTop: -3 }} />
            </div>
          </div>
          {/* Door handle */}
          <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 4, height: 22, background: 'linear-gradient(180deg, #D0D4E0, #A8B0C0)', borderRadius: 3, border: '1px solid #909AB0', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </div>
      </div>

      {/* ══ IV STAND (left) ══ */}
      <div className="absolute pointer-events-none" style={{ left: 10, bottom: '43%' }}>
        {/* Pole */}
        <div style={{ width: 5, height: 100, background: 'linear-gradient(90deg, #C8CCD8, #B0B4C4, #C8CCD8)', borderRadius: 3, border: '1px solid #A0A4B4', boxShadow: '1px 0 3px rgba(0,0,0,0.1)', margin: '0 auto' }} />
        {/* Top crossbar */}
        <div style={{ position: 'absolute', top: 0, left: -12, right: -12, height: 5, background: 'linear-gradient(180deg, #D4D8E4, #B8BCC8)', borderRadius: 3, border: '1px solid #A0A4B4' }} />
        {/* Hooks */}
        {[-9, 9].map((x, i) => (
          <div key={i} style={{ position: 'absolute', top: -9, left: `calc(50% + ${x}px)`, transform: 'translateX(-50%)', width: 3, height: 13, background: '#B8C0D0', borderRadius: '3px 3px 0 0' }} />
        ))}
        {/* IV bag */}
        <div style={{ position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%)', width: 30, height: 42 }}>
          <div style={{ width: '100%', height: '78%', background: 'linear-gradient(180deg, #DCF0FF, #C4E4FC)', borderRadius: '6px 6px 3px 3px', border: '1.5px solid #A4C4E4', boxShadow: 'inset 0 2px 5px rgba(200,232,255,0.55)' }}>
            <div style={{ position: 'absolute', top: 4, left: 5, right: 5, height: 1, background: 'rgba(150,198,232,0.4)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', bottom: 0, left: 2, right: 2, height: '52%', background: 'linear-gradient(180deg, rgba(96,178,242,0.28), rgba(76,158,224,0.38))', borderRadius: '0 0 2px 2px', borderTop: '1px solid rgba(76,158,224,0.38)' }} />
          </div>
          <div style={{ width: 2, height: 12, background: 'rgba(130,178,212,0.65)', margin: '0 auto', borderRadius: 2 }} />
          <div style={{ width: 8, height: 4, background: '#B8D4EC', borderRadius: 2, margin: '0 auto', border: '1px solid #98B4CC' }} />
        </div>
        {/* Base with 3 legs */}
        {[-16, 0, 16].map((lx, k) => (
          <div key={k} style={{ position: 'absolute', bottom: -4, left: `calc(50% + ${lx}px)`, transform: `translateX(-50%) rotate(${(k-1)*22}deg)`, width: 10, height: 5, background: '#B0B4C4', borderRadius: '0 0 3px 3px', transformOrigin: 'top center' }} />
        ))}
      </div>

      {/* ══ EXAMINATION TABLE ══ */}
      <div className="absolute pointer-events-none" style={{ bottom: '43%', left: '50%', transform: 'translateX(-50%)', width: 224 }}>
        {/* Padded top surface */}
        <div style={{ height: 16, background: 'linear-gradient(180deg, #EEF0F8 0%, #DDDFE8 100%)', borderRadius: '8px 8px 0 0', border: '2px solid #BCC0D0', boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.65), 0 2px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ position: 'absolute', top: 3, left: 10, right: 10, height: 3, background: 'rgba(255,255,255,0.55)', borderRadius: 4 }} />
          {[32, 80, 128, 176].map(x => (
            <div key={x} style={{ position: 'absolute', top: 4, left: x, width: 2, height: '55%', background: 'rgba(148,158,196,0.18)', borderRadius: 2 }} />
          ))}
        </div>
        {/* Side panel */}
        <div style={{ height: 20, background: 'linear-gradient(180deg, #CCCEE0, #B4B8CC)', border: '2px solid #9A9EB4', borderTop: 'none' }}>
          <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 44, height: 9, background: '#BCC0D0', borderRadius: 3, border: '1px solid #A0A4B8' }}>
            <div style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#ACAFC2', border: '1px solid #8C90A8' }} />
            <div style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#ACAFC2', border: '1px solid #8C90A8' }} />
          </div>
        </div>
        {/* Legs */}
        {[14, 198].map(lx => (
          <div key={lx} style={{ position: 'absolute', bottom: -20, left: lx, width: 8, height: 22, background: 'linear-gradient(180deg, #C0C4D4, #A4A8BC)', borderRadius: '0 0 3px 3px', border: '1px solid #8C90A8' }} />
        ))}
      </div>

      {/* ══ EREN on table ══ */}
      <div className={cn('absolute z-10 transition-all duration-500', 'bottom-[46%] left-[38%]')}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 130, height: 130, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ CONE OF SHAME ══ */}
      {!medGiven && (
        <div className="absolute bottom-[57%] left-[44%] pointer-events-none z-20">
          <div style={{ width: 40, height: 32, borderRadius: '50% 50% 0 0', border: '3px solid #E8CC60', borderBottom: 'none', background: 'transparent', opacity: 0.78 }} />
        </div>
      )}

      {/* ══ CSS SPARKLES after medicine ══ */}
      {medGiven && (
        <div className="absolute bottom-[47%] left-[54%] pointer-events-none z-20">
          {[0, 1, 2].map(i => (
            <div key={i} className="absolute" style={{ left: i * 15, top: -i * 13 }}>
              <div style={{ position: 'relative', width: 14, height: 14, animation: `float ${0.8 + i * 0.35}s ease-in-out infinite` }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2.5, transform: 'translateY(-50%)', background: '#F5C820', borderRadius: 2 }} />
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2.5, transform: 'translateX(-50%)', background: '#F5C820', borderRadius: 2 }} />
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2.5, transform: 'translateY(-50%) rotate(45deg)', background: 'rgba(245,200,32,0.65)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ BACK BUTTON ══ */}
      <button onClick={onClose} className="absolute top-4 left-4 z-50 active:scale-95"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 3, border: '2px solid rgba(170,180,210,0.45)', boxShadow: '2px 2px 0 rgba(130,140,175,0.18)', padding: 8 }}>
        <ChevronLeft size={20} className="text-slate-600" />
      </button>

      {/* ══ SCENE LABEL ══ */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <span className="font-pixel text-slate-600 px-3 py-1.5"
          style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 3, border: '2px solid rgba(170,180,210,0.45)', boxShadow: '2px 2px 0 rgba(130,140,175,0.18)', fontSize: 7 }}>
          VET CLINIC
        </span>
      </div>

      {/* ══ TOAST ══ */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap"
          style={{ background: '#1F2E3E', borderRadius: 3, border: '2px solid #3A4E6E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {/* ══ DIAGNOSIS CARD ══ */}
      {reasons.length > 0 && !medGiven && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-3 w-60"
          style={{ background: '#F9FBFF', border: '2px solid #CCD0E4', borderRadius: 3, boxShadow: '3px 3px 0 rgba(0,0,0,0.1)', fontFamily: '"Press Start 2P"' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {/* Mini cross */}
            <div style={{ position: 'relative', width: 12, height: 12, flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, transform: 'translateY(-50%)', background: '#E22828', borderRadius: 1 }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 4, transform: 'translateX(-50%)', background: '#E22828', borderRadius: 1 }} />
            </div>
            <span style={{ fontSize: 6, color: '#C01818' }}>DIAGNOSIS</span>
          </div>
          {reasons.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#E22828', flexShrink: 0 }} />
              <span style={{ fontSize: 5, color: '#3A4060' }}>{r.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ══ BOTTOM UI ══ */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3 px-8 z-30">
        <div className="w-full max-w-xs px-4 py-3 text-center"
          style={{ background: '#F9FBFF', borderRadius: 3, border: '2px solid #CCD0E4', boxShadow: '3px 3px 0 rgba(0,0,0,0.08)', fontFamily: '"Press Start 2P"' }}>
          <p style={{ fontSize: 6, color: medGiven ? '#1A7A38' : '#C01818' }}>
            {medGiven ? 'TREATMENT COMPLETE. FIX ROOT CAUSE.' : 'EREN IS SICK! ADMINISTER MEDICINE.'}
          </p>
          {!medGiven && (stats?.weight ?? 0) > 6.5 && (
            <p style={{ fontSize: 5, color: '#B05A10', marginTop: 5 }}>
              WEIGHT: {stats?.weight?.toFixed(1)} KG — REDUCE FOOD
            </p>
          )}
        </div>

        <button onClick={giveMedicine} disabled={giving || medGiven}
          className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px] disabled:opacity-50"
          style={medGiven
            ? { background: 'linear-gradient(135deg, #38A850, #24884A)', borderRadius: 3, border: '2px solid #187038', boxShadow: '0 3px 0 #0E5028', fontFamily: '"Press Start 2P"', fontSize: 8 }
            : giving
              ? { background: 'linear-gradient(135deg, #5890E4, #3870C8)', borderRadius: 3, border: '2px solid #1E58B0', fontFamily: '"Press Start 2P"', fontSize: 8 }
              : { background: 'linear-gradient(135deg, #3878D4, #1E58B4)', borderRadius: 3, border: '2px solid #1244A0', boxShadow: '0 3px 0 #0C3080', fontFamily: '"Press Start 2P"', fontSize: 8 }
          }>
          {medGiven ? 'TREATMENT COMPLETE' : giving ? 'GIVING MEDICINE...' : 'GIVE MEDICINE'}
        </button>
      </div>
    </div>
  )
}

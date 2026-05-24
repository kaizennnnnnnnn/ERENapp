'use client'

import { IconFly } from '@/components/PixelIcons'

// Each fly has a unique orbit path defined by CSS keyframes.
// They buzz in erratic figure-8 / oval loops at different speeds
// to look like real flies circling something stinky.
const FLY_PATHS = [
  { name: 'flyBuzz0', dur: '2.1s',  size: 14, startDeg: 0   },
  { name: 'flyBuzz1', dur: '2.6s',  size: 12, startDeg: 120 },
  { name: 'flyBuzz2', dur: '1.8s',  size: 16, startDeg: 240 },
  { name: 'flyBuzz3', dur: '2.3s',  size: 11, startDeg: 60  },
  { name: 'flyBuzz4', dur: '2.9s',  size: 13, startDeg: 180 },
]

// Stink cloud puffs — small green-ish wisps
const PUFF_POSITIONS = [
  { left: '20%', bottom: '55%', delay: '0s',   scale: 1    },
  { left: '72%', bottom: '50%', delay: '0.6s', scale: 0.8  },
  { left: '45%', bottom: '60%', delay: '1.2s', scale: 0.6  },
]

interface Props {
  cleanliness: number
}

export default function StinkyFlies({ cleanliness }: Props) {
  if (cleanliness >= 40) return null

  // More flies as cleanliness drops: 1-2 at 40, 3 at 25, all 5 below 10
  const flyCount = cleanliness < 10 ? 5
    : cleanliness < 20 ? 4
    : cleanliness < 30 ? 3
    : 2

  const showPuffs = cleanliness < 25

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {/* Flies orbit around Eren's head area */}
      {FLY_PATHS.slice(0, flyCount).map((fly, i) => (
        <div key={i} className="absolute" style={{
          left: '50%', bottom: '65%',
          animation: `${fly.name} ${fly.dur} ease-in-out infinite`,
          animationDelay: `${i * 0.3}s`,
        }}>
          <div style={{ transform: `rotate(${fly.startDeg + 30}deg)` }}>
            <div style={{ animation: 'flyWobble 0.15s linear infinite alternate' }}>
              <IconFly size={fly.size} />
            </div>
          </div>
        </div>
      ))}

      {/* Green stink puffs when really dirty */}
      {showPuffs && PUFF_POSITIONS.map((puff, i) => (
        <div key={`p${i}`} className="absolute" style={{
          left: puff.left,
          bottom: puff.bottom,
          animation: `stinkPuff 2.5s ease-in-out infinite`,
          animationDelay: puff.delay,
        }}>
          <svg width={18 * puff.scale} height={14 * puff.scale} viewBox="0 0 18 14" style={{ opacity: 0.5 }}>
            <ellipse cx="9" cy="8" rx="7" ry="5" fill="#8B9A3E" opacity="0.3" />
            <ellipse cx="7" cy="6" rx="4" ry="3" fill="#9AA84A" opacity="0.4" />
            <ellipse cx="12" cy="7" rx="3" ry="2.5" fill="#7A8B32" opacity="0.3" />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes flyBuzz0 {
          0%   { transform: translate(-40px, 0px); }
          15%  { transform: translate(-15px, -30px); }
          30%  { transform: translate(25px, -20px); }
          50%  { transform: translate(35px, 5px); }
          65%  { transform: translate(10px, 20px); }
          80%  { transform: translate(-30px, 15px); }
          100% { transform: translate(-40px, 0px); }
        }
        @keyframes flyBuzz1 {
          0%   { transform: translate(30px, -10px); }
          20%  { transform: translate(10px, -35px); }
          40%  { transform: translate(-25px, -15px); }
          60%  { transform: translate(-35px, 10px); }
          80%  { transform: translate(5px, 25px); }
          100% { transform: translate(30px, -10px); }
        }
        @keyframes flyBuzz2 {
          0%   { transform: translate(-20px, -25px); }
          25%  { transform: translate(30px, -30px); }
          50%  { transform: translate(40px, 10px); }
          75%  { transform: translate(-10px, 20px); }
          100% { transform: translate(-20px, -25px); }
        }
        @keyframes flyBuzz3 {
          0%   { transform: translate(20px, 15px); }
          20%  { transform: translate(40px, -10px); }
          45%  { transform: translate(15px, -35px); }
          70%  { transform: translate(-25px, -5px); }
          100% { transform: translate(20px, 15px); }
        }
        @keyframes flyBuzz4 {
          0%   { transform: translate(-35px, 10px); }
          30%  { transform: translate(-10px, -25px); }
          55%  { transform: translate(30px, -15px); }
          80%  { transform: translate(15px, 20px); }
          100% { transform: translate(-35px, 10px); }
        }
        @keyframes flyWobble {
          from { transform: rotate(-8deg); }
          to   { transform: rotate(8deg); }
        }
        @keyframes stinkPuff {
          0%, 100% { transform: translateY(0) scale(0.6); opacity: 0; }
          20%      { opacity: 0.5; }
          50%      { transform: translateY(-20px) scale(1); opacity: 0.35; }
          80%      { opacity: 0.15; }
        }
      `}</style>
    </div>
  )
}

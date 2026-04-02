'use client'

import { useEffect, useRef, useState } from 'react'
import type { ErenMood } from '@/types'

// Eren's Ragdoll color palette
const PAL: Record<string, string> = {
  '.': 'transparent',
  K: '#1A1A1A',
  O: '#5A5050',
  M: '#7E7272',
  L: '#AEA6A0',
  C: '#F5F3EF',
  B: '#E8E4DC',
  E: '#4898D4',
  G: '#2870A8',
  P: '#1A1A2E',
  W: '#FFFFFF',
  N: '#F28898',
  S: '#D0CCC4',
  T: '#BCBAB0',
  D: '#6A6060',
}

// 24 x 26 pixel maps
const FRAMES: Record<ErenMood, string[][]> = {

  // IDLE
  idle: [
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOMMEEGPEBBBBEPGEEMMOOK',
      'KOOMMEEGPEBBBBEPGEEMMOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      '.KKCSSSCCCCCCCCCCSSSCKKM',
      '..KKCCCSSTTTTTTSSCCCKKMM',
      '..KKKCCCTTTTTTTTCCCKKMMM',
      '...KKKCCCCCCCCCCCCKKK.MM',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOMMEEGPEBBBBEPGEEMMOOK',
      'KOOMMEEGPEBBBBEPGEEMMOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      '.KKCSSSCCCCCCCCCCSSSCKKM',
      '..KKCCCSSTTTTTTSSCCCKKMM',
      '..KKKCCCTTTTTTTTCCCKKMMM',
      '...KKKCCCCCCCCCCCCKKK.MM',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
  ],

  // HAPPY
  happy: [
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOOMMMWWMBBBBMWWMMMOOOK',
      'KOOOMMMMMMBBBBBMMMMMOOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      '.KKCSSSCCCCCCCCCCSSSCKKM',
      '..KKCCCSSTTTTTTSSCCCKKMM',
      '..KKCCCSSTTTTTTSSCCKKMMM',
      '...KKKCCCCCCCCCCCCKKK.MM',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOMMEEGPEBBBBEPGEEMMOOK',
      'KOOMMEEGPEBBBBEPGEEMMOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      'MKKCSSSCCCCCCCCCCSSSCKKK',
      'MMKKCCCSSTTTTTTSSCCCKK..',
      'MMMKKKCCCTTTTTTCCCKKK...',
      '.MMKKKCCCCCCCCCCCKK.....',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
  ],

  // HUNGRY
  hungry: [
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOOMMMGEBBBBBBEGMMMOOOK',
      'KOOOMMMEPBBBBBBBPEMMOOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      '..KKCSSSCCCCCCCCCCSSSCKK',
      'MMKKCCCSSTTTTTTSSCCCKK..',
      '..KKKMMCTTTTTTTTCMMKKK..',
      '...KKKMMMMMMMMMMMMKKK...',
      '....KKCCCKKKKKCCCKKK....',
      '.....KKKKK...KKKKKK.....',
    ],
  ],

  // SLEEPY
  sleepy: [
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOOMMMEMMBBBBMMEMMOOOOK',
      'KOOOMMMMMMBBBBBMMMMMOOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      '..KKCSSSCCCCCCCCCCSSSCKK',
      'MMKKCCCSSTTTTTTSSCCCKK..',
      '..KKKMMCTTTTTTTTCMMKKK..',
      '...KKKMMMMMMMMMMMMKKK...',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOOMMMMMMBBBBBMMMMMOOOK',
      'KOOOMMMMMMBBBBBMMMMMOOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      '..KKCSSSCCCCCCCCCCSSSCKK',
      'MMKKCCCSSTTTTTTSSCCCKK..',
      '..KKKMMCTTTTTTTTCMMKKK..',
      '...KKKMMMMMMMMMMMMKKK...',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
  ],

  // PLAYFUL
  playful: [
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOMMEPPPEBBBBEPPPEMMOOK',
      'KOOMMEPPPEBBBBEPPPEMMOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      '.KKCSSSCCCCCCCCCCSSSCKKM',
      '..KKCCCSSTTTTTTSSCCCKKMM',
      '..KKKCCCTTTTTTTTCCCKKMMM',
      '...KKKCCCCCCCCCCCCKKK.MM',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMMMMMMMMMMMMMOOOOK',
      'KOOOMMMMMLLLLLLMMMMMOOOK',
      'KOOOMMLLLBBBBBBLLLMMOOOK',
      'KOOMMEPPPEBBBBEPPPEMMOOK',
      'KOOMMEPPPEBBBBEPPPEMMOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      'MKKCSSSCCCCCCCCCCSSSCKKK',
      'MMKKCCCSSTTTTTTSSCCCKK..',
      'MMMKKKCCCTTTTTTCCCKKK...',
      '.MMKKKCCCCCCCCCCCKK.....',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
  ],

  // ANGRY
  angry: [
    [
      '....KKKK........KKKK....',
      '...KOOOMK......KMOOOK...',
      '..KOOMMMK......KMMMOOK..',
      '.KOOOMMMMOOOOOMMMMMOOOK.',
      'KOOOMMMKMMMMMMMMKMMMOOOK',
      'KOOOMMLKMBBBBBBMKLLMOOOK',
      'KOOOKKLLLBBBBBBLLKKMOOOK',
      'KOOKMMEEGPEBBBBEPGEEMMKK',
      'KOOMMMEGPEBBBBEPGEMMMOOK',
      'KOOOMMMMMBBNBBMMMMMOOOK.',
      '.KOOOMMMBBBBBBBBBMMOOOK.',
      '..KOOMMBBBBBBBBBBBMMOOK.',
      '...KOOOMMMMMMMMMMOOOOK..',
      '...KKKKKKKKKKKKKKKKKK...',
      '..KKCCCCCCCCCCCCCCCCKKK.',
      '.KKCCCCCCCCCCCCCCCCCCKK.',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCCCSSCCCCCCCCCCSSCCCKK',
      'KKCSSSCCCCCCCCCCCSSSCKCK',
      '.KKCSSSCCCCCCCCCCSSSCKKM',
      '..KKCCCSSTTTTTTSSCCCKKMM',
      '..KKKCCCTTTTTTTTCCCKKMMM',
      '...KKKCCCCCCCCCCCCKKK.MM',
      '....KKCCCKKKKKCCCKKM....',
      '.....KKKKK...KKKKK......',
    ],
  ]
}

interface Props {
  mood?: ErenMood
  size?: number
  animate?: boolean
}

export default function PixelEren({ mood = 'idle', size = 9, animate = true }: Props) {
  const [frameIdx, setFrameIdx] = useState(0)
  const [blinking, setBlinking] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blinkRef    = useRef<ReturnType<typeof setTimeout>  | null>(null)

  const frames = FRAMES[mood] ?? FRAMES.idle

  useEffect(() => {
    if (!animate || frames.length <= 1) { setFrameIdx(0); return }
    intervalRef.current = setInterval(() => {
      setFrameIdx(i => (i + 1) % frames.length)
    }, mood === 'sleepy' ? 1800 : mood === 'playful' ? 350 : 1200)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [mood, animate, frames.length])

  useEffect(() => {
    if (!animate) return
    function scheduleBlink() {
      const delay = 3000 + Math.random() * 5000
      blinkRef.current = setTimeout(() => {
        setBlinking(true)
        setTimeout(() => { setBlinking(false); scheduleBlink() }, 140)
      }, delay)
    }
    scheduleBlink()
    return () => { if (blinkRef.current) clearTimeout(blinkRef.current) }
  }, [animate])

  const grid = frames[frameIdx] ?? frames[0]

  return (
    <div
      className="pixel-art inline-block select-none"
      style={{ lineHeight: 0 }}
      aria-label={`Pixel Eren - ${mood}`}
    >
      {grid.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {row.split('').map((char, x) => {
            const isEye = char === 'E' || char === 'P' || char === 'G'
            const c = blinking && isEye ? 'M' : char
            return (
              <div
                key={x}
                style={{
                  width: size,
                  height: size,
                  backgroundColor: PAL[c] ?? 'transparent',
                  imageRendering: 'pixelated',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
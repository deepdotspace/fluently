/**
 * EchoWall: one hero statement over a wallpaper of the SAME word tiled in
 * offset brick rows with seeded opacity jitter and sub-perceptual alternating
 * row drift. The wall is texture; the hero reads.
 */

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { seededRandom } from './random'

interface EchoWallProps {
  word: string
  rows?: number
  perRow?: number
  className?: string
  children?: React.ReactNode
}

export function EchoWall({ word, rows = 7, perRow = 6, className = '', children }: EchoWallProps) {
  const reduced = useReducedMotion()
  const jitter = useMemo(() => {
    const rand = seededRandom(`echo-${word}`)
    return Array.from({ length: rows }, () =>
      Array.from({ length: perRow }, () => 0.5 + rand() * 0.5),
    )
  }, [word, rows, perRow])

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="flex h-full flex-col justify-between py-2">
        {jitter.map((row, r) => (
          <motion.div
            key={r}
            className="flex gap-[0.6em] whitespace-nowrap font-display font-bold uppercase"
            style={{
              fontSize: 'clamp(40px, 7vw, 96px)',
              lineHeight: 1,
              marginLeft: r % 2 ? '-1.2em' : '0',
              opacity: 0.12,
            }}
            animate={reduced ? undefined : { x: r % 2 ? [0, -14, 0] : [0, 14, 0] }}
            transition={{ duration: 11 + r * 1.7, repeat: Infinity, ease: 'easeInOut' }}
          >
            {row.map((o, c) => (
              <span key={c} style={{ opacity: o }}>
                {word}
              </span>
            ))}
          </motion.div>
        ))}
      </div>
      {children}
    </div>
  )
}

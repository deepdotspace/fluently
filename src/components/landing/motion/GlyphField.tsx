/**
 * GlyphField: the one decorative motif per world. A sparse grid of a single
 * glyph as ghost ink that carries the world's metaphor. Static texture; the
 * motion lives in the content, not the wallpaper.
 */

import { useMemo } from 'react'
import { seededRandom } from './random'

interface GlyphFieldProps {
  glyph: string
  count?: number
  className?: string
}

export function GlyphField({ glyph, count = 14, className = '' }: GlyphFieldProps) {
  const spots = useMemo(() => {
    const rand = seededRandom(`glyph-${glyph}`)
    return Array.from({ length: count }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      s: 18 + rand() * 54,
      r: (rand() - 0.5) * 40,
      o: 0.05 + rand() * 0.07,
    }))
  }, [glyph, count])

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {spots.map((p, i) => (
        <span
          key={i}
          className="absolute font-display font-bold select-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: p.s,
            opacity: p.o,
            transform: `rotate(${p.r}deg)`,
          }}
        >
          {glyph}
        </span>
      ))}
    </div>
  )
}

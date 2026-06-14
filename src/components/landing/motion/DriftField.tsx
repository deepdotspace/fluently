/**
 * DriftField: an animated evolution of GlyphField. A sparse, low-opacity field
 * of mixed world-scripts (the languages Fluently teaches) that slowly drift in
 * place — saying "many languages, alive" while filling empty hero/endcard space
 * without ever competing with the foreground. Glyphs inherit the world's ink via
 * currentColor. Placement is seeded (never Math.random) so it's reproducible;
 * each glyph carries its own staggered drift so the field reads organic.
 *
 * GPU-only: the drift is a CSS keyframe on transform + opacity (defined in
 * styles.css as `drift-glyph`). prefers-reduced-motion renders the field static.
 */

import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import { seededRandom } from './random'

/** Scripts a language app teaches — Japanese, Chinese, Korean, Cyrillic, and a
 * few accented Latin / Arabic / German letters. Glyphs only: no words, no copy. */
const SCRIPTS = ['あ', '中', '한', 'я', 'ñ', 'ü', 'ß', 'ا', 'の', '愛', 'ж', 'é', 'ç', 'ك']

interface DriftFieldProps {
  count?: number
  /** Base opacity ceiling; per-glyph opacity lands in [base*0.6, base]. */
  opacity?: number
  seed?: string
  /**
   * Bias placement toward a region of the field. Defaults to the full box.
   * e.g. Hero weights toward the empty right/top with {minX: 45, maxY: 70}.
   */
  region?: { minX?: number; maxX?: number; minY?: number; maxY?: number }
  className?: string
}

export function DriftField({
  count = 13,
  opacity = 0.08,
  seed = 'drift',
  region,
  className = '',
}: DriftFieldProps) {
  const reduced = useReducedMotion()

  const spots = useMemo(() => {
    const rand = seededRandom(`drift-${seed}`)
    const minX = region?.minX ?? 0
    const maxX = region?.maxX ?? 100
    const minY = region?.minY ?? 0
    const maxY = region?.maxY ?? 100
    return Array.from({ length: count }, (_, i) => {
      const glyph = SCRIPTS[Math.floor(rand() * SCRIPTS.length)]
      return {
        glyph,
        x: minX + rand() * (maxX - minX),
        y: minY + rand() * (maxY - minY),
        size: 26 + rand() * 46, // 26–72px
        o: opacity * (0.6 + rand() * 0.4), // [base*0.6, base]
        // Drift vector: ~20–36px translate, small rotate.
        dx: (rand() - 0.5) * 56, // -28..28px
        dy: -(20 + rand() * 16), // -20..-36px (gentle upward float)
        r0: (rand() - 0.5) * 10, // start rotate -5..5deg
        r1: (rand() - 0.5) * 14, // mid rotate -7..7deg
        dur: 22 + rand() * 14, // 22–36s
        delay: -(rand() * 14), // negative delay desyncs the loops
        key: i,
      }
    })
  }, [count, opacity, seed, region])

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {spots.map((p) => (
        <span
          key={p.key}
          className={`absolute font-display font-bold select-none${reduced ? '' : ' drift-glyph'}`}
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: p.size,
              opacity: p.o,
              color: 'currentColor',
              // Custom props consumed by the `drift-glyph` keyframe.
              '--drift-x': `${p.dx}px`,
              '--drift-y': `${p.dy}px`,
              '--drift-r0': `${p.r0}deg`,
              '--drift-r1': `${p.r1}deg`,
              '--drift-dur': `${p.dur}s`,
              '--drift-delay': `${p.delay}s`,
              // Static fallback transform so reduced-motion still gets the rotate.
              transform: reduced ? `rotate(${p.r0}deg)` : undefined,
            } as React.CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}
    </div>
  )
}

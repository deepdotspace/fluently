/**
 * DailyLoop: the signature motion for the "THE DAILY LOOP" world. A single faint
 * thin ring centered behind the word-stream with one small node that travels
 * slowly around it — the most on-message graphic for a world about a daily
 * habit loop. Violet ink, thin stroke, low opacity: faint and elegant, never a
 * gimmick. Sits behind the WordStream.
 *
 * GPU-only: the orbit is a CSS keyframe rotate on a wrapper (`daily-loop-orbit`
 * in styles.css); the ring itself is static. prefers-reduced-motion holds the
 * node still.
 */

import { useReducedMotion } from 'motion/react'

interface DailyLoopProps {
  /** Ring diameter in px. */
  size?: number
  /** Seconds per full orbit. */
  durationSec?: number
  /** Ring + node color. */
  ink?: string
  className?: string
}

export function DailyLoop({
  size = 460,
  durationSec = 20,
  ink = '#7c3aed',
  className = '',
}: DailyLoopProps) {
  const reduced = useReducedMotion()

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* The faint static ring. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `1px solid ${ink}`,
          opacity: 0.14,
        }}
      />
      {/* Orbit wrapper: rotates a full turn; the node rides the ring's top. */}
      <div
        className={`absolute inset-0${reduced ? '' : ' daily-loop-orbit'}`}
        style={{ ['--orbit-dur' as string]: `${durationSec}s` }}
      >
        <span
          className="absolute top-0 left-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 9,
            height: 9,
            background: ink,
            opacity: 0.5,
            boxShadow: `0 0 10px ${ink}`,
          }}
        />
      </div>
    </div>
  )
}

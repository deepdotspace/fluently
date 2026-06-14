/**
 * WorldDeck: the hard-cut machine. A scroll-snap deck where every World owns
 * the full viewport in its own color; crossing a boundary IS the cut (one
 * full-bleed color world per idea, joined by hard cuts). A rationed white flash
 * marks the act break that earns it.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useInView, useReducedMotion, AnimatePresence } from 'motion/react'

export function WorldDeck({ children }: { children: ReactNode }) {
  return (
    <main className="world-deck" data-testid="landing-deck">
      {children}
    </main>
  )
}

interface WorldProps {
  id: string
  bg: string
  ink: string
  children: ReactNode
  /** Fire the rationed 3-frame white flash when this world becomes active. */
  flashOnEnter?: boolean
  className?: string
}

export function World({ id, bg, ink, children, flashOnEnter, className = '' }: WorldProps) {
  const ref = useRef<HTMLElement>(null)
  const active = useInView(ref, { margin: '-40% 0px -40% 0px' })
  const reduced = useReducedMotion()
  const [flashed, setFlashed] = useState(false)

  useEffect(() => {
    if (flashOnEnter && active && !flashed) setFlashed(true)
  }, [active, flashOnEnter, flashed])

  return (
    <section
      ref={ref}
      id={id}
      data-world={id}
      className={`world ${className}`}
      style={{ background: bg, color: ink }}
    >
      {/* halftone texture, ink-tinted */}
      <div aria-hidden className="halftone pointer-events-none absolute inset-0 opacity-[0.04]" />
      {children}
      <AnimatePresence>
        {flashOnEnter && active && !reduced && flashed && <Flash key="flash" />}
      </AnimatePresence>
    </section>
  )
}

/** The measured exposure bell: 2-frame attack to white, 3-frame decay. */
function Flash() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-50 bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.22, times: [0, 0.3, 1], ease: 'linear' }}
    />
  )
}

/** Per-world content trigger: active when the world is mostly on screen. */
export function useWorldActive() {
  const ref = useRef<HTMLDivElement>(null)
  const active = useInView(ref, { once: true, margin: '-30% 0px -30% 0px' })
  return { ref, active }
}

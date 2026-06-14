/**
 * SwapSlot: the width-reserving cycling word (the hero subhead swap slot). Hard
 * sub-second swaps: the incoming word rises in as the outgoing launches out,
 * never a crossfade. Pauses offscreen; reduced motion shows the first word.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react'

interface SwapSlotProps {
  words: string[]
  periodMs?: number
  className?: string
}

export function SwapSlot({ words, periodMs = 720, className = '' }: SwapSlotProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const onScreen = useInView(ref, { margin: '-10% 0px -10% 0px' })
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)

  useEffect(() => {
    if (reduced || !onScreen) return
    const t = window.setInterval(() => setI((v) => (v + 1) % words.length), periodMs)
    return () => window.clearInterval(t)
  }, [onScreen, reduced, periodMs, words.length])

  return (
    <span ref={ref} className={`relative inline-grid overflow-hidden align-bottom ${className}`}>
      {/* width reservation: every word occupies the same grid cell invisibly */}
      {words.map((w) => (
        <span key={w} className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {w}
        </span>
      ))}
      {reduced ? (
        <span className="col-start-1 row-start-1 whitespace-nowrap">{words[0]}</span>
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={words[i]}
            className="col-start-1 row-start-1 whitespace-nowrap"
            initial={{ y: '105%' }}
            animate={{ y: '0%' }}
            exit={{ y: '-105%' }}
            transition={{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1] }}
          >
            {words[i]}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  )
}

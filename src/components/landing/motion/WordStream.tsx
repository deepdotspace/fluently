/**
 * WordStream: the typed-manifesto metronome. One phrase on stage at a time;
 * hold-length IS the emphasis channel (list beats short, payoffs long). A
 * typing-dots item is the breath before a turn. The final payoff holds to the
 * cut, with an optional violet highlight box.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react'

export interface StreamItem {
  text?: string
  /** Highlighted substring (violet box). */
  em?: string
  holdMs: number
  dots?: boolean
}

interface WordStreamProps {
  items: StreamItem[]
  className?: string
  style?: React.CSSProperties
}

export function WordStream({ items, className = '', style }: WordStreamProps) {
  const ref = useRef<HTMLDivElement>(null)
  const started = useInView(ref, { once: true, margin: '-30% 0px -30% 0px' })
  const reduced = useReducedMotion()
  const [i, setI] = useState(-1)

  useEffect(() => {
    if (!started || reduced) return
    let idx = 0
    setI(0)
    let timer: number
    const next = () => {
      if (idx >= items.length - 1) return
      timer = window.setTimeout(() => {
        idx += 1
        setI(idx)
        next()
      }, items[idx].holdMs)
    }
    next()
    return () => window.clearTimeout(timer)
  }, [started, reduced, items])

  const current = reduced ? items[items.length - 1] : i >= 0 ? items[i] : null

  return (
    <div ref={ref} className={`relative flex items-center justify-center ${className}`} style={style}>
      <AnimatePresence mode="popLayout" initial={false}>
        {current && !current.dots && (
          <motion.div
            key={`w-${reduced ? 'final' : i}`}
            className="text-center"
            initial={reduced ? false : { opacity: 0, y: '0.35em' }}
            animate={{ opacity: 1, y: '0em' }}
            exit={{ opacity: 0, transition: { duration: 0.04 } }}
            transition={{ duration: 0.16, ease: [0.2, 0.9, 0.3, 1] }}
          >
            <Line text={current.text ?? ''} em={current.em} />
          </motion.div>
        )}
        {current?.dots && !reduced && (
          <motion.div
            key={`d-${i}`}
            className="flex gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
          >
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                className="h-3 w-3 rounded-full bg-current"
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 0.55, repeat: Infinity, delay: d * 0.12 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Line({ text, em }: { text: string; em?: string }) {
  if (!em || !text.includes(em)) return <>{text}</>
  const [before, after] = text.split(em)
  return (
    <>
      {before}
      <span className="px-[0.15em] text-white" style={{ background: '#7c3aed' }}>
        {em}
      </span>
      {after}
    </>
  )
}

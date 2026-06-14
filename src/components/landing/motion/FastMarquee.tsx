/**
 * FastMarquee: the running ticker. Duplicated track, linear loop, optional
 * reverse. Pauses offscreen; static under reduced motion.
 */

import { useRef, type ReactNode } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'

interface FastMarqueeProps {
  children: ReactNode
  className?: string
  duration?: number
  reverse?: boolean
}

export function FastMarquee({
  children,
  className = '',
  duration = 14,
  reverse = false,
}: FastMarqueeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '5% 0px 5% 0px' })
  const reduced = useReducedMotion()

  if (reduced) {
    return (
      <div ref={ref} className={`overflow-hidden ${className}`}>
        <div className="flex w-max items-center">{children}</div>
      </div>
    )
  }

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div
        className="flex w-max items-center"
        animate={inView ? { x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] } : undefined}
        transition={{ duration, ease: 'linear', repeat: Infinity }}
      >
        <div className="flex items-center">{children}</div>
        <div className="flex items-center" aria-hidden>
          {children}
        </div>
      </motion.div>
    </div>
  )
}

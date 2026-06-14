/**
 * SlamText: the word entrance. Words POP (oversized scale or hard rise, 1-2
 * frame opacity, stiff spring), no smears, no fades. Content lands, then HOLDS
 * (the speed lives in the entrance, never the hold). Honors reduced motion.
 */

import { motion, useReducedMotion, type Variants } from 'motion/react'
import type { CSSProperties } from 'react'

interface SlamTextProps {
  text: string
  className?: string
  style?: CSSProperties
  /** Seconds before the first word. */
  delay?: number
  stagger?: number
  play: boolean
  from?: 'up' | 'scale'
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div'
}

export function SlamText({
  text,
  className = '',
  style,
  delay = 0,
  stagger = 0.05,
  play,
  from = 'up',
  as: Tag = 'div',
}: SlamTextProps) {
  const reduced = useReducedMotion()
  const words = text.split(' ')

  if (reduced) {
    return (
      <Tag className={className} style={style}>
        {text}
      </Tag>
    )
  }

  const child: Variants =
    from === 'up'
      ? {
          hidden: { opacity: 0, y: '0.6em' },
          show: {
            opacity: 1,
            y: '0em',
            transition: { type: 'spring', stiffness: 460, damping: 30, mass: 0.7 },
          },
        }
      : {
          hidden: { opacity: 0, scale: 1.35 },
          show: {
            opacity: 1,
            scale: 1,
            transition: { type: 'spring', stiffness: 420, damping: 26, mass: 0.7 },
          },
        }

  return (
    <Tag className={className} style={style} aria-label={text}>
      <motion.span
        aria-hidden
        style={{ display: 'inline-block' }}
        initial="hidden"
        animate={play ? 'show' : 'hidden'}
        transition={{ staggerChildren: stagger, delayChildren: delay }}
        variants={{ hidden: {}, show: {} }}
      >
        {words.map((w, i) => (
          // a real space text node between the inline-block word masks keeps
          // both layout spacing AND innerText/copy-paste correct
          <span key={i}>
            {i > 0 && ' '}
            <span className="inline-block overflow-hidden align-bottom">
              <motion.span className="inline-block" variants={child}>
                {w}
              </motion.span>
            </span>
          </span>
        ))}
      </motion.span>
    </Tag>
  )
}

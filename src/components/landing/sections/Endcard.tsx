/**
 * World 11: the endcard (soft-blue, settles). Arrives loud with one rationed
 * flash, then holds still: never end on the energy peak. A violet "Get started"
 * pill opens sign-in, a row of mono links, and a slow bottom marquee.
 */

import { motion, useReducedMotion } from 'motion/react'
import { World, useWorldActive } from '../motion/WorldDeck'
import { SlamText } from '../motion/SlamText'
import { FastMarquee } from '../motion/FastMarquee'
import { DriftField } from '../motion/DriftField'
import { endcard, palette } from '../content'

export function Endcard({ onSignIn }: { onSignIn: () => void }) {
  const { ref, active } = useWorldActive()
  const reduced = useReducedMotion()

  return (
    <World id="end" bg={palette.blue.bg} ink={palette.blue.ink} flashOnEnter>
      {/* Calm bookend: the same drift field as the hero, behind the centered column. */}
      <DriftField seed="endcard" count={12} opacity={0.07} />

      <div ref={ref} className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        <h2
          className="font-display font-bold uppercase"
          style={{ fontSize: 'clamp(52px, 10vw, 150px)', lineHeight: 0.95 }}
        >
          <SlamText text={endcard.line1} play={active} from="scale" as="span" className="block" />
          <SlamText
            text={endcard.em}
            play={active}
            delay={0.14}
            from="scale"
            as="span"
            className="block"
            style={{ color: '#7c3aed' }}
          />
          <SlamText text={endcard.line2} play={active} delay={0.28} from="scale" as="span" className="block" />
        </h2>

        <motion.button
          type="button"
          onClick={onSignIn}
          className="mt-10 rounded-full px-9 py-3.5 font-mono text-sm font-bold tracking-[0.14em] text-white"
          style={{ background: '#7c3aed' }}
          initial={reduced ? false : { opacity: 0, scale: 0.8 }}
          animate={active ? { opacity: 1, scale: 1 } : undefined}
          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.5 }}
          whileHover={{ scale: 1.07, backgroundColor: '#6d28d9' }}
          whileTap={{ scale: 0.94 }}
        >
          Get started
        </motion.button>

        <div className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-3">
          {endcard.links.map((l) => {
            const external = l.href.startsWith('http')
            return (
              <a
                key={l.label}
                href={l.href}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="font-mono text-xs tracking-[0.2em] underline-offset-4 transition-colors opacity-60 hover:opacity-100 hover:underline"
                style={{ color: 'inherit' }}
              >
                {l.label}
              </a>
            )
          })}
        </div>
      </div>

      <div className="absolute right-0 bottom-0 left-0 border-t border-current/15 py-2.5">
        <FastMarquee duration={30}>
          <span className="mx-6 font-mono text-[11px] tracking-[0.25em] opacity-40">
            {endcard.marquee}
          </span>
        </FastMarquee>
      </div>
    </World>
  )
}

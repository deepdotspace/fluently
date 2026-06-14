/**
 * World 1: hero (soft-blue world). FLUENTLY slams oversized, a swap slot cycles
 * grounded subheads sub-second, a violet "Get started" pill opens sign-in, and
 * the cue points down to "how it works".
 */

import { motion, useReducedMotion } from 'motion/react'
import { World, useWorldActive } from '../motion/WorldDeck'
import { SlamText } from '../motion/SlamText'
import { SwapSlot } from '../motion/SwapSlot'
import { DriftField } from '../motion/DriftField'
import { hero, palette } from '../content'

export function Hero({ onSignIn }: { onSignIn: () => void }) {
  const { ref, active } = useWorldActive()
  const reduced = useReducedMotion()

  return (
    <World id="open" bg={palette.blue.bg} ink={palette.blue.ink}>
      {/* Ambient language drift, weighted to the empty right/top, behind content. */}
      <DriftField seed="hero" count={13} opacity={0.08} region={{ minX: 42, maxY: 72 }} />

      <div ref={ref} className="relative z-10 flex h-full flex-col justify-center px-5 md:px-12">
        <h1
          className="font-display font-bold tracking-[-0.01em] uppercase"
          style={{ fontSize: 'clamp(56px, 15vw, 220px)', lineHeight: 0.92 }}
        >
          <SlamText text={hero.name} play={active} from="scale" as="span" className="block" />
        </h1>

        <div
          className="mt-6 font-display font-semibold uppercase"
          style={{ fontSize: 'clamp(22px, 4vw, 44px)', lineHeight: 1, color: '#7c3aed' }}
        >
          <SwapSlot words={hero.roles} periodMs={760} />
        </div>

        <p className="mt-5 max-w-[44ch] font-mono text-xs tracking-[0.18em] opacity-70 md:text-sm">
          {hero.tagline}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-5">
          <motion.button
            type="button"
            onClick={onSignIn}
            className="w-max rounded-full px-8 py-3 font-mono text-sm font-bold tracking-[0.12em] text-white"
            style={{ background: '#7c3aed' }}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            animate={active ? { opacity: 1, y: 0 } : undefined}
            transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.36 }}
            whileHover={{ scale: 1.06, backgroundColor: '#6d28d9' }}
            whileTap={{ scale: 0.95 }}
          >
            Get started
          </motion.button>

          <a
            href="#sm2"
            className="font-mono text-xs tracking-[0.2em] underline-offset-4 transition-opacity hover:underline opacity-70 hover:opacity-100"
          >
            See how it works ↓
          </a>
        </div>
      </div>

      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs tracking-[0.3em]"
        style={{ color: '#7c3aed' }}
        animate={reduced ? undefined : { y: [0, 7, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        SCROLL ↓
      </motion.div>
    </World>
  )
}

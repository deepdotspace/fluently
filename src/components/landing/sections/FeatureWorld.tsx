/**
 * Worlds 3-8: one full-bleed color world per feature. Tiny mono index, giant
 * name bleeding off the edge, one claim, a violet "Try it" pill that opens
 * sign-in, a tilted flashcard mockup bleeding off the bottom-right corner, one
 * motif glyph field, and a running facts marquee.
 *
 * Fluently ships no marketing screenshots, so the bleeding element is a
 * self-contained flashcard mockup rendered from the world's own ink color. It
 * keeps loud's off-corner bleed, tilt, hard offset shadow, and rise motion.
 */

import { motion, useReducedMotion } from 'motion/react'
import { World, useWorldActive } from '../motion/WorldDeck'
import { SlamText } from '../motion/SlamText'
import { GlyphField } from '../motion/GlyphField'
import { FastMarquee } from '../motion/FastMarquee'
import type { FeatureWorld as Feature } from '../content'

export function FeatureWorld({
  feature,
  index,
  total,
  onSignIn,
}: {
  feature: Feature
  index: number
  total: number
  onSignIn: () => void
}) {
  const { ref, active } = useWorldActive()
  const reduced = useReducedMotion()

  return (
    <World id={feature.id} bg={feature.bg} ink={feature.ink}>
      <GlyphField glyph={feature.glyph} />

      <div ref={ref} className="relative z-10 flex h-full flex-col px-5 pt-16 md:px-12 md:pt-20">
        <div className="font-mono text-xs tracking-[0.25em] opacity-70">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>

        <h2
          className="mt-2 font-display font-bold whitespace-nowrap uppercase"
          style={{ fontSize: 'clamp(56px, 12vw, 190px)', lineHeight: 0.95 }}
        >
          <SlamText text={feature.name} play={active} from="scale" as="span" />
        </h2>

        <SlamText
          text={feature.claim}
          play={active}
          delay={0.18}
          as="p"
          className="mt-3 max-w-[18ch] font-display font-semibold"
          style={{ fontSize: 'clamp(20px, 3.2vw, 40px)', lineHeight: 1.05 }}
        />

        <motion.button
          type="button"
          onClick={onSignIn}
          className="mt-6 w-max rounded-full px-6 py-2.5 font-mono text-sm font-bold tracking-[0.12em] text-white"
          style={{ background: '#7c3aed' }}
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={active ? { opacity: 1, y: 0 } : undefined}
          transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.32 }}
          whileHover={{ scale: 1.06, backgroundColor: '#6d28d9' }}
          whileTap={{ scale: 0.95 }}
        >
          Try it ↗
        </motion.button>
      </div>

      {/* flashcard mockup bleeding off the bottom-right, hard rise with overshoot */}
      <motion.div
        className="absolute -right-[4%] bottom-[10%] z-0 w-[68vw] max-w-[520px] min-w-[280px] md:bottom-[14%]"
        style={{ rotate: index % 2 ? 3 : -3 }}
        initial={reduced ? false : { opacity: 0, y: 140 }}
        animate={active ? { opacity: 1, y: 0 } : undefined}
        transition={{ type: 'spring', stiffness: 240, damping: 22, mass: 0.9, delay: 0.2 }}
      >
        <CardMockup feature={feature} index={index} />
      </motion.div>

      <div
        className="absolute right-0 bottom-0 left-0 z-10 border-t py-2.5"
        style={{ borderColor: `${feature.ink}33` }}
      >
        <FastMarquee duration={15} reverse={index % 2 === 1}>
          {feature.facts.map((f) => (
            <span key={f} className="mx-5 font-mono text-xs tracking-[0.18em]">
              {f} <span className="mx-3 opacity-50">·</span>
            </span>
          ))}
        </FastMarquee>
      </div>
    </World>
  )
}

/** A frosted flashcard rendered in the world's ink, with loud's hard offset
 * shadow + thick border. Stands in for an app screenshot so the world has a
 * tilted element bleeding off the corner without a missing-asset risk. */
function CardMockup({ feature, index }: { feature: Feature; index: number }) {
  // The card is a frosted white panel; paint its content in `cardInk` (a dark
  // blue/violet on deep worlds) so it reads on white. Light worlds omit cardInk
  // and fall back to the world ink, unchanged.
  const ink = feature.cardInk ?? feature.ink
  return (
    <div
      className="aspect-[4/3] w-full rounded-2xl bg-white/80 p-6 backdrop-blur-md md:p-8"
      style={{ border: `4px solid ${ink}`, boxShadow: `14px 14px 0 0 ${ink}33` }}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.2em]" style={{ color: ink, opacity: 0.6 }}>
            {String(index + 1).padStart(2, '0')} / 06
          </span>
          <span className="font-display text-2xl font-bold" style={{ color: ink }}>
            {feature.glyph}
          </span>
        </div>
        <div>
          <div
            className="font-display font-bold uppercase leading-none"
            style={{ color: ink, fontSize: 'clamp(28px, 5vw, 52px)' }}
          >
            {feature.name}
          </div>
          <div className="mt-3 font-mono text-[11px] tracking-[0.14em]" style={{ color: ink, opacity: 0.7 }}>
            {feature.facts[0]}
          </div>
        </div>
        <div className="flex gap-2">
          {[0.9, 0.55, 0.3].map((o, i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: ink, opacity: o * 0.5 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * World 2: the claim (violet world). Echo wall of "DUE" behind the one fact
 * that matters. Bottom marquee telegraphs the six feature worlds coming.
 */

import { World, useWorldActive } from '../motion/WorldDeck'
import { SlamText } from '../motion/SlamText'
import { EchoWall } from '../motion/EchoWall'
import { FastMarquee } from '../motion/FastMarquee'
import { claim, features, palette } from '../content'

export function Claim() {
  const { ref, active } = useWorldActive()

  return (
    <World id="claim" bg={palette.violet.bg} ink={palette.violet.ink}>
      <EchoWall word={claim.echo} />
      <div
        ref={ref}
        className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center"
      >
        <SlamText
          text={claim.line1}
          play={active}
          from="scale"
          as="h2"
          className="font-display font-bold uppercase"
          style={{ fontSize: 'clamp(56px, 11vw, 160px)', lineHeight: 0.95 }}
        />
        <SlamText
          text={claim.line2}
          play={active}
          delay={0.22}
          from="scale"
          as="h2"
          className="font-display font-bold uppercase"
          style={{ fontSize: 'clamp(56px, 11vw, 160px)', lineHeight: 0.95 }}
        />
        <p className="mt-6 font-mono text-xs tracking-[0.2em] md:text-sm">{claim.sub}</p>
      </div>
      <div className="absolute right-0 bottom-0 left-0 border-t border-current/20 py-3">
        <FastMarquee duration={13}>
          {features.map((f) => (
            <span key={f.id} className="mx-6 font-display text-xl font-bold uppercase">
              {f.name}
              <span className="mx-3 align-middle opacity-40">·</span>
            </span>
          ))}
        </FastMarquee>
      </div>
    </World>
  )
}

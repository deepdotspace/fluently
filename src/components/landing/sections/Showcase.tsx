/**
 * World 10: showcase (soft-blue world, one rationed flash). A 2x2 grid of the
 * daily-use beats rendered as frosted panels (Fluently ships no reel videos or
 * marketing screenshots) behind a slammed header. Density beat before the page
 * settles into the closing CTA.
 */

import { World, useWorldActive } from '../motion/WorldDeck'
import { SlamText } from '../motion/SlamText'
import { palette } from '../content'

const PANELS = [
  { glyph: 'あ', title: 'BROWSE DECKS', sub: '10 LANGUAGES' },
  { glyph: '↻', title: 'REVIEW MODE', sub: 'DUE-CARD QUEUE' },
  { glyph: '✦', title: 'GENERATE CARDS', sub: 'FROM A WORD LIST' },
  { glyph: '+', title: 'BUILD A DECK', sub: 'CUSTOM CARD TYPES' },
]

export function Showcase() {
  const { ref, active } = useWorldActive()

  return (
    <World id="showcase" bg={palette.blue.bg} ink={palette.blue.ink} flashOnEnter>
      <div ref={ref} className="flex h-full flex-col px-5 pt-14 pb-10 md:px-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <SlamText
            text="SEE IT IN USE."
            play={active}
            from="scale"
            as="h2"
            className="font-display font-bold uppercase"
            style={{ fontSize: 'clamp(34px, 6vw, 88px)', lineHeight: 0.95 }}
          />
          <p
            className="hidden font-mono text-xs tracking-[0.2em] md:block"
            style={{ color: '#7c3aed' }}
          >
            FOUR PARTS OF THE DAILY LOOP
          </p>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 md:gap-3">
          {PANELS.map((p) => (
            <div
              key={p.title}
              className="flex h-full w-full flex-col justify-between rounded-md bg-white/70 p-4 backdrop-blur-md md:p-6"
              style={{ border: '1px solid rgba(124, 58, 237, 0.2)' }}
            >
              <span
                className="font-display font-bold leading-none"
                style={{ color: '#7c3aed', fontSize: 'clamp(40px, 7vw, 96px)' }}
              >
                {p.glyph}
              </span>
              <div>
                <div
                  className="font-display font-bold uppercase leading-none"
                  style={{ fontSize: 'clamp(18px, 2.6vw, 34px)' }}
                >
                  {p.title}
                </div>
                <div className="mt-2 font-mono text-[11px] tracking-[0.16em] opacity-60">
                  {p.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </World>
  )
}

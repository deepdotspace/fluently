/**
 * World 9: how it works (white/violet polarity flip). Metronomic word-stream:
 * hold-length is the emphasis channel, a typing-dots breath before the payoff,
 * and the payoff holds with a violet highlight box. The calm mid-page breath.
 */

import { World } from '../motion/WorldDeck'
import { WordStream } from '../motion/WordStream'
import { DailyLoop } from '../motion/DailyLoop'
import { howItWorks, palette } from '../content'

export function HowItWorks() {
  return (
    <World id="how" bg={palette.flip.bg} ink={palette.flip.ink}>
      {/* The signature orbit: visualizes "THE DAILY LOOP", behind the word-stream. */}
      <DailyLoop size={460} durationSec={20} ink="#7c3aed" />

      <div className="absolute top-8 left-1/2 -translate-x-1/2 font-mono text-xs tracking-[0.3em] opacity-60">
        THE DAILY LOOP
      </div>
      <WordStream
        items={howItWorks}
        className="relative z-10 h-full px-5 text-center font-display font-bold uppercase"
        style={{ fontSize: 'clamp(34px, 6vw, 84px)', lineHeight: 1.04 }}
      />
    </World>
  )
}

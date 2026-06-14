/**
 * Landing content: Fluently's real features only. Copy rules from the owner's
 * standing preferences: no em dashes, grounded and human, no superlatives or
 * marketing fluff, say the number when there is one.
 */

import type { StreamItem } from './motion/WordStream'

/** Color worlds: light blue -> violet, one violet accent. Each world is one
 * coherent family (flat or soft 135deg gradient), never multi-color blocks. */
export const palette = {
  /** Soft-blue paper: the neutral "black" world from loud, recolored light. */
  blue: { bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', ink: '#1e3a8a' },
  /** Violet world: the single accent world (loud's volt claim). */
  violet: { bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)', ink: '#4c1d95' },
  /** White/violet polarity-flip world for the how-it-works breath. */
  flip: { bg: 'linear-gradient(135deg, #faf5ff 0%, #f0e6ff 100%)', ink: '#4c1d95' },
}

export interface FeatureWorld {
  id: string
  name: string
  /** One-line claim, sentence case (the allowed softening for body claims). */
  claim: string
  facts: string[]
  bg: string
  ink: string
  /** Ink for the frosted white card mockup. Defaults to `ink`; deep worlds set
   * a dark blue/violet here so the card content reads on white while the world's
   * own text uses a light `ink`. */
  cardInk?: string
  glyph: string
}

/** Worlds 3-8: Fluently's six real features, verified in the codebase. */
export const features: FeatureWorld[] = [
  {
    id: 'decks',
    name: 'DECKS',
    claim: 'Ready-made language decks.',
    facts: ['10 LANGUAGES', 'CURATED VOCAB', 'ONE TAP TO ADD'],
    bg: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)',
    ink: '#1e40af',
    glyph: 'あ',
  },
  {
    id: 'custom',
    name: 'BUILD',
    claim: 'Build a deck your way.',
    facts: ['CUSTOM CARD TYPES', 'RICH TEXT', 'IMAGES AND AUDIO'],
    bg: 'linear-gradient(135deg, #f0e6ff 0%, #ddd6fe 100%)',
    ink: '#4c1d95',
    glyph: '+',
  },
  {
    id: 'sm2',
    name: 'REVIEW',
    claim: 'Review right before you forget.',
    facts: ['SM-2 SCHEDULING', 'DUE-CARD QUEUE', 'DAILY LIMITS'],
    bg: 'linear-gradient(135deg, #eef2ff 0%, #c7d2fe 100%)',
    ink: '#3730a3',
    glyph: '↻',
  },
  {
    id: 'ai',
    name: 'GENERATE',
    claim: 'Generate cards from a word list.',
    facts: ['BULK GENERATE', 'DEFINITIONS AND EXAMPLES', 'EDIT BEFORE SAVING'],
    bg: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
    ink: '#e0e7ff',
    cardInk: '#312e81',
    glyph: '✦',
  },
  {
    id: 'anki',
    name: 'IMPORT',
    claim: 'Bring your Anki decks over.',
    facts: ['.APKG IMPORT', 'KEEPS MEDIA', 'MAPS FIELDS'],
    bg: 'linear-gradient(135deg, #93c5fd 0%, #6366f1 100%)',
    ink: '#1e1b4b',
    cardInk: '#3730a3',
    glyph: '↓',
  },
  {
    id: 'pronounce',
    name: 'LISTEN',
    claim: 'Hear how the word sounds.',
    facts: ['WIKTIONARY AUDIO', 'PER-WORD PLAYBACK', 'LISTEN AND REPEAT'],
    bg: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)',
    ink: '#ede9fe',
    cardInk: '#4c1d95',
    glyph: '♪',
  },
]

export const hero = {
  name: 'FLUENTLY',
  /** Grounded subheads cycled in the swap slot. */
  roles: [
    'LEARN VOCABULARY.',
    'REVIEW WHAT IS DUE.',
    'BUILD YOUR OWN DECKS.',
    'IMPORT FROM ANKI.',
  ],
  tagline: 'Spaced-repetition flashcards for language learning.',
}

export const claim = {
  echo: 'DUE',
  line1: 'STUDY',
  line2: "WHAT'S DUE.",
  sub: 'An SM-2 schedule decides what you see each day.',
}

/** The how-it-works metronome. Hold-length is the emphasis. */
export const howItWorks: StreamItem[] = [
  { text: 'PICK A DECK.', holdMs: 1000 },
  { text: 'OR BUILD ONE.', holdMs: 1000 },
  { text: "REVIEW WHAT'S DUE.", holdMs: 1200 },
  { dots: true, holdMs: 900 },
  { text: 'THE SCHEDULE DOES THE REST.', em: 'DOES THE REST', holdMs: 60000 },
]

export const endcard = {
  line1: 'START',
  em: 'LEARNING.',
  line2: 'TODAY.',
  links: [
    { label: 'ANKI IMPORT', href: '#import' },
    { label: 'BROWSE DECKS', href: '#decks' },
    { label: 'GITHUB', href: 'https://github.com/deepdotspace/fluently' },
    { label: 'MADE ON DEEPSPACE', href: 'https://deep.space' },
  ],
  marquee: 'FLUENTLY · SPACED REPETITION · RUNS ON DEEPSPACE · © 2026 ·',
}

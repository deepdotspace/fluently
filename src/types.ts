/**
 * Shared domain types for Fluently.
 *
 * These describe the app's core data model (cards, decks, card types, fields,
 * spaced-repetition scheduling, media, themes, and settings) and are the
 * single source of truth that the util modules and components import from.
 * The persisted shapes mirror the collection schemas in `src/schemas/`.
 */

// ---------------------------------------------------------------------------
// Spaced repetition (SM-2)
// ---------------------------------------------------------------------------

/** A review card's lifecycle state. */
export type CardSchedulingState = 'new' | 'learning' | 'review' | 'suspended'

/** User answer rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. */
export type ReviewRating = 1 | 2 | 3 | 4

/** Per-card scheduling state produced by `calculateNextReview`. */
export interface SchedulingState {
  state: CardSchedulingState
  /** Interval in days. */
  interval: number
  /** Ease factor (1.3–maximumEase). */
  ease: number
  /** ISO timestamp the card is next due. */
  dueDate: string
  /** Number of times the card has lapsed (failed in review). */
  lapses: number
  /** Index into the active learning/relearning steps. */
  stepsIndex: number
  /** True once `lapses` crosses the leech threshold. */
  isLeech: boolean
}

/** Global SM-2 tuning, persisted under `flashcard-settings`. */
export interface GlobalSettings {
  newCardsPerDay: number
  maxReviewsPerDay: number
  /** Learning steps as interval strings, e.g. `['1m', '10m']`. */
  learningSteps: string[]
  graduatingInterval: number
  easyInterval: number
  startingEase: number
  easyBonus: number
  hardInterval: number
  intervalModifier: number
  maximumInterval: number
  leechThreshold: number
  relearningSteps: string[]
  minimumInterval: number
  easePenalty: number
  maximumEase: number
}

export interface Settings {
  global: GlobalSettings
}

// ---------------------------------------------------------------------------
// Card types & fields
// ---------------------------------------------------------------------------

export type FieldType = 'text' | 'image' | 'audio' | 'html'
export type FieldSide = 'front' | 'back' | 'both'

export interface Field {
  id: string
  name: string
  required: boolean
  type: FieldType
  side: FieldSide
  order: number
}

/** Per-field metadata keyed by field name (e.g. `{ Front: { required: true } }`). */
export type FieldMetadata = Record<string, { required: boolean }>

export interface CardType {
  id: string
  name: string
  fields: Array<Partial<Field> & { name: string }>
  fieldMetadata: FieldMetadata
  reversible: boolean
  isCloze: boolean
  /** True for the pronunciation card type (drives audio-record review UI). */
  isPronunciation?: boolean
  frontTemplate: string
  backTemplate: string
  css: string
}

/** Map of cardTypeId → CardType, as persisted under `card-types`. */
export type CardTypeMap = Record<string, CardType>

// ---------------------------------------------------------------------------
// Cards & decks (mirror src/schemas)
// ---------------------------------------------------------------------------

/** Field name → value (plain text, HTML, or a `media:` reference string). */
export type CardContent = Record<string, string>

export interface Card {
  id: string
  deckId: string
  cardTypeId?: string
  content: CardContent
  scheduling: SchedulingState
  tags?: string[]
  metadata?: Record<string, unknown>
  revLog?: ReviewLogEntry[]
  version?: string
  createdAt?: string
  updatedAt?: string
}

/** A card held in the working map: card data plus its RecordRoom id. */
export type StoredCard = Card & { recordId?: string }

/** A deck held in the working map: deck data plus its RecordRoom id. */
export type StoredDeck = Deck & { recordId?: string }

/** Map of cardId → stored card, as built by `buildCardMap`. */
export type CardMap = Record<string, StoredCard>

/** Map of deckId → stored deck, as built on the home page from `useQuery('decks')`. */
export type DeckMap = Record<string, StoredDeck>

export interface ReviewLogEntry {
  rating: ReviewRating
  timestamp: string
  interval: number
  ease: number
}

export interface Deck {
  id: string
  name: string
  targetLang?: string
  nativeLang?: string
  designId?: string
  settingsOverride?: Partial<Settings> | null
  cardCounts?: DeckCardCounts
  lastStudiedAt?: string
  tags?: string[]
  createdAt?: string
}

export interface DeckCardCounts {
  new: number
  learning: number
  review: number
  due: number
  total: number
}

// ---------------------------------------------------------------------------
// Daily progress & review sessions
// ---------------------------------------------------------------------------

/** Which cards a deck has already shown today (caps new/review per day). */
export interface DeckDailyProgress {
  seenNewCardIds: string[]
  seenReviewCardIds: string[]
}

/** Daily progress document tracking which cards were seen today, per deck. */
export interface DailyProgress {
  /** Today's date as `YYYY-MM-DD` (from `getTodayDateString`). */
  date: string
  decks: Record<string, DeckDailyProgress>
}

/** Live counters emitted by `ReviewMode` via `onSessionStatsChange`. */
export interface ReviewSessionStats {
  /** Cards due when the session started. */
  total: number
  /** Cards still to review in the active session. */
  remaining: number
}

// ---------------------------------------------------------------------------
// Media (mirror media-schema)
// ---------------------------------------------------------------------------

export type MediaType = 'image' | 'audio'

export interface MediaRecord {
  mediaId: string
  mediaType: MediaType
  hash: string
  data?: string
  mimeType?: string
  ext?: string
  size?: number
  refCount?: number
}

// ---------------------------------------------------------------------------
// Themes (soft preset themes from utils/themes)
// ---------------------------------------------------------------------------

export interface SoftTheme {
  id: string
  name: string
  gradient: string
  primary: string
  cardBg: string
  cardBorder: string
  backdropBlur: string
  textPrimary: string
  textSecondary: string
  highlight: string
}

/** Map of themeId → theme, covering the built-in presets plus user customs. */
export type ThemeMap = Record<string, SoftTheme>

// ---------------------------------------------------------------------------
// DeepSpace record envelope (frontend hooks return this shape)
// ---------------------------------------------------------------------------

/** Envelope wrapping every record returned by `useQuery`/mutations. */
export interface RecordEnvelope<T> {
  recordId: string
  data: T
  createdBy: string
  createdAt: string
  updatedAt: string
}

/**
 * Minimal mutations surface returned by `useMutations(collection)`.
 * The full SDK handle also exposes `*Confirmed` variants; this thin alias
 * covers the fire-and-forget methods our storage utils and components use.
 */
export interface RecordMutations<T> {
  create: (data: T) => Promise<string> | void
  put: (recordId: string, data: Partial<T>) => Promise<void> | void
  remove: (recordId: string) => Promise<void> | void
}

// ---------------------------------------------------------------------------
// Per-collection useQuery payloads (the singleton `record.data` shapes the
// home page reads). Each is the `T` in `RecordEnvelope<T>` for its collection.
// ---------------------------------------------------------------------------

/** `user-preferences` record data: drives the active theme. */
export interface UserPreferencesData {
  currentTheme: string
}

/** `flashcard-settings` record data: wraps the SM-2 `Settings` config. */
export interface FlashcardSettingsData {
  config: Settings
}

/** `card-types` record data: the full `cardTypeId → CardType` map. */
export interface CardTypesData {
  types: CardTypeMap
}

/** `custom-themes` record data: user-defined themes keyed by id. */
export interface CustomThemesData {
  themes: ThemeMap
}

/** `daily-progress` record data: today's date plus the progress document. */
export interface DailyProgressData {
  date: string
  progress: DailyProgress
}

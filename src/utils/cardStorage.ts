/**
 * Card Storage Utilities
 *
 * Collection-based storage using useQuery / useMutations.
 *
 * READ functions accept a `cards` object map:  { [cardId]: cardData }
 *   – built from useQuery('cards') records in App.tsx.
 *   – each card object keeps its original fields PLUS `recordId`
 *     (the RecordRoom identifier needed for put/remove).
 *
 * WRITE functions accept `mutations` from useMutations('cards'):
 *   – mutations.create(data)   → new record
 *   – mutations.put(rid, data) → update record
 *   – mutations.remove(rid)    → delete record
 */

import {
  isMediaReference,
  extractMediaId,
  decrementRefCount
} from './mediaStorage'
import type { Card, MediaRecord, RecordEnvelope, Settings } from '../types'

// ---------------------------------------------------------------------------
// Local structural types
// ---------------------------------------------------------------------------

/** A card as held in the working map: card data plus its RecordRoom id. */
type StoredCard = Card & { recordId?: string }

/** Map of cardId → stored card, as built by `buildCardMap`. */
type CardMap = Record<string, StoredCard>

/** Card records as returned by `useQuery('cards')`. */
type CardEnvelope = RecordEnvelope<Card>

/** Minimal mutations surface from `useMutations('cards')`. */
interface CardMutations {
  create: (data: Record<string, unknown>) => void
  put: (recordId: string, data: Record<string, unknown>) => void
  remove: (recordId: string) => void
}

/** Minimal mutations surface from `useMutations('media')`. */
interface MediaMutations {
  create: (data: MediaRecord) => void
  put: (recordId: string, data: MediaRecord) => void
  remove: (recordId: string) => void
}

/** Media records as returned by `useQuery('media')`. */
type MediaEnvelope = RecordEnvelope<MediaRecord>

/** Per-deck daily review progress. */
interface DeckDailyProgress {
  seenNewCardIds: string[]
  seenReviewCardIds: string[]
}

/** Daily progress document tracking which cards were seen today. */
interface DailyProgress {
  date: string
  decks: Record<string, DeckDailyProgress>
}

/** Shape of `card.content.fieldMedia` entries used during media cleanup. */
interface FieldMediaEntry {
  images?: unknown[]
  audio?: unknown[]
}

// ============================================================================
// Helpers: build the card map that components consume
// ============================================================================

/**
 * Convert an array of card records (from useQuery) into the working map format.
 * Each entry keeps all data fields plus `recordId` for mutation reference.
 *
 * @param cardRecords - records from useQuery('cards')
 * @returns { [cardId]: { ...cardData, recordId } }
 */
export function buildCardMap(cardRecords: CardEnvelope[]): CardMap {
  const map: CardMap = {}
  cardRecords.forEach(r => {
    const id = r.data.id
    if (id) {
      map[id] = { ...r.data, recordId: r.recordId }
    }
  })
  return map
}

// ============================================================================
// READ operations: work on the pre-built cards map
// ============================================================================

/**
 * Get all cards, optionally filtered by deck.
 * @param cards - card map { [cardId]: cardData }
 * @param deckId - optional deck filter
 * @returns filtered card map
 */
export function getAllCards(cards: CardMap, deckId: string | null = null): CardMap {
  if (!deckId) return cards
  const filtered: CardMap = {}
  Object.entries(cards).forEach(([id, card]) => {
    if (card.deckId === deckId) filtered[id] = card
  })
  return filtered
}

/** Card statistics for a deck. */
interface CardStats {
  total: number
  new: number
  learning: number
  review: number
  due: number
}

/**
 * Get card statistics for a deck.
 * @param cards - card map
 * @param deckId - optional deck filter
 * @param settings - optional settings for daily limits
 * @returns stats { total, new, learning, review, due }
 */
export function getCardStats(cards: CardMap, deckId: string | null = null, settings: Settings | null = null): CardStats {
  let cardArray = Object.values(cards)
  if (deckId) {
    cardArray = cardArray.filter(c => c.deckId === deckId)
  }
  const now = new Date()

  const allNew = cardArray.filter(c => c.scheduling?.state === 'new')
  const allLearning = cardArray.filter(c => c.scheduling?.state === 'learning')
  const allReview = cardArray.filter(c => c.scheduling?.state === 'review')

  const dueNew = allNew.filter(c => new Date(c.scheduling?.dueDate) <= now)
  const dueLearning = allLearning.filter(c => new Date(c.scheduling?.dueDate) <= now)
  const dueReview = allReview.filter(c => new Date(c.scheduling?.dueDate) <= now)

  let displayDueCount = 0
  if (settings?.global) {
    const newCardLimit = settings.global.newCardsPerDay
    const limitedNewCards = (typeof newCardLimit === 'number' && newCardLimit > 0)
      ? Math.min(dueNew.length, newCardLimit)
      : dueNew.length

    const reviewLimit = settings.global.maxReviewsPerDay
    const limitedReviewCards = (typeof reviewLimit === 'number' && reviewLimit > 0)
      ? Math.min(dueLearning.length + dueReview.length, reviewLimit)
      : (dueLearning.length + dueReview.length)

    displayDueCount = limitedReviewCards + limitedNewCards
  } else {
    displayDueCount = dueNew.length + dueLearning.length + dueReview.length
  }

  return {
    total: cardArray.length,
    new: allNew.length,
    learning: allLearning.length,
    review: allReview.length,
    due: displayDueCount
  }
}

/**
 * Get due cards for review with limit enforcement.
 * @param cards - card map
 * @param deckId
 * @param settings
 * @param dailyProgress
 * @returns sorted due cards
 */
export function getDueCards(
  cards: CardMap,
  deckId: string | null = null,
  settings: Settings | null = null,
  dailyProgress: DeckDailyProgress | null = null
): StoredCard[] {
  let cardValues = Object.values(cards)
  if (deckId) {
    cardValues = cardValues.filter(c => c.deckId === deckId)
  }
  const now = new Date()

  const allDueCards = cardValues.filter(card => {
    if (!card.scheduling || !card.scheduling.dueDate) return false
    return new Date(card.scheduling.dueDate) <= now
  })

  let newCards = allDueCards.filter(card => card.scheduling.state === 'new')
  const learningCards = allDueCards.filter(card => card.scheduling.state === 'learning')
  const reviewCards = allDueCards.filter(card => card.scheduling.state === 'review')

  // Exclude new cards already seen today
  if (dailyProgress?.seenNewCardIds && dailyProgress.seenNewCardIds.length > 0) {
    const seenSet = new Set(dailyProgress.seenNewCardIds)
    newCards = newCards.filter(card => !seenSet.has(card.id))
  }

  const sortByDueDate = (a: StoredCard, b: StoredCard) =>
    new Date(a.scheduling.dueDate).getTime() - new Date(b.scheduling.dueDate).getTime()

  newCards.sort(sortByDueDate)
  learningCards.sort(sortByDueDate)
  reviewCards.sort(sortByDueDate)

  let limitedNewCards = newCards
  let limitedLearningReviewCards = [...learningCards, ...reviewCards]

  if (settings?.global) {
    const newCardLimit = settings.global.newCardsPerDay
    if (typeof newCardLimit === 'number' && newCardLimit > 0) {
      limitedNewCards = limitedNewCards.slice(0, newCardLimit)
    }
    const reviewLimit = settings.global.maxReviewsPerDay
    if (typeof reviewLimit === 'number' && reviewLimit > 0) {
      limitedLearningReviewCards = limitedLearningReviewCards.slice(0, reviewLimit)
    }
  }

  const sortedLearningReview = limitedLearningReviewCards.sort((a, b) => {
    const statePriority: Record<string, number> = { learning: 0, review: 1 }
    const priorityA = statePriority[a.scheduling.state] ?? 2
    const priorityB = statePriority[b.scheduling.state] ?? 2
    if (priorityA !== priorityB) return priorityA - priorityB
    return sortByDueDate(a, b)
  })

  return [...sortedLearningReview, ...limitedNewCards]
}

/**
 * Get words that already have cards (from word library imports).
 * @param cards - card map
 */
export function getExistingCardWords(cards: CardMap): Set<string> {
  const existingWords = new Set<string>()
  Object.values(cards).forEach(card => {
    const metadata = card.metadata as { createdFrom?: unknown; word?: unknown } | undefined
    if (metadata?.createdFrom === 'word-library' && typeof metadata?.word === 'string') {
      existingWords.add(metadata.word.toLowerCase().trim())
    }
  })
  return existingWords
}

// ============================================================================
// WRITE operations: accept mutations from useMutations('cards')
// ============================================================================

/**
 * Prepare a clean card data object for storage (strips recordId).
 * @param card - card with possible recordId
 * @returns clean data for create/put
 */
function prepareCardData(card: StoredCard): Record<string, unknown> {
  const { recordId, ...fields } = card
  const now = new Date().toISOString()
  return {
    ...fields,
    version: card.version || '1.0',
    updatedAt: now,
    createdAt: card.createdAt || now,
  }
}

/**
 * Save (create or update) a single card.
 * If the card has a `recordId`, it's an update; otherwise a create.
 *
 * @param mutations - { create, put, remove } from useMutations('cards')
 * @param card - card data (may include recordId for updates)
 */
export function saveCard(mutations: CardMutations, card: StoredCard | null | undefined): void {
  if (!card || !card.id || !card.deckId) {
    console.error('Cannot save card: missing id or deckId', {
      hasCard: !!card,
      cardId: card?.id,
      deckId: card?.deckId
    })
    return
  }

  const data = prepareCardData(card)

  if (card.recordId) {
    mutations.put(card.recordId, data)
  } else {
    mutations.create(data)
  }
}

/**
 * Save multiple cards at once.
 * @param mutations - from useMutations('cards')
 * @param cards - card map or array
 */
export function saveCards(mutations: CardMutations, cards: CardMap | StoredCard[]): void {
  const cardArray = Array.isArray(cards) ? cards : Object.values(cards)
  cardArray.forEach(card => saveCard(mutations, card))
}

/**
 * Delete a card.
 * @param mutations - from useMutations('cards')
 * @param card - card object (needs recordId)
 * @param mediaMutations - optional, from useMutations('media'), for media cleanup
 * @param mediaRecords - optional, media records for cleanup
 */
export function deleteCard(
  mutations: CardMutations,
  card: StoredCard | null | undefined,
  mediaMutations: MediaMutations | null = null,
  mediaRecords: MediaEnvelope[] | null = null
): void {
  if (!card || !card.recordId) {
    console.error('Cannot delete card: missing recordId')
    return
  }

  // Clean up media references, wrapped in try-catch so card deletion
  // always proceeds even if media cleanup encounters unexpected data.
  try {
    const fieldMedia = (card.content as { fieldMedia?: Record<string, unknown> } | undefined)?.fieldMedia
    if (mediaMutations && mediaRecords && fieldMedia) {
      const fieldMediaValues = Object.values(fieldMedia)
      for (const media of fieldMediaValues) {
        if (!media || typeof media !== 'object') continue
        const entry = media as FieldMediaEntry
        if (Array.isArray(entry.images)) {
          entry.images.forEach(ref => {
            if (isMediaReference(ref)) {
              const mediaId = extractMediaId(ref)
              if (mediaId) decrementRefCount(mediaMutations, mediaRecords, mediaId)
            }
          })
        }
        if (Array.isArray(entry.audio)) {
          entry.audio.forEach(ref => {
            if (isMediaReference(ref)) {
              const mediaId = extractMediaId(ref)
              if (mediaId) decrementRefCount(mediaMutations, mediaRecords, mediaId)
            }
          })
        }
      }
    }
  } catch (err) {
    console.warn('Media cleanup failed during card deletion, proceeding with delete:', err)
  }

  mutations.remove(card.recordId)
}

/**
 * Move a card to a different deck.
 * @param mutations - from useMutations('cards')
 * @param card - card object (needs recordId)
 * @param toDeckId - target deck
 * @returns success
 */
export function moveCard(mutations: CardMutations, card: StoredCard | null | undefined, toDeckId: string): boolean {
  if (!card || !card.recordId || !toDeckId) {
    console.error('moveCard: invalid parameters')
    return false
  }
  const data = prepareCardData({ ...card, deckId: toDeckId })
  mutations.put(card.recordId, data)
  return true
}

// ============================================================================
// Bulk operations
// ============================================================================

/**
 * Delete multiple cards (with media cleanup).
 * @param mutations - from useMutations('cards')
 * @param cardIds
 * @param cards - card map (to look up recordIds)
 * @param mediaMutations - optional, from useMutations('media'), for media cleanup
 * @param mediaRecords - optional, media records for cleanup
 */
export function bulkDeleteCards(
  mutations: CardMutations,
  cardIds: string[],
  cards: CardMap,
  mediaMutations: MediaMutations | null = null,
  mediaRecords: MediaEnvelope[] | null = null
): { deleted: number; errors: number } {
  if (!cardIds || cardIds.length === 0) return { deleted: 0, errors: 0 }
  let deleted = 0, errors = 0

  cardIds.forEach(cardId => {
    const card = cards[cardId]
    if (card?.recordId) {
      deleteCard(mutations, card, mediaMutations, mediaRecords)
      deleted++
    } else {
      errors++
    }
  })
  return { deleted, errors }
}

/**
 * Move multiple cards to a different deck.
 * @param mutations - from useMutations('cards')
 * @param cardIds
 * @param cards - card map
 * @param toDeckId
 */
export function bulkMoveCards(
  mutations: CardMutations,
  cardIds: string[],
  cards: CardMap,
  toDeckId: string
): { moved: number; errors: number } {
  if (!cardIds || cardIds.length === 0 || !toDeckId) return { moved: 0, errors: 0 }
  let moved = 0, errors = 0

  cardIds.forEach(cardId => {
    const card = cards[cardId]
    if (card?.recordId) {
      const success = moveCard(mutations, card, toDeckId)
      if (success) moved++
      else errors++
    } else {
      errors++
    }
  })
  return { moved, errors }
}

/**
 * Update tags for multiple cards.
 * @param mutations - from useMutations('cards')
 * @param cardIds
 * @param cards - card map
 * @param tagsToAdd
 * @param tagsToRemove
 */
export function bulkUpdateTags(
  mutations: CardMutations,
  cardIds: string[],
  cards: CardMap,
  tagsToAdd: string[] = [],
  tagsToRemove: string[] = []
): { updated: number; errors: number } {
  if (!cardIds || cardIds.length === 0) return { updated: 0, errors: 0 }
  let updated = 0, errors = 0

  cardIds.forEach(cardId => {
    const card = cards[cardId]
    if (card?.recordId) {
      const currentTags = new Set(card.tags || [])
      tagsToRemove.forEach(tag => currentTags.delete(tag))
      tagsToAdd.forEach(tag => currentTags.add(tag))
      const data = prepareCardData({ ...card, tags: Array.from(currentTags) })
      mutations.put(card.recordId, data)
      updated++
    } else {
      errors++
    }
  })
  return { updated, errors }
}

/**
 * Reset scheduling for multiple cards (back to 'new' state).
 * @param mutations - from useMutations('cards')
 * @param cardIds
 * @param cards - card map
 */
export function bulkResetScheduling(
  mutations: CardMutations,
  cardIds: string[],
  cards: CardMap
): { reset: number; errors: number } {
  if (!cardIds || cardIds.length === 0) return { reset: 0, errors: 0 }
  let reset = 0, errors = 0

  cardIds.forEach(cardId => {
    const card = cards[cardId]
    if (card?.recordId) {
      const data = prepareCardData({
        ...card,
        scheduling: {
          state: 'new',
          dueDate: new Date().toISOString(),
          interval: 0,
          ease: 2.5,
          lapses: 0,
          stepsIndex: 0,
          isLeech: false
        },
        revLog: []
      } as StoredCard)
      mutations.put(card.recordId, data)
      reset++
    } else {
      errors++
    }
  })
  return { reset, errors }
}

// ============================================================================
// Daily progress helpers (pure functions, unchanged)
// ============================================================================

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get or initialize daily progress for a deck.
 * @param dailyProgress - current progress from storage
 * @param deckId
 */
export function getDailyProgress(dailyProgress: DailyProgress | null, deckId: string | null): DailyProgress {
  const today = getTodayDateString()
  // Use a string key for the decks map; a null deckId resolves to a default
  // entry under the "null" key, matching the original untyped behaviour.
  const key = String(deckId)

  if (!dailyProgress || dailyProgress.date !== today) {
    return {
      date: today,
      decks: {
        [key]: { seenNewCardIds: [], seenReviewCardIds: [] }
      }
    }
  }

  if (!dailyProgress.decks[key]) {
    dailyProgress.decks[key] = { seenNewCardIds: [], seenReviewCardIds: [] }
  }
  return dailyProgress
}

/**
 * Record that a new card was seen today.
 * @param dailyProgress
 * @param deckId
 * @param cardId
 * @returns updated daily progress
 */
export function recordNewCardSeen(dailyProgress: DailyProgress | null, deckId: string, cardId: string): DailyProgress {
  const today = getTodayDateString()

  if (!dailyProgress || dailyProgress.date !== today) {
    dailyProgress = { date: today, decks: {} }
  }
  if (!dailyProgress.decks[deckId]) {
    dailyProgress.decks[deckId] = { seenNewCardIds: [], seenReviewCardIds: [] }
  }
  if (!dailyProgress.decks[deckId].seenNewCardIds.includes(cardId)) {
    dailyProgress.decks[deckId].seenNewCardIds.push(cardId)
  }
  return dailyProgress
}

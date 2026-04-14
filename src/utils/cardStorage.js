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
} from './mediaStorage.js';

// ============================================================================
// Helpers — build the card map that components consume
// ============================================================================

/**
 * Convert an array of card records (from useQuery) into the working map format.
 * Each entry keeps all data fields plus `recordId` for mutation reference.
 *
 * @param {Array} cardRecords - records from useQuery('cards')
 * @returns {Object} { [cardId]: { ...cardData, recordId } }
 */
export function buildCardMap(cardRecords) {
  const map = {};
  cardRecords.forEach(r => {
    const id = r.data.id;
    if (id) {
      map[id] = { ...r.data, recordId: r.recordId };
    }
  });
  return map;
}

// ============================================================================
// READ operations — work on the pre-built cards map
// ============================================================================

/**
 * Get all cards, optionally filtered by deck.
 * @param {Object} cards - card map { [cardId]: cardData }
 * @param {string|null} deckId - optional deck filter
 * @returns {Object} filtered card map
 */
export function getAllCards(cards, deckId = null) {
  if (!deckId) return cards;
  const filtered = {};
  Object.entries(cards).forEach(([id, card]) => {
    if (card.deckId === deckId) filtered[id] = card;
  });
  return filtered;
}

/**
 * Get card statistics for a deck.
 * @param {Object} cards - card map
 * @param {string|null} deckId - optional deck filter
 * @param {Object|null} settings - optional settings for daily limits
 * @returns {Object} stats { total, new, learning, review, due }
 */
export function getCardStats(cards, deckId = null, settings = null) {
  let cardArray = Object.values(cards);
  if (deckId) {
    cardArray = cardArray.filter(c => c.deckId === deckId);
  }
  const now = new Date();

  const allNew = cardArray.filter(c => c.scheduling?.state === 'new');
  const allLearning = cardArray.filter(c => c.scheduling?.state === 'learning');
  const allReview = cardArray.filter(c => c.scheduling?.state === 'review');

  const dueNew = allNew.filter(c => new Date(c.scheduling?.dueDate) <= now);
  const dueLearning = allLearning.filter(c => new Date(c.scheduling?.dueDate) <= now);
  const dueReview = allReview.filter(c => new Date(c.scheduling?.dueDate) <= now);

  let displayDueCount = 0;
  if (settings?.global) {
    const newCardLimit = settings.global.newCardsPerDay;
    const limitedNewCards = (typeof newCardLimit === 'number' && newCardLimit > 0)
      ? Math.min(dueNew.length, newCardLimit)
      : dueNew.length;

    const reviewLimit = settings.global.maxReviewsPerDay;
    const limitedReviewCards = (typeof reviewLimit === 'number' && reviewLimit > 0)
      ? Math.min(dueLearning.length + dueReview.length, reviewLimit)
      : (dueLearning.length + dueReview.length);

    displayDueCount = limitedReviewCards + limitedNewCards;
  } else {
    displayDueCount = dueNew.length + dueLearning.length + dueReview.length;
  }

  return {
    total: cardArray.length,
    new: allNew.length,
    learning: allLearning.length,
    review: allReview.length,
    due: displayDueCount
  };
}

/**
 * Get due cards for review with limit enforcement.
 * @param {Object} cards - card map
 * @param {string|null} deckId
 * @param {Object|null} settings
 * @param {Object|null} dailyProgress
 * @returns {Array} sorted due cards
 */
export function getDueCards(cards, deckId = null, settings = null, dailyProgress = null) {
  let cardValues = Object.values(cards);
  if (deckId) {
    cardValues = cardValues.filter(c => c.deckId === deckId);
  }
  const now = new Date();

  const allDueCards = cardValues.filter(card => {
    if (!card.scheduling || !card.scheduling.dueDate) return false;
    return new Date(card.scheduling.dueDate) <= now;
  });

  let newCards = allDueCards.filter(card => card.scheduling.state === 'new');
  const learningCards = allDueCards.filter(card => card.scheduling.state === 'learning');
  const reviewCards = allDueCards.filter(card => card.scheduling.state === 'review');

  // Exclude new cards already seen today
  if (dailyProgress?.seenNewCardIds && dailyProgress.seenNewCardIds.length > 0) {
    const seenSet = new Set(dailyProgress.seenNewCardIds);
    newCards = newCards.filter(card => !seenSet.has(card.id));
  }

  const sortByDueDate = (a, b) =>
    new Date(a.scheduling.dueDate) - new Date(b.scheduling.dueDate);

  newCards.sort(sortByDueDate);
  learningCards.sort(sortByDueDate);
  reviewCards.sort(sortByDueDate);

  let limitedNewCards = newCards;
  let limitedLearningReviewCards = [...learningCards, ...reviewCards];

  if (settings?.global) {
    const newCardLimit = settings.global.newCardsPerDay;
    if (typeof newCardLimit === 'number' && newCardLimit > 0) {
      limitedNewCards = limitedNewCards.slice(0, newCardLimit);
    }
    const reviewLimit = settings.global.maxReviewsPerDay;
    if (typeof reviewLimit === 'number' && reviewLimit > 0) {
      limitedLearningReviewCards = limitedLearningReviewCards.slice(0, reviewLimit);
    }
  }

  const sortedLearningReview = limitedLearningReviewCards.sort((a, b) => {
    const statePriority = { learning: 0, review: 1 };
    const priorityA = statePriority[a.scheduling.state] ?? 2;
    const priorityB = statePriority[b.scheduling.state] ?? 2;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return sortByDueDate(a, b);
  });

  return [...sortedLearningReview, ...limitedNewCards];
}

/**
 * Get words that already have cards (from word library imports).
 * @param {Object} cards - card map
 * @returns {Set}
 */
export function getExistingCardWords(cards) {
  const existingWords = new Set();
  Object.values(cards).forEach(card => {
    if (card.metadata?.createdFrom === 'word-library' && card.metadata?.word) {
      existingWords.add(card.metadata.word.toLowerCase().trim());
    }
  });
  return existingWords;
}

// ============================================================================
// WRITE operations — accept mutations from useMutations('cards')
// ============================================================================

/**
 * Prepare a clean card data object for storage (strips recordId).
 * @param {Object} card - card with possible recordId
 * @returns {Object} clean data for create/put
 */
function prepareCardData(card) {
  const { recordId, ...fields } = card;
  const now = new Date().toISOString();
  return {
    ...fields,
    version: card.version || '1.0',
    updatedAt: now,
    createdAt: card.createdAt || now,
  };
}

/**
 * Save (create or update) a single card.
 * If the card has a `recordId`, it's an update; otherwise a create.
 *
 * @param {Object} mutations - { create, put, remove } from useMutations('cards')
 * @param {Object} card - card data (may include recordId for updates)
 */
export function saveCard(mutations, card) {
  if (!card || !card.id || !card.deckId) {
    console.error('Cannot save card: missing id or deckId', {
      hasCard: !!card,
      cardId: card?.id,
      deckId: card?.deckId
    });
    return;
  }

  const data = prepareCardData(card);

  if (card.recordId) {
    mutations.put(card.recordId, data);
  } else {
    mutations.create(data);
  }
}

/**
 * Save multiple cards at once.
 * @param {Object} mutations - from useMutations('cards')
 * @param {Object|Array} cards - card map or array
 */
export function saveCards(mutations, cards) {
  const cardArray = Array.isArray(cards) ? cards : Object.values(cards);
  cardArray.forEach(card => saveCard(mutations, card));
}

/**
 * Delete a card.
 * @param {Object} mutations - from useMutations('cards')
 * @param {Object} card - card object (needs recordId)
 * @param {Object} mediaMutations - optional, from useMutations('media'), for media cleanup
 * @param {Array} mediaRecords - optional, media records for cleanup
 */
export function deleteCard(mutations, card, mediaMutations = null, mediaRecords = null) {
  if (!card || !card.recordId) {
    console.error('Cannot delete card: missing recordId');
    return;
  }

  // Clean up media references — wrapped in try-catch so card deletion
  // always proceeds even if media cleanup encounters unexpected data.
  try {
    if (mediaMutations && mediaRecords && card.content?.fieldMedia) {
      const fieldMediaValues = Object.values(card.content.fieldMedia);
      for (const media of fieldMediaValues) {
        if (!media || typeof media !== 'object') continue;
        if (Array.isArray(media.images)) {
          media.images.forEach(ref => {
            if (isMediaReference(ref)) {
              const mediaId = extractMediaId(ref);
              if (mediaId) decrementRefCount(mediaMutations, mediaRecords, mediaId);
            }
          });
        }
        if (Array.isArray(media.audio)) {
          media.audio.forEach(ref => {
            if (isMediaReference(ref)) {
              const mediaId = extractMediaId(ref);
              if (mediaId) decrementRefCount(mediaMutations, mediaRecords, mediaId);
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn('Media cleanup failed during card deletion, proceeding with delete:', err);
  }

  mutations.remove(card.recordId);
}

/**
 * Move a card to a different deck.
 * @param {Object} mutations - from useMutations('cards')
 * @param {Object} card - card object (needs recordId)
 * @param {string} toDeckId - target deck
 * @returns {boolean} success
 */
export function moveCard(mutations, card, toDeckId) {
  if (!card || !card.recordId || !toDeckId) {
    console.error('moveCard: invalid parameters');
    return false;
  }
  const data = prepareCardData({ ...card, deckId: toDeckId });
  mutations.put(card.recordId, data);
  return true;
}

// ============================================================================
// Bulk operations
// ============================================================================

/**
 * Delete multiple cards (with media cleanup).
 * @param {Object} mutations - from useMutations('cards')
 * @param {Array<string>} cardIds
 * @param {Object} cards - card map (to look up recordIds)
 * @param {Object} mediaMutations - optional, from useMutations('media'), for media cleanup
 * @param {Array} mediaRecords - optional, media records for cleanup
 * @returns {{ deleted: number, errors: number }}
 */
export function bulkDeleteCards(mutations, cardIds, cards, mediaMutations = null, mediaRecords = null) {
  if (!cardIds || cardIds.length === 0) return { deleted: 0, errors: 0 };
  let deleted = 0, errors = 0;

  cardIds.forEach(cardId => {
    const card = cards[cardId];
    if (card?.recordId) {
      deleteCard(mutations, card, mediaMutations, mediaRecords);
      deleted++;
    } else {
      errors++;
    }
  });
  return { deleted, errors };
}

/**
 * Move multiple cards to a different deck.
 * @param {Object} mutations - from useMutations('cards')
 * @param {Array<string>} cardIds
 * @param {Object} cards - card map
 * @param {string} toDeckId
 * @returns {{ moved: number, errors: number }}
 */
export function bulkMoveCards(mutations, cardIds, cards, toDeckId) {
  if (!cardIds || cardIds.length === 0 || !toDeckId) return { moved: 0, errors: 0 };
  let moved = 0, errors = 0;

  cardIds.forEach(cardId => {
    const card = cards[cardId];
    if (card?.recordId) {
      const success = moveCard(mutations, card, toDeckId);
      if (success) moved++;
      else errors++;
    } else {
      errors++;
    }
  });
  return { moved, errors };
}

/**
 * Update tags for multiple cards.
 * @param {Object} mutations - from useMutations('cards')
 * @param {Array<string>} cardIds
 * @param {Object} cards - card map
 * @param {Array} tagsToAdd
 * @param {Array} tagsToRemove
 * @returns {{ updated: number, errors: number }}
 */
export function bulkUpdateTags(mutations, cardIds, cards, tagsToAdd = [], tagsToRemove = []) {
  if (!cardIds || cardIds.length === 0) return { updated: 0, errors: 0 };
  let updated = 0, errors = 0;

  cardIds.forEach(cardId => {
    const card = cards[cardId];
    if (card?.recordId) {
      const currentTags = new Set(card.tags || []);
      tagsToRemove.forEach(tag => currentTags.delete(tag));
      tagsToAdd.forEach(tag => currentTags.add(tag));
      const data = prepareCardData({ ...card, tags: Array.from(currentTags) });
      mutations.put(card.recordId, data);
      updated++;
    } else {
      errors++;
    }
  });
  return { updated, errors };
}

/**
 * Reset scheduling for multiple cards (back to 'new' state).
 * @param {Object} mutations - from useMutations('cards')
 * @param {Array<string>} cardIds
 * @param {Object} cards - card map
 * @returns {{ reset: number, errors: number }}
 */
export function bulkResetScheduling(mutations, cardIds, cards) {
  if (!cardIds || cardIds.length === 0) return { reset: 0, errors: 0 };
  let reset = 0, errors = 0;

  cardIds.forEach(cardId => {
    const card = cards[cardId];
    if (card?.recordId) {
      const data = prepareCardData({
        ...card,
        scheduling: {
          state: 'new',
          dueDate: new Date().toISOString(),
          interval: 0,
          ease: 2.5,
          lapses: 0,
          stepsIndex: 0
        },
        revLog: []
      });
      mutations.put(card.recordId, data);
      reset++;
    } else {
      errors++;
    }
  });
  return { reset, errors };
}

// ============================================================================
// Daily progress helpers (pure functions — unchanged)
// ============================================================================

export function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get or initialize daily progress for a deck.
 * @param {Object|null} dailyProgress - current progress from storage
 * @param {string} deckId
 * @returns {Object}
 */
export function getDailyProgress(dailyProgress, deckId) {
  const today = getTodayDateString();

  if (!dailyProgress || dailyProgress.date !== today) {
    return {
      date: today,
      decks: {
        [deckId]: { seenNewCardIds: [], seenReviewCardIds: [] }
      }
    };
  }

  if (!dailyProgress.decks[deckId]) {
    dailyProgress.decks[deckId] = { seenNewCardIds: [], seenReviewCardIds: [] };
  }
  return dailyProgress;
}

/**
 * Record that a new card was seen today.
 * @param {Object|null} dailyProgress
 * @param {string} deckId
 * @param {string} cardId
 * @returns {Object} updated daily progress
 */
export function recordNewCardSeen(dailyProgress, deckId, cardId) {
  const today = getTodayDateString();

  if (!dailyProgress || dailyProgress.date !== today) {
    dailyProgress = { date: today, decks: {} };
  }
  if (!dailyProgress.decks[deckId]) {
    dailyProgress.decks[deckId] = { seenNewCardIds: [], seenReviewCardIds: [] };
  }
  if (!dailyProgress.decks[deckId].seenNewCardIds.includes(cardId)) {
    dailyProgress.decks[deckId].seenNewCardIds.push(cardId);
  }
  return dailyProgress;
}


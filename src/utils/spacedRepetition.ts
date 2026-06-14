/**
 * SM-2 Spaced Repetition Algorithm Implementation
 *
 * Based on Anki's implementation of the SM-2 algorithm with enhancements:
 * - Ease factor adjustments based on performance
 * - Learning steps for new cards
 * - Interval fuzz to prevent card clustering
 * - Leech detection for problematic cards
 */

import type { Card, ReviewRating, SchedulingState, Settings } from '../types';

/**
 * Parse interval string (e.g., "1m", "10m", "1h", "1d") to days
 * @param intervalStr - Interval string in format "number + unit"
 * @returns Interval in days
 */
function parseInterval(intervalStr: string): number {
  if (!intervalStr || typeof intervalStr !== 'string') return 0;

  const match = intervalStr.match(/^(\d+)([mhd])$/);
  if (!match) {
    console.warn(`Invalid interval format: ${intervalStr}`);
    return 0;
  }

  const [, num, unit] = match;
  const value = parseInt(num, 10);

  if (isNaN(value) || value < 0) return 0;

  switch (unit) {
    case 'm': return value / (60 * 24); // minutes to days
    case 'h': return value / 24; // hours to days
    case 'd': return value; // days
    default: return 0;
  }
}

/**
 * Apply interval fuzz to prevent card clustering
 * Adds ±25% randomization to intervals >= 1 day
 * @param interval - Base interval in days
 * @returns Fuzzed interval in days
 */
function applyIntervalFuzz(interval: number): number {
  // Only apply fuzz to intervals >= 1 day
  if (interval < 1) return interval;

  // Random factor between 0.75 and 1.25 (±25%)
  const fuzzFactor = 0.75 + Math.random() * 0.5;
  return Math.max(0.1, interval * fuzzFactor);
}

/**
 * Check if a card should be marked as a leech
 * @param lapses - Number of times card has been failed
 * @param leechThreshold - Threshold for leech detection
 * @returns True if card is a leech
 */
function isLeech(lapses: number, leechThreshold: number): boolean {
  return lapses >= (leechThreshold || 5);
}

/**
 * Calculate next review scheduling based on user rating
 * Implements Anki's SM-2 algorithm with proper ease factor management
 *
 * @param card - Card object with scheduling property
 * @param rating - User rating (1=Again, 2=Hard, 3=Good, 4=Easy)
 * @param settings - Settings object with global property
 * @returns Updated scheduling object
 */
export function calculateNextReview(
  card: Card,
  rating: ReviewRating,
  settings: Settings
): SchedulingState {
  // Validate inputs
  if (!card || !card.scheduling) {
    throw new Error('Card must have a scheduling property');
  }

  if (![1, 2, 3, 4].includes(rating)) {
    throw new Error(`Invalid rating: ${rating}. Must be 1, 2, 3, or 4`);
  }

  if (!settings || !settings.global) {
    console.error('Settings or settings.global is undefined in calculateNextReview', { settings });
    throw new Error('Settings must be provided with a global property');
  }

  const { scheduling } = card;
  const { state, interval = 0, ease = 2.5, stepsIndex = 0, lapses = 0 } = scheduling;
  const globalSettings = settings.global;

  // Initialize defaults with proper fallbacks
  // Ease factor bounds: minimum 1.3 (130%), maximum 2.5 (250%) per Anki defaults
  const minEase = 1.3;
  const maxEase = globalSettings.maximumEase || 2.5; // Anki default is 2.5, but can be increased

  let newState = state || 'new';
  let newInterval = interval;
  let newEase = Math.max(minEase, Math.min(maxEase, ease || globalSettings.startingEase || 2.5));
  let newStepsIndex = stepsIndex || 0;
  let newLapses = lapses || 0;
  let isLeechCard = false;

  const now = new Date();

  // Again (1) - Reset to beginning, decrease ease factor
  if (rating === 1) {
    if (state === 'new' || state === 'learning') {
      newState = 'learning';
      newStepsIndex = 0;
      const firstStep = globalSettings.learningSteps?.[0] || '1m';
      newInterval = parseInterval(firstStep);
    } else if (state === 'review') {
      newState = 'learning';
      newStepsIndex = 0;
      const firstRelearningStep = globalSettings.relearningSteps?.[0] || '10m';
      newInterval = parseInterval(firstRelearningStep);
      newLapses = (lapses || 0) + 1;

      // Decrease ease factor when failing a review card (Anki default: -0.20)
      // This prevents "ease hell" where cards remain too difficult
      const easePenalty = globalSettings.easePenalty || 0.20;
      newEase = Math.max(minEase, newEase - easePenalty);

      // Check for leech threshold
      isLeechCard = isLeech(newLapses, globalSettings.leechThreshold);
    }
  }

  // Hard (2) - Repeat current step or reduce interval
  else if (rating === 2) {
    if (state === 'new' || state === 'learning') {
      // Stay on current step
      newState = 'learning';
      const currentStep = globalSettings.learningSteps?.[stepsIndex] ||
                         globalSettings.learningSteps?.[globalSettings.learningSteps.length - 1] ||
                         '1m';
      newInterval = parseInterval(currentStep);
    } else if (state === 'review') {
      newState = 'review';
      // Hard reduces interval and decreases ease
      newInterval = Math.max(
        globalSettings.minimumInterval || 1,
        interval * (globalSettings.hardInterval || 1.2)
      );
      newEase = Math.max(minEase, newEase - 0.15);
    }
  }

  // Good (3) - Progress normally
  else if (rating === 3) {
    if (state === 'new' || state === 'learning') {
      const nextStepIndex = (stepsIndex || 0) + 1;
      const learningSteps = globalSettings.learningSteps || ['1m', '10m'];

      if (nextStepIndex >= learningSteps.length) {
        // Graduate to review
        newState = 'review';
        newInterval = globalSettings.graduatingInterval || 1;
      } else {
        // Move to next learning step
        newState = 'learning';
        newStepsIndex = nextStepIndex;
        newInterval = parseInterval(learningSteps[nextStepIndex]);
      }
    } else if (state === 'review') {
      newState = 'review';
      // Standard SM-2 formula: interval * ease * modifier
      const baseInterval = interval * newEase * (globalSettings.intervalModifier || 1.0);
      newInterval = Math.min(
        globalSettings.maximumInterval || 36500,
        baseInterval
      );
      // Ease factor remains unchanged for "Good" rating
    }
  }

  // Easy (4) - Fast track
  else if (rating === 4) {
    if (state === 'new' || state === 'learning') {
      // Graduate immediately
      newState = 'review';
      newInterval = globalSettings.easyInterval || 4;
      // Increase ease for easy rating, capped at maximum
      newEase = Math.min(maxEase, newEase + 0.15);
    } else if (state === 'review') {
      newState = 'review';
      // Easy gets bonus multiplier and ease increase
      const baseInterval = interval * newEase *
                          (globalSettings.intervalModifier || 1.0) *
                          (globalSettings.easyBonus || 1.3);
      newInterval = Math.min(
        globalSettings.maximumInterval || 36500,
        baseInterval
      );
      // Increase ease, but cap at maximum ease setting
      newEase = Math.min(maxEase, newEase + 0.15);
    }
  }

  // Apply interval fuzz to prevent card clustering (only for review intervals >= 1 day)
  if (newState === 'review' && newInterval >= 1) {
    newInterval = applyIntervalFuzz(newInterval);
  }

  // Calculate due date
  const dueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  return {
    state: newState,
    interval: Math.round(newInterval * 100) / 100, // Round to 2 decimal places
    ease: Math.round(newEase * 100) / 100, // Round to 2 decimal places
    dueDate: dueDate.toISOString(),
    lapses: newLapses,
    stepsIndex: newStepsIndex,
    isLeech: isLeechCard
  };
}

export function formatDueDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) return 'Due now';
  if (diffMins < 60) return `Due in ${diffMins}m`;
  if (diffHours < 24) return `Due in ${diffHours}h`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays < 30) return `Due in ${diffDays}d`;

  const months = Math.floor(diffDays / 30);
  if (months < 12) return `Due in ${months}mo`;

  return `Due in ${Math.floor(months / 12)}y`;
}

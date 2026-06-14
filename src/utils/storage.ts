/**
 * Storage Utility Functions
 *
 * These functions provide default data structures for lazy initialization.
 * They're only called when the corresponding data doesn't exist in storage.
 */

import type { Settings } from '../types';

/**
 * Get default settings structure
 * Used for lazy initialization - only called when settings don't exist
 */
export function getDefaultSettings(): Settings {
  return {
    global: {
      newCardsPerDay: 20,
      maxReviewsPerDay: 100,
      learningSteps: ['1m', '10m'],
      graduatingInterval: 1,
      easyInterval: 4,
      startingEase: 2.5,
      easyBonus: 1.3,
      hardInterval: 1.2,
      intervalModifier: 1.0,
      maximumInterval: 36500,
      leechThreshold: 5,
      relearningSteps: ['10m'],
      minimumInterval: 1,
      easePenalty: 0.20, // Ease factor decrease on "Again" in review state (Anki default)
      maximumEase: 2.5 // Maximum ease factor (Anki default is 2.5, can be increased up to 3.0)
    }
  };
}

/**
 * Generate a unique ID for cards, decks, etc.
 * @returns Unique identifier
 */
export function generateId(): string {
  return 'id-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Format a date string into a human-readable relative time
 * @param dateString - ISO date string
 * @returns Formatted date (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatDate(dateString: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Note: getDefaultCardTypes is imported from fieldSystem to avoid duplication
// This is a re-export for consistency with other default getters
export { getDefaultCardTypes } from './fieldSystem';

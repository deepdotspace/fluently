/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth, imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { decksSchema } from './schemas/decks-schema'
import { cardsSchema } from './schemas/cards-schema'
import { flashcardSettingsSchema } from './schemas/flashcard-settings-schema'
import { cardTypesSchema } from './schemas/card-types-schema'
import { customThemesSchema } from './schemas/custom-themes-schema'
import { userPreferencesSchema } from './schemas/user-preferences-schema'
import { dailyProgressSchema } from './schemas/daily-progress-schema'
import { mediaSchema } from './schemas/media-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  decksSchema,
  cardsSchema,
  flashcardSettingsSchema,
  cardTypesSchema,
  customThemesSchema,
  userPreferencesSchema,
  dailyProgressSchema,
  mediaSchema,
]

import type { CollectionSchema } from 'deepspace/worker'

export const flashcardSettingsSchema: CollectionSchema = {
  name: 'flashcard-settings',
  columns: [
    { name: 'config', storage: 'text', interpretation: 'json', required: true },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

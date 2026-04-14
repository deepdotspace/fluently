import type { CollectionSchema } from 'deepspace/worker'

export const userPreferencesSchema: CollectionSchema = {
  name: 'user-preferences',
  columns: [
    { name: 'activeTab', storage: 'text', interpretation: 'plain' },
    { name: 'selectedDeck', storage: 'text', interpretation: 'plain' },
    { name: 'currentTheme', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

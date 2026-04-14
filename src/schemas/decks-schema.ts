import type { CollectionSchema } from 'deepspace/worker'

export const decksSchema: CollectionSchema = {
  name: 'decks',
  columns: [
    { name: 'id', storage: 'text', interpretation: 'plain', required: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'targetLang', storage: 'text', interpretation: 'plain' },
    { name: 'nativeLang', storage: 'text', interpretation: 'plain' },
    { name: 'designId', storage: 'text', interpretation: 'plain' },
    { name: 'settingsOverride', storage: 'text', interpretation: 'json' },
    { name: 'cardCounts', storage: 'text', interpretation: 'json' },
    { name: 'lastStudiedAt', storage: 'text', interpretation: 'plain' },
    { name: 'tags', storage: 'text', interpretation: 'json' },
    { name: 'createdAt', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

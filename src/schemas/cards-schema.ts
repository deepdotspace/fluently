import type { CollectionSchema } from 'deepspace/worker'

export const cardsSchema: CollectionSchema = {
  name: 'cards',
  columns: [
    { name: 'id', storage: 'text', interpretation: 'plain', required: true },
    { name: 'deckId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'cardTypeId', storage: 'text', interpretation: 'plain' },
    { name: 'content', storage: 'text', interpretation: 'json' },
    { name: 'scheduling', storage: 'text', interpretation: 'json' },
    { name: 'tags', storage: 'text', interpretation: 'json' },
    { name: 'metadata', storage: 'text', interpretation: 'json' },
    { name: 'revLog', storage: 'text', interpretation: 'json' },
    { name: 'version', storage: 'text', interpretation: 'plain' },
    { name: 'createdAt', storage: 'text', interpretation: 'plain' },
    { name: 'updatedAt', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

import type { CollectionSchema } from 'deepspace/worker'

export const dailyProgressSchema: CollectionSchema = {
  name: 'daily-progress',
  columns: [
    { name: 'date', storage: 'text', interpretation: 'plain', required: true },
    { name: 'progress', storage: 'text', interpretation: 'json', required: true },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

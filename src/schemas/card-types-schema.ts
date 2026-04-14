import type { CollectionSchema } from 'deepspace/worker'

export const cardTypesSchema: CollectionSchema = {
  name: 'card-types',
  columns: [
    { name: 'types', storage: 'text', interpretation: 'json', required: true },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

import type { CollectionSchema } from 'deepspace/worker'

export const customThemesSchema: CollectionSchema = {
  name: 'custom-themes',
  columns: [
    { name: 'themes', storage: 'text', interpretation: 'json', required: true },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

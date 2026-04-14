import type { CollectionSchema } from 'deepspace/worker'

export const mediaSchema: CollectionSchema = {
  name: 'media',
  columns: [
    { name: 'mediaId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'mediaType', storage: 'text', interpretation: 'plain', required: true },
    { name: 'hash', storage: 'text', interpretation: 'plain', required: true },
    { name: 'data', storage: 'text', interpretation: 'plain' },
    { name: 'mimeType', storage: 'text', interpretation: 'plain' },
    { name: 'ext', storage: 'text', interpretation: 'plain' },
    { name: 'size', storage: 'number', interpretation: 'plain' },
    { name: 'refCount', storage: 'number', interpretation: 'plain' },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

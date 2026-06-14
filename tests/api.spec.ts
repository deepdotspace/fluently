/**
 * API tests for the Fluently worker (`worker.ts`).
 *
 * Covers the auth proxy health check, the auth gating on the server-actions
 * route (the only HTTP-enforced auth check in this single-user app), and that
 * the record-sync WebSocket endpoint actually accepts a connection — which is
 * what the signed-in app relies on to load decks/cards.
 */
import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('server action route rejects unauthenticated callers with 401', async ({ request }) => {
    // worker.ts `POST /api/actions/:name` calls resolveAuth() and returns 401
    // before doing any work when there's no valid session/bearer token.
    const res = await request.post('/api/actions/any-action', {
      data: {},
      // No Authorization header / cookie → unauthenticated.
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'Unauthorized' })
  })

  test('record-sync WebSocket endpoint accepts a connection', async ({ page }) => {
    // worker.ts exposes `GET /ws/:roomId` for the RecordRoom durable object the
    // app's RecordScope connects to. Open it directly and assert the upgrade
    // succeeds (anonymous connections are allowed; they just get no write role).
    // Navigate first so the page has a real origin for the ws:// URL.
    await page.goto('/')
    const result = await page.evaluate(async () => {
      const wsUrl = `${location.origin.replace(/^http/, 'ws')}/ws/smoke-test-room`
      return await new Promise<string>((resolve) => {
        const ws = new WebSocket(wsUrl)
        const done = (v: string) => {
          try { ws.close() } catch { /* noop */ }
          resolve(v)
        }
        ws.onopen = () => done('open')
        ws.onerror = () => done('error')
        setTimeout(() => done('timeout'), 8000)
      })
    })
    expect(result).toBe('open')
  })
})

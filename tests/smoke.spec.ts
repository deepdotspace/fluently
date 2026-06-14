/**
 * Smoke tests for Fluently — an auth-gated, single-user Anki-style flashcard app.
 *
 * Signed-out visitors see a public marketing landing (the scroll-snap world
 * deck in `src/components/landing`), NOT the app and NOT the bare auth overlay.
 * The landing's "Get started" CTA opens the SDK `<AuthOverlay/>` on click. The
 * signed-in app ships no `data-testid`s, so its tests assert on visible text
 * and ARIA roles.
 *
 * Signed-in tests use the `deepspace/testing` `users` fixture, which signs each
 * cached test account in once per machine (storageState) instead of driving the
 * login UI by hand.
 */
import { test, expect } from 'deepspace/testing'
import { test as baseTest } from '@playwright/test'

// The five real top-level tabs rendered by the Navbar (see `src/pages/home.tsx`
// `navTabs`). They render as <button> elements with this visible text.
const NAV_TABS = ['Home', 'Import Decks', 'Create', 'Browse', 'Settings']

test.describe('Signed-out landing', () => {
  baseTest('signed-out visitor sees the landing, not the app', async ({ page }) => {
    await page.goto('/')

    // The landing world deck mounts for signed-out visitors.
    await expect(page.getByTestId('landing-deck')).toBeVisible({ timeout: 15_000 })

    // The hero wordmark renders (SlamText sets aria-label="FLUENTLY" on the
    // <h1>, so the accessible name is exposed even mid-animation).
    await expect(page.getByRole('heading', { name: 'FLUENTLY' })).toBeVisible()

    // The primary "Get started" CTA is present.
    await expect(
      page.getByRole('button', { name: 'Get started' }).first(),
    ).toBeVisible()

    // The signed-in app chrome must NOT be in the DOM when signed out.
    await expect(page.getByRole('button', { name: 'Import Decks' })).toHaveCount(0)

    // The auth overlay is NOT shown until a CTA is clicked.
    await expect(page.getByTestId('auth-overlay')).toHaveCount(0)
  })

  baseTest('clicking "Get started" opens the sign-in overlay', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-deck')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Get started' }).first().click()

    // The SDK AuthOverlay carries this stable testid.
    await expect(page.getByTestId('auth-overlay')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Signed-in app shell', () => {
  test('renders the Fluently navbar with all five tabs', async ({ users }) => {
    const [user] = await users(1)
    await user.page.goto('/')

    // No auth overlay once signed in.
    await expect(user.page.getByTestId('auth-overlay')).toHaveCount(0)

    // Brand wordmark (DOM text is "Fluently"; uppercase is CSS-only).
    await expect(user.page.getByText('Fluently', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Every nav tab is present as a real button.
    for (const label of NAV_TABS) {
      await expect(
        user.page.getByRole('button', { name: label }),
      ).toBeVisible()
    }
  })

  test('lands on Import Decks with real prebuilt + custom deck content', async ({ users }) => {
    const [user] = await users(1)
    await user.page.goto('/')

    // The default active tab is Import Decks. Its page heading is real content.
    await expect(
      user.page.getByRole('heading', { name: 'Import Decks' }),
    ).toBeVisible({ timeout: 15_000 })

    // The "Create Custom Deck" card is always rendered.
    await expect(
      user.page.getByRole('heading', { name: 'Create Custom Deck' }),
    ).toBeVisible()

    // A concrete prebuilt vocab deck card from the static catalog
    // (src/utils/vocabDeckGenerator.ts QUICK_PICK_DECKS).
    await expect(
      user.page.getByRole('heading', { name: 'Spanish A1-A2 Nouns' }),
    ).toBeVisible()
  })

  test('switching to Settings shows the settings page', async ({ users }) => {
    const [user] = await users(1)
    await user.page.goto('/')

    await user.page.getByRole('button', { name: 'Settings' }).click()
    // The Settings panel renders its own heading — proves tab routing works,
    // not just that the button exists.
    await expect(
      user.page.getByRole('heading', { name: /settings/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('unknown route shows the in-app 404 page', async ({ users }) => {
    const [user] = await users(1)
    // Routing lives inside the AuthGate, so the 404 page only renders when
    // signed in; a signed-out visitor would just see the overlay.
    await user.page.goto('/nonexistent-page-xyz')
    await expect(user.page.getByText('404')).toBeVisible({ timeout: 15_000 })
    await expect(user.page.getByText('Page not found')).toBeVisible()
  })
})

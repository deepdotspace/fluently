/**
 * `/landing` — the public marketing page, reachable by signed-in users.
 *
 * Signed-out visitors already see <Landing/> directly from the AuthGate, so
 * they never hit this route. Signed-in users reach it by clicking the navbar
 * "FLUENTLY" logo; it renders through the AuthGate's signed-in branch (Outlet),
 * so the same marketing deck is shown. Because <Landing/> resolves its CTA from
 * `useAuth().isSignedIn`, the "Get started" buttons here navigate straight back
 * into the app (`/home`) instead of opening sign-in.
 *
 * Lazy-loaded so `motion` and the entire landing chunk stay out of the
 * signed-in app bundle (matching how the AuthGate loads it).
 */

import { Suspense, lazy } from 'react'

const Landing = lazy(() => import('../components/landing/Landing'))

export default function LandingRoute() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100svh', background: '#eff6ff' }} />}>
      <Landing />
    </Suspense>
  )
}

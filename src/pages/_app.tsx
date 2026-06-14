/**
 * App: global providers + shell.
 *
 * Generouted renders this around all routes.
 * Providers → auth gate → page outlet.
 */

import { Suspense, lazy, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuth } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { APP_NAME, SCOPE_ID } from '../constants'
import { schemas } from '../schemas'

// Public, signed-out marketing landing. Lazy-loaded so `motion` and the entire
// landing live in their own chunk and never enter the signed-in app bundle.
const Landing = lazy(() => import('../components/landing/Landing'))

export default function App() {
  return (
    <DeepSpaceAuthProvider>
      <AuthGate>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </AuthGate>
    </DeepSpaceAuthProvider>
  )
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div style={{
        padding: '60px',
        textAlign: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        color: '#9CA3AF',
        fontSize: '16px'
      }}>
        Loading Fluently...
      </div>
    )
  }

  if (!isSignedIn) {
    // Signed-out visitors get the public landing, not the bare auth overlay.
    // The landing's CTAs open the sign-in overlay from inside it.
    return (
      <Suspense fallback={<div style={{ minHeight: '100svh', background: '#eff6ff' }} />}>
        <Landing />
      </Suspense>
    )
  }

  return (
    <RecordProvider>
      <RecordScope roomId={SCOPE_ID} schemas={schemas} appId={APP_NAME}>
        {children}
      </RecordScope>
    </RecordProvider>
  )
}

/**
 * App — global providers + shell.
 *
 * Generouted renders this around all routes.
 * Providers → auth gate → page outlet.
 */

import { Suspense, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuth, AuthOverlay } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { APP_NAME, SCOPE_ID } from '../constants'
import { schemas } from '../schemas'

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
    return <AuthOverlay />
  }

  return (
    <RecordProvider>
      <RecordScope roomId={SCOPE_ID} schemas={schemas} appId={APP_NAME}>
        {children}
      </RecordScope>
    </RecordProvider>
  )
}

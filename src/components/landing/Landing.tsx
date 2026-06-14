/**
 * Landing: the public marketing page for Fluently.
 *
 * A scroll-snap world deck adapted from the owner's `loud` portfolio design,
 * recolored to Fluently's light-blue -> violet identity with violet (#7c3aed)
 * as the single accent.
 *
 * The primary CTAs ("Get started" / "Try it") are auth-aware:
 *   - Signed-OUT visitors (the AuthGate gate view): clicking opens the SDK
 *     <AuthOverlay/> over the deck. The overlay is closeable (onClose), so a
 *     visitor can dismiss it and keep reading.
 *   - Signed-IN visitors (reached via the navbar logo -> `/landing` route):
 *     clicking navigates straight into the app at `/home`.
 *
 * The CTA handler is resolved internally from `useAuth().isSignedIn`, so the
 * same component works as both the signed-out gate view and the `/landing`
 * route view. A parent may still override via the optional `onCta` prop.
 *
 * This is the default export so it can be React.lazy()'d from the AuthGate,
 * keeping `motion` and all landing code out of the signed-in app bundle.
 */

import { useState } from 'react'
import { MotionConfig } from 'motion/react'
import { AuthOverlay, useAuth } from 'deepspace'
import { useNavigate } from 'react-router-dom'
import { WorldDeck } from './motion/WorldDeck'
import { Hero } from './sections/Hero'
import { Claim } from './sections/Claim'
import { FeatureWorld } from './sections/FeatureWorld'
import { HowItWorks } from './sections/HowItWorks'
import { Showcase } from './sections/Showcase'
import { Endcard } from './sections/Endcard'
import { features } from './content'

export default function Landing({ onCta }: { onCta?: () => void } = {}) {
  const [showSignIn, setShowSignIn] = useState(false)
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  // Auth-aware primary CTA: signed-in users go into the app; signed-out users
  // get the sign-in overlay. An explicit `onCta` prop wins over both.
  const handleCta = onCta
    ? onCta
    : isSignedIn
      ? () => navigate('/home')
      : () => setShowSignIn(true)

  return (
    <MotionConfig reducedMotion="user">
      <WorldDeck>
        <Hero onSignIn={handleCta} />
        <Claim />
        {features.map((f, i) => (
          <FeatureWorld
            key={f.id}
            feature={f}
            index={i}
            total={features.length}
            onSignIn={handleCta}
          />
        ))}
        <HowItWorks />
        <Showcase />
        <Endcard onSignIn={handleCta} />
      </WorldDeck>

      {showSignIn && <AuthOverlay onClose={() => setShowSignIn(false)} />}
    </MotionConfig>
  )
}

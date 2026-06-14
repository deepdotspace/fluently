/**
 * MadeWithDeepSpace: small attribution badge shown inside the signed-in app.
 *
 * An inline, theme-aware pill that sits in the top navbar's right cluster next
 * to the user pill. It mirrors the user pill's treatment exactly — translucent
 * white background, a subtle `theme.cardBorder` outline, and muted
 * `theme.textSecondary` text — so it reads as part of the light navbar instead
 * of the scaffold's dark-slate tokens. The one accent is a small violet
 * gradient sparkle. When the active soft theme is passed in, the pill adapts as
 * the user switches themes. Links to deep.space with the launch UTM params.
 */

import type { SoftTheme } from '../types'

const DEEPSPACE_URL =
  'https://deep.space/?utm_source=reddit&utm_medium=social&utm_campaign=launch&utm_content=open-source-post'

// Fallback colors (light navbar baseline) used if no theme is supplied — keeps
// the pill light/readable even outside the themed navbar.
const FALLBACK = {
  cardBorder: 'rgba(255,255,255,0.5)',
  textSecondary: '#475569',
}

export default function MadeWithDeepSpace({ theme }: { theme?: SoftTheme }) {
  const borderColor = theme?.cardBorder ?? FALLBACK.cardBorder
  const textColor = theme?.textSecondary ?? FALLBACK.textSecondary

  return (
    <a
      href={DEEPSPACE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Made with DeepSpace, open deep.space in a new tab"
      className="group hidden sm:inline-flex select-none items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium backdrop-blur-md transition-[color,border-color,box-shadow] duration-200 focus-visible:outline-none"
      style={{
        // Match the user pill: translucent white over the light navbar, with a
        // subtle theme-consistent border and muted readable text.
        background: 'rgba(255,255,255,0.6)',
        border: `1px solid ${borderColor}`,
        color: textColor,
      }}
    >
      <span
        aria-hidden
        className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-[#818cf8] to-[#7c3aed] text-white shadow-[0_0_10px_rgba(129,140,248,0.45)]"
      >
        {/* Curved four-point sparkle: a small DeepSpace mark */}
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
          <path d="M12 0c0 6-6 12-12 12 6 0 12 6 12 12 0-6 6-12 12-12-6 0-12-6-12-12z" />
        </svg>
      </span>
      <span className="whitespace-nowrap">
        Made with{' '}
        <span className="font-semibold" style={{ color: textColor }}>
          DeepSpace
        </span>
      </span>
    </a>
  )
}

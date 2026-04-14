/**
 * Navigation Config
 *
 * The Fluently app uses its own in-app tab navigation (Navbar component),
 * so only the home route is needed for the shell nav.
 */

import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  roles?: Role[]
}

export const nav: NavItem[] = [
  { path: '/home', label: 'Home' },
]

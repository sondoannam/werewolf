// ── Moonfall Role Card Definitions ──────────────────────────────
// Canonical source of truth for role metadata used across UI.

export type RoleName = 'Werewolf' | 'Seer' | 'Doctor' | 'Villager'

export interface RoleDetail {
  /** Display name */
  name: RoleName
  /** Path to the illustrated card asset */
  image: string
  /** Accent color used for borders, labels, etc. */
  accentColor: string
  /** Short flavor text */
  description: string
}

/**
 * Map of all game roles to their visual/display metadata.
 * Used by the landing page card fan and future role-reveal screens.
 */
export const ROLE_MAP = new Map<RoleName, RoleDetail>([
  [
    'Werewolf',
    {
      name: 'Werewolf',
      image: '/assets/cards/werewolf-2.webp',
      accentColor: '#9b1c32',
      description: 'Hunt the village under moonlight.',
    },
  ],
  [
    'Villager',
    {
      name: 'Villager',
      image: '/assets/cards/villager-2.webp',
      accentColor: '#b08d57',
      description: 'Find the wolves before dawn.',
    },
  ],
  [
    'Seer',
    {
      name: 'Seer',
      image: '/assets/cards/seer-1.webp',
      accentColor: '#6366f1',
      description: 'Reveal the truth in darkness.',
    },
  ],
  [
    'Doctor',
    {
      name: 'Doctor',
      image: '/assets/cards/doctor-1.webp',
      accentColor: '#22c55e',
      description: 'Protect the innocent from harm.',
    },
  ],
])

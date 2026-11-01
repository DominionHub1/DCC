// Activation rules for the Annual Theme (US-DIS-06, AC-05/AC-06).
// Pure functions with no Astro imports so they can be unit-tested with `node --test`.

export type ThemeStatus = 'draft' | 'published' | 'archived';
export type ThemeState = 'current' | 'upcoming' | 'past' | 'archived' | 'draft';

export interface ThemeWindow {
  id: string;
  status: ThemeStatus;
  /** First instant the theme is active (UK midnight at the start of activeFrom). */
  from: Date;
  /** First instant the theme is no longer active (UK midnight after activeUntil). */
  until: Date;
}

export function themeState(t: ThemeWindow, now: Date): ThemeState {
  if (t.status === 'draft') return 'draft';
  if (t.status === 'archived') return 'archived';
  if (now < t.from) return 'upcoming';
  if (now >= t.until) return 'past';
  return 'current';
}

/** The theme to present as current, or undefined. If windows overlap, the most recently started wins. */
export function pickCurrent<T extends ThemeWindow>(themes: T[], now: Date): T | undefined {
  return themes
    .filter((t) => themeState(t, now) === 'current')
    .sort((a, b) => b.from.getTime() - a.from.getTime())[0];
}

/** Themes that may have a public page: everything except drafts. */
export function isPublic(t: ThemeWindow): boolean {
  return t.status !== 'draft';
}

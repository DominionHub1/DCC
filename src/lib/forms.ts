import site from '../data/site.json';

export type FormName = Exclude<keyof typeof site.forms, '_comment'>;

/**
 * The Jotform address for a form, from site.json → forms. Each entry may be:
 *  - a Jotform form ID, e.g. "251234567890123" (served from form.jotform.com)
 *  - a full Jotform form link, e.g. "https://form.jotform.com/251234567890123"
 *    (use the full link for EU-hosted forms: "https://eu.jotform.com/...")
 *  - blank: the form isn't set up yet, so the page asks visitors to email or call instead
 */
export function jotformUrl(name: FormName): string {
  const value = String((site.forms as Record<string, string>)[name] ?? '').trim();
  if (/^\d{6,}$/.test(value)) return `https://form.jotform.com/${value}`;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && /(^|\.)(jotform\.com|jotform\.eu|jotform\.me|jotfor\.ms)$/.test(url.hostname)) return url.href;
  } catch { /* not a URL */ }
  return '';
}

/** The Jotform form ID at the end of a form link (used to match Jotform's resize messages). */
export function jotformId(url: string): string {
  return url.match(/(\d{6,})\/?(?:[?#]|$)/)?.[1] ?? '';
}

/** Adds prefill values (Jotform field "unique names" → values) to a form link. */
export function withPrefill(url: string, prefill: Record<string, string | undefined> = {}): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(prefill)) if (v) u.searchParams.set(k, v);
  return u.href;
}

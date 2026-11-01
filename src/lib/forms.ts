import site from '../data/site.json';

export type FormName = Exclude<keyof typeof site.forms, '_comment' | 'deliverTo'>;

/** Subject line for the email each form sends, so the inbox is easy to sort. */
const SUBJECTS: Record<string, string> = {
  contact: 'Website: new contact message',
  visit: 'Website: someone is planning a visit',
  ministry: 'Website: ministry enquiry',
  nextSteps: 'Website: next steps enquiry',
  prayer: 'Website: new prayer request (confidential)',
  support: 'Website: request for support',
  volunteer: 'Website: volunteer offer',
  newsletter: 'Website: newsletter sign-up',
};

const EMAIL = /^[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+$/;

/**
 * Where a form is delivered. Each entry in site.json → forms may be:
 *  - blank: delivered by email to `forms.deliverTo` (via FormSubmit, no account needed)
 *  - an email address: delivered by email to that address instead (e.g. the prayer team)
 *  - a URL: posted as JSON to that endpoint (Formspree, Netlify function, etc.)
 */
export function formEndpoint(name: FormName): string {
  const value = String((site.forms as Record<string, string>)[name] ?? '').trim();
  if (/^https:\/\//.test(value)) return value;
  const email = EMAIL.test(value) ? value : String(site.forms.deliverTo ?? '').trim();
  return EMAIL.test(email) ? `https://formsubmit.co/ajax/${email}` : '';
}

export function formSubject(name: FormName): string {
  return SUBJECTS[name] ?? 'Website: new form submission';
}

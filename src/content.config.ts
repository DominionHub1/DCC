import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

// Every collection supports `draft: true` — drafts are never rendered publicly (AC-DIS-05.2, GAC-08).
const draft = z.boolean().default(false);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:MM (UK time)');

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.enum(['Worship', 'Prayer', 'Fellowship', 'Outreach', 'Youth', 'Children', 'Teaching', 'Special']),
    start: localDateTime,
    end: localDateTime.optional(),
    location: z.string(),
    online: z.boolean().default(false),
    registrationUrl: z.url().optional(),
    featured: z.boolean().default(false),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    // The image is a designed flyer/poster: show it whole and never put text over it.
    poster: z.boolean().default(false),
    // Who it's for, when not everyone (e.g. "For DCC workers").
    audience: z.string().optional(),
    // Time not yet confirmed: shows "Time to be confirmed" and treats the event as all-day.
    timeTBC: z.boolean().default(false),
    // A regular activity (id in src/data/schedule.json) this event stands in for on its date.
    replaces: z.string().optional(),
    // Annual Theme this event belongs to (theme entry id, e.g. 2026-our-year-of-shining-light).
    theme: z.string().optional(),
    draft,
    // Layout preview only: shown on the local dev server with a "Sample" badge, never in a production build.
    sample: z.boolean().default(false),
  }),
});

// Regular weekly / monthly activities. `weekOfMonth: 1` = first <day> of the month only.
const schedule = defineCollection({
  loader: file('./src/data/schedule.json'),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    day: z.enum(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
    weekOfMonth: z.number().int().min(1).max(5).optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    durationMins: z.number().default(120),
    timeLabel: z.string().optional(),
    location: z.string(),
    online: z.boolean().default(false),
    link: z.string().optional(),
    replaces: z.string().optional(),
    featured: z.boolean().default(false),
    // Picture for the "This Week" card: an image path, or "theme" for the current Annual Theme artwork.
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    // The picture is a designed flyer: show it whole, never crop or overlay text.
    poster: z.boolean().default(false),
    // Month-specific pictures (e.g. the monthly Sunday banner). Overrides `image` for that month.
    monthlyImages: z.array(z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM'),
      image: z.string(),
      imageAlt: z.string(),
      poster: z.boolean().default(true),
    })).default([]),
    draft,
  }),
});

const messages = defineCollection({
  loader: file('./src/data/messages.json'),
  schema: z.object({
    title: z.string(),
    youtubeId: z.string(),
    date: z.string(),
    speaker: z.string().optional(),
    series: z.string().optional(),
    type: z.enum(['Sunday service', 'Discipleship', 'Special service', 'Midweek']).default('Sunday service'),
    // Annual Theme this message belongs to (theme entry id).
    theme: z.string().optional(),
    draft,
  }),
});

// Annual Theme (US-DIS-06). One markdown file per theme; the body is the pastor's message.
// Managed in the CMS. Dates are whole UK days; activeUntil is inclusive.
const ymd = z.union([z.string(), z.date()]).transform((v) => (typeof v === 'string' ? v : v.toISOString().slice(0, 10)))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'));
const themes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/themes' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    year: z.number().int(),
    scripture: z.string(),
    scriptureUrl: z.url().optional(),
    artwork: image(),
    artworkAlt: z.string(),
    // Short church-approved description; empty shows a clearly marked placeholder.
    description: z.string().default(''),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    activeFrom: ymd,
    activeUntil: ymd,
  }).refine((t) => t.activeUntil >= t.activeFrom, { message: 'activeUntil must be on or after activeFrom', path: ['activeUntil'] }),
});

const ministries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ministries' }),
  schema: z.object({
    name: z.string(),
    order: z.number(),
    tagline: z.string(),
    summary: z.string(),
    icon: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    meets: z.string().optional(),
    verse: z.object({ text: z.string(), ref: z.string() }).optional(),
    enquiries: z.boolean().default(true),
    draft,
  }),
});

const fours = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/fours' }),
  schema: z.object({
    name: z.string(),
    order: z.number(),
    icon: z.string(),
    tagline: z.string(),
    summary: z.string(),
    areas: z.array(z.string()),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageCredit: z.string().optional(),
    draft,
  }),
});

const programmes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/programmes' }),
  schema: z.object({
    name: z.string(),
    order: z.number(),
    icon: z.string(),
    summary: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    when: z.string().optional(),
    access: z.string().optional(),
    supportCategory: z.string(),
    volunteering: z.boolean().default(true),
    donateUrl: z.url().optional(),
    // Optional "Give towards this programme" section (shown on the programme page and the Community page).
    give: z.object({ text: z.string(), reference: z.string() }).optional(),
    // Optional video (YouTube id), shown beside the giving section. `vertical` for Shorts.
    video: z.object({ youtubeId: z.string(), title: z.string(), vertical: z.boolean().default(false) }).optional(),
    draft,
  }),
});

const gallery = defineCollection({
  loader: file('./src/data/gallery.json'),
  schema: z.object({
    src: z.string(),
    alt: z.string(),
    caption: z.string().optional(),
    album: z.string().default('Church life'),
    order: z.number().default(100),
    draft,
  }),
});

// Testimonies only render when approved AND consent is recorded (AC-CL-02.3, AC-CL-03.3).
const testimonies = defineCollection({
  loader: file('./src/data/testimonies.json'),
  schema: z.object({
    quote: z.string(),
    name: z.string(),
    photo: z.string().optional(),
    approved: z.boolean().default(false),
    consentRecorded: z.boolean().default(false),
  }),
});

const announcements = defineCollection({
  loader: file('./src/data/announcements.json'),
  schema: z.object({
    message: z.string(),
    linkText: z.string().optional(),
    link: z.string().optional(),
    starts: localDateTime.optional(),
    expires: localDateTime.optional(),
    active: z.boolean().default(true),
  }),
});

const beliefs = defineCollection({
  loader: file('./src/data/beliefs.json'),
  schema: z.object({ title: z.string(), icon: z.string(), order: z.number(), statement: z.string() }),
});

const timeline = defineCollection({
  loader: file('./src/data/timeline.json'),
  schema: z.object({
    order: z.number(),
    marker: z.string(),
    title: z.string(),
    text: z.string(),
    icon: z.string().optional(),
    image: z.string().optional(),
  }),
});

const leaders = defineCollection({
  loader: file('./src/data/leaders.json'),
  schema: z.object({
    name: z.string().default(''),
    role: z.string(),
    order: z.number(),
    photo: z.string().optional(),
    // Large black-and-white portrait for the featured Lead Pastor layout.
    featurePhoto: z.string().optional(),
    bio: z.string().optional(),
    cta: z.object({ label: z.string(), href: z.string() }).optional(),
    draft,
  }),
});

export const collections = {
  themes, events, schedule, messages, ministries, fours, programmes, gallery, testimonies, announcements, beliefs, timeline, leaders,
};

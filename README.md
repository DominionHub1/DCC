# Dominion Christian Connections — website

The new DCC website, built from scratch with [Astro](https://astro.build) against the
*DCC Website Implementation Requirements v0.1*. It is a fast static site: every page is
pre-built HTML, with small scripts for menus, galleries, video and forms.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # production build into dist/
npm run check    # type and content checks
```

## Where content lives

All content is data, separate from the design, so a CMS can be connected later without a rebuild.

| What | File(s) |
| --- | --- |
| Service time, address, contacts, socials, giving, form endpoints | `src/data/site.json` |
| Regular weekly/monthly activities (Sunday service, Thanksgiving, Discipleship, Breakfast) | `src/data/schedule.json` |
| One-off events | `src/content/events/*.md` (copy `_example-night-of-prayer.md`) |
| Sermons / messages (YouTube) | `src/data/messages.json` |
| Ministries (Men, Women, Children, Youth, Community) | `src/content/ministries/*.md` |
| The Four F's (Faith, Family, Finance, Future) | `src/content/fours/*.md` |
| Community Ministry programmes (Breakfast Morning, Food, Career, Pastoral), shown on `/ministries/community` | `src/content/programmes/*.md` |
| Gallery / Life at DCC | `src/data/gallery.json` + images in `public/images/` |
| Testimonies | `src/data/testimonies.json` |
| Announcement banner | `src/data/announcements.json` |
| Leadership | `src/data/leaders.json` |
| Beliefs, story timeline | `src/data/beliefs.json`, `src/data/timeline.json` |

### Messages from YouTube (automatic)

`npm run sync:messages` checks DCC's YouTube channel and adds any new services to `src/data/messages.json` (title, series, UK date, type). It never changes existing entries, skips duplicates and private videos, and waits until a live stream has finished.
Once the site is on GitHub, `.github/workflows/sync-messages.yml` runs it every **Sunday at 2pm UK time** and commits any new services, which triggers the host to republish the site. It can also be run by hand from GitHub's Actions tab. Speaker names aren't in the YouTube titles, so add `"speaker"` to an entry if you want it shown.

### Annual Theme (US-DIS-06)

Each theme is one file in `src/content/themes/` (artwork in `src/content/themes/images/`), editable in the CMS at `/admin` → Annual Themes.

- **status** `draft` (no page), `published` (live between `activeFrom` and `activeUntil`, UK dates, inclusive) or `archived` (keeps its page, never shown as current).
- The homepage section (after the hero) and `/theme` always show the current theme. Every non-draft theme keeps a permanent page at `/theme/<entry>`.
- Prepare next year's theme in advance: publish it with `activeFrom: 2027-01-01` and it takes over automatically on that date (with the daily rebuild).
- If two published themes overlap, the one that started most recently is shown.
- Empty `description` or empty body (pastor's message) shows a clearly marked **Placeholder**. Never fill these with unapproved text.
- Sermons/events appear on the theme page when their `theme` field is the theme's entry id (e.g. `2026-our-year-of-shining-light`).
- Activation rules are unit-tested: `npm test`.

### Content manager (Decap CMS)

`/admin` uses Decap CMS. Edits are saved as Git commits with a Draft → In review → Ready workflow, and the host rebuilds the site.
Locally: run `npx decap-server` and `npm run dev`, then open `http://localhost:4321/admin/index.html`.
Production needs the site in a Git repository plus an auth backend (Netlify Identity + Git Gateway, or GitHub OAuth); see "Going live".

### Seasonal events page (`/winter-events`)

Shows every one-off event between the dates in `src/data/season.json` (currently 1 October to 31 December 2026), with month filters. Past events drop off by themselves. To add an event, create a file in `src/content/events/` like this:

```markdown
---
title: Christmas Carol Service
summary: One or two sentences shown on the event card.
category: Special            # Worship, Prayer, Fellowship, Outreach, Youth, Children, Teaching or Special
start: 2026-12-20T10:00      # UK time
end: 2026-12-20T13:00
location: 36–38 Park Road, Peterborough
image: /images/your-photo.jpg   # optional, put the photo in public/images/
# registrationUrl: https://…    # optional, adds a Register button
---
Optional longer description for the event's own page.
```

The `_sample-*.md` files are preview-only examples: they show on `npm run dev` with a "Sample" badge and never appear on the live site. Delete them once the real events are in.

### Rules built in (from the requirements)

- `draft: true` on anything keeps it off the public site.
- Events disappear from "upcoming" once they finish, even between rebuilds.
- "This Week at DCC" shows the next 7 days; on the first Sunday of the month the Thanksgiving Service replaces the normal service automatically.
- Testimonies appear only when **both** `approved` and `consentRecorded` are `true`. With none, the section is hidden.
- Social icons render only for accounts that are filled in. No placeholder links.
- Announcements show only while `active` and between `starts` and `expires`.
- Forms never claim success unless the form service confirms it.

## Going live: checklist

1. **Hosting.** Deploy to Netlify, Cloudflare Pages or Vercel (all free for a site this size). Build command `npm run build`, output folder `dist`. Point `dominionconnections.org` at it. HTTPS is automatic.
2. **Daily rebuild.** Add a scheduled build hook (once a day, early morning) so dates, "This Week" and the latest message stay current.
3. **Forms.** Create one form endpoint per team (for example [Formspree](https://formspree.io), free tier) and paste the URLs into `site.json → forms`:
   `visit` → Welcome Team, `ministry` / `nextSteps` → ministry leads, `prayer` → prayer team **only**,
   `support` → pastoral/community team, `volunteer` → outreach, `newsletter` → your mailing list.
   Until filled in, forms show an honest "email us instead" message.
4. **CMS.** For staff editing without code (spec module 08), connect a headless CMS such as Decap CMS (free, Git-based) or Sanity (roles, drafts, scheduling) to the files above.

## To confirm before launch (TBC)

- [x] Sunday service time: **10:05 AM** (confirmed).
- [ ] Venue address **36–38 Park Road, Peterborough PE1 2TG** (taken from a public directory listing).
- [ ] Charity number **1145233** (from the Charity Commission register).
- [ ] Parking and accessibility wording (`site.json → venue`).
- [x] Breakfast Morning: Saturdays 8:00–10:00 AM (from the "Domi Cafe" video). All other activities run about 2 hours.
- [ ] Facebook page URL (left blank, so no icon shows).
- [ ] Pastor and leadership names, photos and bios (`leaders.json`).
- [ ] Ministry meeting times and contacts; safeguarding-approved wording for Children's Ministry.
- [ ] Speaker names for messages (`messages.json`); the date of the October midweek message.
- [ ] Privacy, Safeguarding and Cookies pages need trustee approval (they carry a "draft" notice).
- [ ] More approved photos, especially for Women, Youth and Children (only consented images of children).

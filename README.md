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
| Service time, address, contacts, socials, giving, Jotform form IDs | `src/data/site.json` |
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
| Live chat / AI assistant (Brevo) | `src/data/site.json → chat` (see "Live chat and AI assistant") |
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
- Forms are Jotform forms; a form that isn't connected yet shows "email or call us" instead.

## Live chat and AI assistant (Brevo Conversations)

The chat button in the corner of every page is [Brevo Conversations](https://www.brevo.com/products/conversations/). Visitors' messages arrive in your Brevo inbox (and the Brevo mobile app), where the team can reply live, and Brevo's chatbot/AI features can answer automatically. Everything about how it looks and behaves (colours, greeting, opening hours, chatbot, AI answers, who receives chats) is set in your Brevo account, not in this code.

- **Turn it on or off:** `src/data/site.json → chat.brevoConversationsId` holds the ID from Brevo's installation code (`BrevoConversationsID`). Clear it to remove the chat from the site.
- **Teach the AI about DCC:** every build publishes all the church's key information on one page at `/assistant-knowledge.txt` (services, next 60 days of events, ministries, programmes, sermons, giving, beliefs, leadership, contacts), always up to date. Give that link to Brevo's AI/chatbot knowledge settings, or copy and paste its text.
- **Recommended Brevo settings:** a greeting that mentions service times; an "outside opening hours" message giving the church email and phone; and a rule that anyone in danger is told to call 999 (Samaritans 116 123).

## Going live: checklist

1. **Hosting (GitHub Pages, set up).** `.github/workflows/deploy.yml` builds, tests and publishes the site on every push to `main`, after the Sunday YouTube sync, and once a day (so dates and "This Week" stay current). One-time step: in the repo go to **Settings → Pages → Source** and choose **GitHub Actions**. The site is then live at `https://dominionhub1.github.io/DCC/` (`scripts/apply-base-path.mjs` adjusts links for that `/DCC` sub-folder). To use `dominionconnections.org` instead, enter it under Settings → Pages → Custom domain and point the domain's DNS at GitHub Pages; links then need no adjustment and the script does nothing.
   Alternatively, deploy to Netlify, Cloudflare Pages or Vercel (all free for a site this size). Build command `npm run build`, output folder `dist`. Point `dominionconnections.org` at it. HTTPS is automatic.
2. **Daily rebuild.** Add a scheduled build hook (once a day, early morning) so dates, "This Week" and the latest message stay current.
3. **Forms (Jotform).** Every form on the site is a [Jotform](https://www.jotform.com) form embedded in the page. Jotform stores each submission, emails it to whoever you choose, and shows its own thank-you message.
   - **Connect a form:** build it in Jotform (fields below), then copy its ID from the form's link (`https://form.jotform.com/<ID>`) into `src/data/site.json → forms` next to the right name, and push. Use the full link instead of the ID for EU-hosted forms. Until a form is connected, its page shows "email or call us" buttons instead. Nothing is ever silently lost.
   - **Who receives it:** set this in Jotform → *Settings → Emails → Notification email*. For prayer requests, send notifications to the prayer team only (the page promises that only the prayer team sees them).
   - **Look:** pick colours and fonts in Jotform's *Form Designer* to match the site (navy `#0b1630`, gold `#f5a623`).
   - **Free plan:** Jotform's free plan allows 5 forms and 100 submissions a month. To stay within it, one general enquiry form can be used for several entries (paste the same ID).
   - **Pre-filled answers:** some links choose an option for the visitor. For this to work, the field's *unique name* (Jotform → field → *Properties → Advanced → Field details*) must match the name in brackets below.

   | site.json name | Where it appears | Suggested fields |
   | --- | --- | --- |
   | `contact` | Contact Us | Name\*, Email\*, Phone, What is it about?\* (General enquiry / Visiting DCC / Events / Ministries / Giving / Something else), Message\* |
   | `visit` | New Here → Let us know you're coming | Name\*, Email\*, Phone, Date of visit, Who's coming? (Just me / Me and a friend / My family (with children) / A group), Anything we can help with? |
   | `nextSteps` | New Here → Take your next step | I'm interested in\* (`step`; options exactly: Membership, Serve Class, Serving, Connect group), Name\*, Email\*, Phone, Anything you'd like us to know? |
   | `ministry` | Each ministry page → Get connected | Ministry (`ministry`, filled in automatically, can be hidden), Name\*, Email\*, Phone, Message\* |
   | `volunteer` | Community Ministry → Volunteer with us | Where would you like to help?\* (`area`; options exactly: Breakfast Morning, Food Support, Career & Development, Anywhere I am needed), Name\*, Email\*, Phone, Anything else? |
   | `prayer` | Community Ministry → Prayer request | Keep my request anonymous (checkbox; use Jotform *Conditions* to hide the name when ticked), Name, Prayer request\*, I'd like someone to contact me (checkbox), Email, Phone |
   | `newsletter` | Footer "Stay Connected" | Email\* (`email`). Visitors type their email in the footer and the form opens in a new tab with it filled in. The footer box is hidden until this is connected. |
   | `support` | Not used on any page yet | |

4. **CMS.** For staff editing without code (spec module 08), connect a headless CMS such as Decap CMS (free, Git-based) or Sanity (roles, drafts, scheduling) to the files above.

## To confirm before launch (TBC)

- [x] Sunday service time: **10:05 AM** (confirmed).
- [ ] Venue address **36–38 Park Road, Peterborough PE1 2TG** (taken from a public directory listing).
- [ ] Charity number **1145233** (from the Charity Commission register).
- [ ] Parking and accessibility wording (`site.json → venue`).
- [x] Breakfast Morning: Saturdays 8:00–10:00 AM (from the "Domi Cafe" video). All other activities run about 2 hours.
- [ ] Facebook page URL (left blank, so no icon shows).
- [ ] Pastor and leadership names, photos and bios (`leaders.json`). Leaders without a name are hidden on the live site (shown on `npm run dev` only).
- [ ] Ministry meeting times and contacts; safeguarding-approved wording for Children's Ministry.
- [ ] Speaker names for messages (`messages.json`); the date of the October midweek message.
- [ ] Privacy, Safeguarding and Cookies pages need trustee approval (they carry a "draft" notice).
- [ ] Prayer request notifications in Jotform go to the prayer team only (the prayer page promises only the prayer team sees them).
- [ ] Build the Jotform forms and paste their IDs into `site.json → forms` (see "Forms" above).
- [ ] More approved photos, especially for Women, Youth and Children (only consented images of children).

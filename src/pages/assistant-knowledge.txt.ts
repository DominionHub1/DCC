// All the church's key information on one plain-text page, built from the same data as the website.
// Published at /assistant-knowledge.txt on every build (including the daily rebuild), so it is always
// current. Use it to teach a chatbot (e.g. Brevo's AI assistant) about the church: give it this page's
// link, or copy and paste its text. Links are written as full addresses on the church's domain (site.json → url).
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import site from '../data/site.json';
import about from '../data/about.json';
import beliefs from '../data/beliefs.json';
import timeline from '../data/timeline.json';
import leaders from '../data/leaders.json';
import safeguarding from '../data/safeguarding.json';
import { getUpcoming, fmt, ukTime } from '../lib/schedule';
import { getCurrentTheme } from '../lib/themes';
import { jotformUrl } from '../lib/forms';

const clean = (s: string | undefined) => (s ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
const line = (label: string, value: unknown) => (value ? `${label}: ${value}` : '');
const lines = (...xs: string[]) => xs.filter(Boolean).join('\n');

export const GET: APIRoute = async () => {
  const now = new Date();
  const out: string[] = [];
  const section = (title: string, body: string) => body.trim() && out.push(`## ${title}\n\n${body.trim()}`);

  // Church basics
  const v = site.venue;
  section('About the church', lines(
    `${site.name} (${site.shortName}) is a church in Peterborough, UK, part of The Redeemed Christian Church of God (RCCG).`,
    line('Registered name', site.legalName),
    line('Charity number', site.charityNumber),
    line('Founded', site.founded),
    line('Tagline', site.tagline),
    line('Website', site.url),
  ));
  section('Sunday service and location', lines(
    `${site.service.name}: every ${site.service.day} at ${site.service.time}. ${site.service.summary}`,
    `Address: ${[v.name, v.street, v.city, v.postcode].join(', ')}`,
    line('Google Maps', v.mapsUrl),
    line('Parking', v.parking || 'Not published on the website yet — suggest contacting the church.'),
    line('Accessibility', v.accessibility || 'Not published on the website yet — suggest contacting the church.'),
    `Watch online: services stream live on YouTube (${site.social.youtubeLive}). Recent sermons: /messages`,
    'Plan a first visit: /new-here (what to expect, and a form to let the Welcome Team know you are coming).',
  ));
  section('Contact', lines(
    line('Email', site.contact.email),
    line('Phone', site.contact.phoneDisplay),
    'Contact page with a message form and map: /contact',
    'Social media: ' + Object.entries(site.social).filter(([k, url]) => url && k !== 'youtubeLive').map(([k, url]) => `${k} ${url}`).join(', '),
  ));

  // What's on
  const upcoming = await getUpcoming({ from: now, days: 60 });
  section('What\'s on in the next 60 days (UK time)', upcoming.map((o) => {
    const when = o.hasTime ? `${fmt.date(o.start)}, ${fmt.time(o.start)}–${fmt.time(o.end)}` : `${fmt.date(o.start)} (${o.timeLabel ?? 'all day'})`;
    return lines(
      `- ${o.title} — ${when}`,
      `  ${o.summary}`,
      `  Where: ${o.location}${o.online && !/online/i.test(o.location) ? ' (also online)' : ''}. More: ${o.href}`,
      o.registrationUrl ? `  Register: ${o.registrationUrl}` : '',
      o.audience ? `  For: ${o.audience}` : '',
    );
  }).join('\n') || 'Nothing listed. See /events.');
  const events = (await getCollection('events', ({ data }) => !data.draft && !data.sample))
    .filter((e) => ukTime(e.data.end ?? e.data.start) > now)
    .sort((a, b) => a.data.start.localeCompare(b.data.start));
  section('Special event details', events.map((e) => lines(
    `### ${e.data.title} (${e.data.timeTBC ? `${e.data.start.slice(0, 10)}, time to be confirmed` : e.data.start.replace('T', ' ')}) — /events/${e.id}`,
    e.data.summary,
    clean(e.body),
  )).join('\n\n'));

  // Theme
  const theme = await getCurrentTheme(now);
  if (theme) {
    const t = theme.entry.data;
    section(`This year's theme: ${t.title}`, lines(
      line('Scripture', t.scripture),
      clean(t.description),
      clean(theme.entry.body),
      `Page: ${theme.href}`,
    ));
  }

  // Ministries and community
  const ministries = (await getCollection('ministries', ({ data }) => !data.draft)).sort((a, b) => a.data.order - b.data.order);
  section('Ministries (overview page: /ministries)', ministries.map((m) => lines(
    `### ${m.data.name} Ministry — /ministries/${m.id === 'community' ? 'community' : m.id}`,
    m.data.tagline, m.data.summary, line('Meets', m.data.meets), clean(m.body),
    m.data.enquiries ? `There is a "Get connected" form on the page.` : '',
  )).join('\n\n'));
  const fours = (await getCollection('fours', ({ data }) => !data.draft)).sort((a, b) => a.data.order - b.data.order);
  section('The Four F\'s (Faith, Family, Finance, Future) — /ministries#four-fs', fours.map((f) => lines(
    `### ${f.data.name}`, f.data.tagline, f.data.summary, line('Areas', f.data.areas.join(', ')), clean(f.body),
  )).join('\n\n'));
  const programmes = (await getCollection('programmes', ({ data }) => !data.draft)).sort((a, b) => a.data.order - b.data.order);
  section('Community Ministry programmes (/ministries/community)', programmes.map((p) => lines(
    `### ${p.data.name} — /ministries/community/${p.id}`,
    p.data.summary, line('When', p.data.when), line('How to access it', p.data.access), clean(p.body),
    p.data.volunteering ? `Volunteer: /ministries/community?help=${encodeURIComponent(p.data.name)}#help` : '',
  )).join('\n\n'));
  section('Prayer and support', lines(
    'Prayer requests: /ministries/community/prayer. Requests can be anonymous and are seen only by the prayer team.',
    'Practical help (food support, pastoral care and more): /ministries/community',
    'In an emergency or if someone is in immediate danger, call 999. Safeguarding information: /safeguarding',
  ));

  // Messages
  const messages = (await getCollection('messages')).sort((a, b) => b.data.date.localeCompare(a.data.date)).slice(0, 12);
  section('Recent messages / sermons (all: /messages)', messages.map((m) =>
    `- ${m.data.date}: ${m.data.title}${m.data.series ? ` (${m.data.series})` : ''}${m.data.speaker ? `, ${m.data.speaker}` : ''} [${m.data.type}] https://www.youtube.com/watch?v=${m.data.youtubeId}`,
  ).join('\n'));

  // Giving
  const b = site.giving.bank;
  section('Giving (/give)', lines(
    'Give online by card through Stripe:',
    ...site.giving.options.map((o) => `- ${o.label}: ${o.description} ${o.url}`),
    `Bank transfer: ${b.bankName}, account name ${b.accountName}, account number ${b.accountNumber}, sort code ${b.sortCode}.`,
  ));

  // About
  section('Our story (/about)', lines(
    about.heroLead,
    ...timeline.map((t) => `- ${t.marker}: ${t.title}. ${t.text}`),
    about.todayIntro,
  ));
  section('What we believe (/about)', beliefs.map((x) => `- ${x.title}: ${x.statement}`).join('\n'));
  section('Leadership (/about)', leaders.filter((l) => l.name).map((l) => `- ${l.name}, ${l.role}. ${l.bio ?? ''}`).join('\n'));
  section('Safeguarding contacts (/safeguarding)', safeguarding.team
    .map((t) => `- ${t.role}: ${t.name || 'to be confirmed'}${t.email ? `, ${t.email}` : ''}${t.phone ? `, ${t.phone}` : ''}`).join('\n'));

  // Site map
  const formPages: [string, Parameters<typeof jotformUrl>[0], string][] = [
    ['/contact', 'contact', 'contact form'], ['/new-here#tell-us', 'visit', 'plan-your-visit form'],
    ['/new-here#next-steps', 'nextSteps', 'next steps form (membership, Serve Class, joining a team, connect groups)'],
    ['/ministries/community#help', 'volunteer', 'volunteer form'], ['/ministries/community/prayer', 'prayer', 'prayer request form'],
  ];
  section('Website pages', lines(
    '- Home page: /', '- /new-here New here: what to expect, plan your visit, next steps', '- /about Our story, beliefs, leadership',
    '- /ministries Ministries and the Four F\'s', '- /ministries/community Community Ministry, programmes, volunteering',
    '- /messages Sermons and messages', '- /events Upcoming events', '- /life-at-dcc Photos of church life',
    '- /give Giving', '- /contact Contact and map', '- /theme This year\'s theme',
    '- /safeguarding, /privacy, /cookies Policies',
    'Online forms: ' + formPages.map(([path, name, label]) => `${label} at ${path}${jotformUrl(name) ? '' : ' (not switched on yet — email or phone instead)'}`).join('; ') + '.',
  ));

  const text = `# ${site.name} — website information\nGenerated ${fmt.date(now)}.\n\n${out.join('\n\n')}\n`;
  // Site paths (/events, /new-here#plan-your-visit) become full links, so they work wherever the text is used.
  const body = text.replace(/(^|[\s(])\/(?=[a-z#?]|$)/gm, `$1${site.url.replace(/\/+$/, '')}/`);
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

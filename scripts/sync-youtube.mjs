// Adds new services from DCC's YouTube channel to src/data/messages.json.
// Run: npm run sync:messages   (scheduled every Sunday at 2pm UK time — see .github/workflows/sync-messages.yml)
// Safe to run any time: existing entries are never changed, only new videos are added.
import { readFile, writeFile } from 'node:fs/promises';

const CHANNEL = 'https://www.youtube.com/@dominionchristianconnections';
const FILE = new URL('../src/data/messages.json', import.meta.url);
const THEME = { from: '2026-01-01', to: '2026-12-31', id: '2026-our-year-of-shining-light' };
const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en', Cookie: 'CONSENT=YES+1; SOCS=CAI' };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const get = async (url) => {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
  .replace(/\b(Of|By|The|And|In|Over|To|A)\b/g, (w, _x, i) => (i === 0 ? w : w.toLowerCase()))
  .replace(/\bDcc\b/g, 'DCC').replace(/\bRccg\b/g, 'RCCG').replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_m, n, s) => n + s.toLowerCase())
  .replace(/^./, (c) => c.toUpperCase());

// "18TH OCTOBER, 2026" -> 2026-10-18
function dateFromTitle(t) {
  const m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+),?\s+(\d{4})/i);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2].toLowerCase());
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function classify(raw, date) {
  const t = raw.toUpperCase();
  const isSunday = new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
  if (/DISCIPLESHIP CLASS/.test(t)) return 'Discipleship';
  if (/MIDWEEK|MID - WEEK|MID-WEEK|DISCIPLESHIP/.test(t) || !isSunday) return 'Midweek';
  if (/THANKSGIVING|COMMISSIONING|CORONATION|SPECIAL|ANNIVERSARY|CAROL|CHRISTMAS|CROSS ?OVER/.test(t)) return 'Special service';
  return 'Sunday service';
}

// Split "SERVICE NAME | SERMON TITLE | DATE" into a readable title and series.
function describe(raw) {
  const parts = raw.replace(/–/g, '|').split('|').map((p) => p.trim()).filter(Boolean)
    .filter((p) => !dateFromTitle(p) && !/^\d+(st|nd|rd|th)? service$/i.test(p) && !/^\d{4}$/.test(p));
  const serviceWords = /^(dcc )?(sunday )?(celebration|thanksgiving|commissioning|special thanksgiving|online midweek|online discipleship|discipleship class|midweek)( service| class)?$/i;
  const service = parts.find((p) => serviceWords.test(p) || /service|class/i.test(p));
  const rest = parts.filter((p) => p !== service);
  const title = rest[0] ?? service ?? raw;
  const serviceNo = raw.match(/(\d)(st|nd|rd|th) service/i);
  return {
    title: titleCase(title) + (serviceNo ? ` (${serviceNo[1]}${serviceNo[2].toLowerCase()} Service)` : ''),
    series: service && rest.length ? titleCase(service.replace(/^dcc /i, '')) : rest[1] ? titleCase(rest[1]) : undefined,
  };
}

const list = JSON.parse(await readFile(FILE, 'utf8'));
const known = new Set(list.map((m) => m.youtubeId));
const ids = [];
for (const tab of ['streams', 'videos']) {
  const html = await get(`${CHANNEL}/${tab}`);
  for (const m of html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)) if (!ids.includes(m[1])) ids.push(m[1]);
}

const added = [];
for (const id of ids.slice(0, 15)) {
  if (known.has(id)) continue;
  let info;
  try { info = JSON.parse(await get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)); }
  catch { continue; } // private or removed
  if (!/Dominion/i.test(info.author_name)) continue; // only DCC's own uploads
  const page = await get(`https://www.youtube.com/watch?v=${id}`);
  if (/"isLiveNow":true|"isUpcoming":true/.test(page)) continue; // still live or not started: next run will pick it up
  // Prefer the live stream's start time, converted to the UK date (YouTube reports US Pacific time).
  const stamp = page.match(/"startTimestamp":"([^"]+)"/)?.[1] ?? page.match(/"(?:publishDate|uploadDate)":"([^"]+)"/)?.[1];
  const ukDate = stamp ? new Date(stamp).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }) : undefined;
  const date = dateFromTitle(info.title) ?? ukDate;
  if (!date) continue;
  if (date < '2026-01-01') continue; // ignore old archive uploads
  const { title, series } = describe(info.title);
  // The channel sometimes has the same service uploaded twice: keep the first.
  if (list.some((m) => m.date === date && m.title === title)) continue;
  const entry = { id, youtubeId: id, title, ...(series ? { series } : {}), date, type: classify(info.title, date) };
  if (entry.type !== 'Midweek' && entry.type !== 'Discipleship' && date >= THEME.from && date <= THEME.to) entry.theme = THEME.id;
  list.push(entry); added.push(entry);
}

if (!added.length) { console.log('Messages are up to date.'); process.exit(0); }
list.sort((a, b) => b.date.localeCompare(a.date));
await writeFile(FILE, '[\n' + list.map((m) => '  ' + JSON.stringify(m)).join(',\n') + '\n]\n');
for (const a of added) console.log(`Added: ${a.date}  ${a.type.padEnd(15)} ${a.title}${a.series ? ` · ${a.series}` : ''}`);

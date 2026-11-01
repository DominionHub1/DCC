// Progressive enhancements. Every page works without JavaScript; this layers on behaviour.

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

/* ---------- Header ---------- */
const header = $('[data-header]');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const toggle = $<HTMLButtonElement>('[data-nav-toggle]');
const mobileNav = $('[data-mobile-nav]');
function setNav(open: boolean) {
  if (!toggle || !mobileNav) return;
  toggle.setAttribute('aria-expanded', String(open));
  mobileNav.classList.toggle('is-open', open);
  document.body.classList.toggle('nav-open', open);
  $('[data-icon-open]', toggle)!.hidden = open;
  $('[data-icon-close]', toggle)!.hidden = !open;
}
toggle?.addEventListener('click', () => setNav(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

/* ---------- Time-based content ----------
   Pages are built ahead of time; these checks keep them correct between rebuilds.
   [data-expires]   → hidden once that instant passes (events, announcements).
   [data-start]     → hidden if it starts beyond a list's data-window-days.
   [data-list]      → shows at most data-limit visible items, or its [data-empty] message. */
const now = Date.now();
$$('[data-expires]').forEach((el) => {
  if (Date.parse(el.dataset.expires!) <= now) el.classList.add('is-past');
});
// Feature groups: show the first candidate that hasn't finished; leave that gathering out of the list beside it.
$$('[data-feature-group]').forEach((group) => {
  const cards = $$('[data-feature]', group);
  const active = cards.find((c) => !c.classList.contains('is-past'));
  cards.forEach((c) => { c.hidden = c !== active; });
  group.hidden = !active;
  const section = group.closest('section') ?? document;
  $$('[data-item][data-key]', section).forEach((row) => {
    if (active && row.dataset.key === active.dataset.key) row.dataset.skip = '';
    else delete row.dataset.skip;
  });
});
$$('[data-list]').forEach((list) => {
  const windowDays = Number(list.dataset.windowDays || 0);
  const limit = Number(list.dataset.limit || 0);
  const items = $$('[data-item]', list);
  let shown = 0;
  items.forEach((item) => {
    const tooFar = windowDays && item.dataset.start && Date.parse(item.dataset.start) > now + windowDays * 864e5;
    const hide = item.classList.contains('is-past') || 'skip' in item.dataset || tooFar || (limit && shown >= limit);
    item.hidden = !!hide;
    if (!hide) shown++;
  });
  const empty = $('[data-empty]', list.parentElement!);
  if (empty) empty.hidden = shown > 0;
});

/* ---------- Reveal on scroll ---------- */
// A plain position check on scroll — content must never stay hidden if an observer fails to fire.
let pending = $$('.reveal');
let ticking = false;
const reveal = () => {
  ticking = false;
  const limit = window.innerHeight * 0.95;
  pending = pending.filter((el) => {
    if (el.getBoundingClientRect().top < limit) { el.classList.add('is-visible'); return false; }
    return true;
  });
  if (!pending.length) window.removeEventListener('scroll', onRevealScroll);
};
const onRevealScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(reveal); } };
window.addEventListener('scroll', onRevealScroll, { passive: true });
window.addEventListener('resize', onRevealScroll, { passive: true });
reveal();

/* ---------- Broken YouTube thumbnails ----------
   If a thumbnail can't load (removed video, blocked network), hide it so the navy tile and play icon show instead. */
$$<HTMLImageElement>('img[src*="i.ytimg.com"]').forEach((img) => {
  const fail = () => img.classList.add('is-broken');
  if (img.complete && img.naturalWidth === 0) fail();
  else img.addEventListener('error', fail, { once: true });
});

/* ---------- Copy to clipboard ---------- */
$$<HTMLButtonElement>('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(btn.dataset.copy!);
    btn.classList.add('is-done');
    btn.setAttribute('aria-label', 'Copied');
    setTimeout(() => { btn.classList.remove('is-done'); btn.setAttribute('aria-label', btn.dataset.label!); }, 2000);
  } catch { /* clipboard unavailable — value is still visible to copy manually */ }
}));

/* ---------- YouTube: load the player only when asked (faster pages, no tracking until play) ---------- */
$$<HTMLButtonElement>('[data-youtube]').forEach((btn) => btn.addEventListener('click', () => {
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.youtube}?autoplay=1&rel=0`;
  iframe.title = btn.dataset.title || 'DCC message video';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  const wrap = Object.assign(document.createElement('div'), { className: 'vertical' in btn.dataset ? 'yt-embed yt-embed--vertical' : 'yt-embed' });
  wrap.appendChild(iframe);
  btn.replaceWith(wrap);
}));

/* ---------- Lightbox ---------- */
const triggers = $$<HTMLButtonElement>('[data-lightbox]');
if (triggers.length) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML = `
    <button class="lightbox__btn lightbox__close" aria-label="Close">✕</button>
    <button class="lightbox__btn lightbox__prev" aria-label="Previous photo">‹</button>
    <figure><img alt="" /><figcaption></figcaption></figure>
    <button class="lightbox__btn lightbox__next" aria-label="Next photo">›</button>`;
  document.body.appendChild(box);
  const img = $<HTMLImageElement>('img', box)!;
  const cap = $('figcaption', box)!;
  let index = 0;
  let opener: HTMLElement | null = null;
  const show = (i: number) => {
    index = (i + triggers.length) % triggers.length;
    const t = triggers[index];
    img.src = t.dataset.lightbox!;
    img.alt = t.dataset.alt || '';
    cap.textContent = t.dataset.caption || '';
  };
  const close = () => { box.classList.remove('is-open'); document.body.style.overflow = ''; opener?.focus(); };
  triggers.forEach((t, i) => t.addEventListener('click', () => {
    opener = t; show(i); box.classList.add('is-open'); document.body.style.overflow = 'hidden';
    $<HTMLButtonElement>('.lightbox__close', box)!.focus();
  }));
  $('.lightbox__close', box)!.addEventListener('click', close);
  $('.lightbox__prev', box)!.addEventListener('click', () => show(index - 1));
  $('.lightbox__next', box)!.addEventListener('click', () => show(index + 1));
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
}

/* ---------- Add to calendar (.ics) ---------- */
$$<HTMLButtonElement>('[data-ics]').forEach((btn) => btn.addEventListener('click', () => {
  const d = btn.dataset;
  const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s = '') => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dominion Christian Connections//Website//EN', 'BEGIN:VEVENT',
    `UID:${d.uid}@dominionconnections.org`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(d.start!)}`, `DTEND:${stamp(d.end!)}`,
    `SUMMARY:${esc(d.title)}`, `LOCATION:${esc(d.location)}`, `DESCRIPTION:${esc(d.description)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })),
    download: `${(d.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}));

/* ---------- Forms ----------
   Each form posts JSON to its own endpoint (configured in site.json) so it reaches the right team.
   Success is only shown after the endpoint confirms (GAC-06/07). */
const FALLBACK = 'Sorry — online submissions aren\'t switched on yet. Please email admin@dominionhub.org.uk or call +44 7884 974536 and we\'ll be glad to help.';

function fieldError(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, message: string) {
  const err = document.getElementById(`${input.id}-error`);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (err) { err.textContent = message; err.classList.toggle('is-visible', !!message); }
}

function validate(form: HTMLFormElement): boolean {
  let firstBad: HTMLElement | null = null;
  $$<HTMLInputElement>('input, textarea, select', form).forEach((input) => {
    if (input.type === 'hidden' || input.classList.contains('honeypot') || input.closest('[hidden]')) { fieldError(input, ''); return; }
    let msg = '';
    if (input.required && !input.value.trim() && input.type !== 'checkbox') msg = `Please enter ${input.dataset.name || 'this field'}.`;
    else if (input.type === 'checkbox' && input.required && !input.checked) msg = input.dataset.msg || 'Please tick this box to continue.';
    else if (input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) msg = 'Please enter a valid email address, like name@example.com.';
    fieldError(input, msg);
    if (msg && !firstBad) firstBad = input;
  });
  // Follow-up requested → need at least one way to reach them (AC-CARE-01.3)
  const follow = $<HTMLInputElement>('[name="followUp"]', form);
  if (follow && (follow.type === 'hidden' || follow.checked)) {
    const email = $<HTMLInputElement>('[name="email"]', form);
    const phone = $<HTMLInputElement>('[name="phone"]', form);
    if (email && phone && !email.value.trim() && !phone.value.trim()) {
      fieldError(email, 'To follow up, we need an email address or phone number.');
      firstBad ??= email;
    }
  }
  (firstBad as HTMLElement | null)?.focus();
  return !firstBad;
}

function setStatus(form: HTMLFormElement, kind: 'success' | 'error' | '', message: string, focus = true) {
  const el = $('[data-form-status]', form) ?? $('[data-form-status]', form.parentElement!);
  if (!el) return;
  el.textContent = message;
  el.className = el.className.replace(/\bform-status--\w+/g, '').trim();
  if (kind && el.classList.contains('form-status')) el.classList.add('is-visible', `form-status--${kind}`);
  if (focus) el.focus?.();
}

$$<HTMLFormElement>('form[data-form]').forEach((form) => {
  // Anonymous prayer: hide identity fields and make them optional (AC-CARE-01.2)
  const anon = $<HTMLInputElement>('[name="anonymous"]', form);
  const identity = $('[data-identity]', form);
  anon?.addEventListener('change', () => { if (identity) identity.hidden = anon.checked; });

  // Category pre-selection from links like ?category=Food%20Support or ?ministry=Youth
  const params = new URLSearchParams(location.search);
  $$<HTMLSelectElement>('select[data-preselect]', form).forEach((sel) => {
    const v = params.get(sel.dataset.preselect!);
    if (v && [...sel.options].some((o) => o.value === v)) sel.value = v;
  });

  $$<HTMLInputElement>('input, textarea, select', form).forEach((i) => i.addEventListener('input', () => {
    if (i.getAttribute('aria-invalid') === 'true') fieldError(i, '');
  }));

  let sending = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    if (!validate(form)) { setStatus(form, 'error', 'Please check the highlighted fields.', false); return; }
    const endpoint = form.dataset.endpoint;
    const raw = new FormData(form);
    if (String(raw.get('_gotcha') ?? '')) return; // bot
    raw.delete('_gotcha');
    if (anon?.checked) raw.delete('name');
    if (!endpoint) { setStatus(form, 'error', FALLBACK); return; }

    const viaEmail = endpoint.startsWith('https://formsubmit.co/');
    const body: Record<string, string> = {};
    raw.forEach((value, key) => {
      const el = form.elements.namedItem(key) as HTMLInputElement | null;
      if (el && el.closest?.('[hidden]')) return; // fields hidden by the form (e.g. anonymous prayer) are not sent
      let v = String(value).trim();
      if (el?.type === 'checkbox') v = 'Yes';
      if (!v) return;
      // Email delivery: use the visible label ("Your name") so the email reads clearly.
      const label = !viaEmail ? '' : el?.type === 'checkbox'
        ? el.closest('label')?.textContent?.trim()
        : el?.id ? document.querySelector(`label[for="${el.id}"]`)?.firstChild?.textContent?.trim() : '';
      body[label || key] = v;
    });
    const email = String(raw.get('email') ?? '').trim();
    if (viaEmail) {
      Object.assign(body, { _subject: form.dataset.subject || 'Website form', _template: 'table', _captcha: 'false', 'Sent from': location.href });
      if (email) body._replyto = email;
    } else {
      body._form = form.dataset.form ?? '';
    }

    const btn = $<HTMLButtonElement>('[type="submit"]', form);
    const label = btn && ($('[data-label]', btn) ?? btn);
    const original = label?.textContent ?? '';
    sending = true;
    btn?.setAttribute('disabled', '');
    btn?.setAttribute('aria-busy', 'true');
    if (label) label.textContent = 'Sending…';
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      // Some services answer 200 with { success: "false" } or { ok: false }: only a confirmed send counts (GAC-06/07).
      const json = await res.json().catch(() => ({}));
      if (json && (json.success === 'false' || json.success === false || json.ok === false)) throw new Error(json.message || 'rejected');
      form.reset();
      if (identity) identity.hidden = false;
      setStatus(form, 'success', form.dataset.success || 'Thank you — your message has been sent.');
    } catch {
      setStatus(form, 'error', 'Sorry, something went wrong and your message was not sent. Please try again, or email admin@dominionhub.org.uk.');
    } finally {
      sending = false;
      btn?.removeAttribute('disabled');
      btn?.removeAttribute('aria-busy');
      if (label) label.textContent = original;
    }
  });
});

/* ---------- Hero background videos (homepage, New Here) ----------
   The photo is the hero until the video is actually playing (no black flash, fast first paint).
   Skipped for reduced-motion and data-saver users. A pause control is provided (WCAG 2.2.2). */
const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
const allowMotion = !matchMedia('(prefers-reduced-motion: reduce)').matches && !conn?.saveData;
$$<HTMLElement>('[data-hero-video]').forEach((heroVideo) => { if (allowMotion) setupHeroVideo(heroVideo); });
function setupHeroVideo(heroVideo: HTMLElement) {
  const heroToggle = $<HTMLButtonElement>('[data-hero-video-toggle]', heroVideo.closest('section') ?? document);
  let playing = true;
  let send: (cmd: 'playVideo' | 'pauseVideo' | 'seekTo0') => void = () => {};

  const showToggle = () => { if (heroToggle) heroToggle.hidden = false; };
  heroToggle?.addEventListener('click', () => {
    playing = !playing;
    send(playing ? 'playVideo' : 'pauseVideo');
    heroToggle.setAttribute('aria-pressed', String(!playing));
    heroToggle.querySelector('[data-label]')!.textContent = playing ? 'Pause background video' : 'Play background video';
  });

  const start = () => {
    const mp4 = heroVideo.dataset.mp4;
    const yt = heroVideo.dataset.youtube;
    if (mp4) {
      const v = Object.assign(document.createElement('video'), { src: mp4, muted: true, loop: true, autoplay: true, playsInline: true });
      v.setAttribute('aria-hidden', 'true');
      v.addEventListener('playing', () => { heroVideo.classList.add('is-playing'); showToggle(); }, { once: true });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && playing) v.play().catch(() => {}); });
      send = (cmd) => { cmd === 'pauseVideo' ? v.pause() : v.play(); };
      heroVideo.appendChild(v);
    } else if (yt) {
      const origin = encodeURIComponent(location.origin);
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&rel=0&playsinline=1&enablejsapi=1&origin=${origin}`;
      iframe.title = 'Background video';
      iframe.tabIndex = -1;
      iframe.allow = 'autoplay; encrypted-media';
      iframe.setAttribute('aria-hidden', 'true');
      let duration = 0;
      let hideTimer: ReturnType<typeof setTimeout> | undefined;
      let revealTimer: ReturnType<typeof setTimeout> | undefined;
      send = (cmd) => {
        const msg = cmd === 'seekTo0' ? { event: 'command', func: 'seekTo', args: [0, true] } : { event: 'command', func: cmd, args: [] };
        iframe.contentWindow?.postMessage(JSON.stringify(msg), '*');
        if (cmd === 'seekTo0') iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      };
      // Listen for the player's state so the video only fades in once it is really playing.
      window.addEventListener('message', (e) => {
        if (e.source !== iframe.contentWindow) return;
        if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
        let data: { event?: string; info?: { playerState?: number; currentTime?: number; duration?: number } | number } = {};
        try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
        const info = typeof data.info === 'object' ? data.info : undefined;
        const state = typeof data.info === 'number' ? data.info : info?.playerState;
        // YouTube briefly shows its play/pause button whenever playback starts, resumes or restarts.
        // So the video is only revealed once it has been playing smoothly for a moment, and it fades
        // back to the photo just before each loop restart, staying hidden until the button has gone.
        const REVEAL_AFTER = 2200;
        if (info && typeof info.currentTime === 'number') {
          duration = (info as { duration?: number }).duration || duration;
          if (duration && info.currentTime > duration - 1.4 && heroVideo.classList.contains('is-playing')) {
            heroVideo.classList.remove('is-playing');
            clearTimeout(revealTimer);
            setTimeout(() => send('seekTo0'), 1000);
          }
        }
        if (state === undefined) return;
        if (state === 1) {
          clearTimeout(hideTimer); clearTimeout(revealTimer);
          if (!heroVideo.classList.contains('is-playing')) revealTimer = setTimeout(() => { heroVideo.classList.add('is-playing'); showToggle(); }, REVEAL_AFTER);
        } else if (state === 0) { heroVideo.classList.remove('is-playing'); send('seekTo0'); }
        // Paused or buffering: YouTube overlays its buttons, so show the photo until playback resumes.
        else { clearTimeout(revealTimer); clearTimeout(hideTimer); hideTimer = setTimeout(() => heroVideo.classList.remove('is-playing'), 150); }
      });
      iframe.addEventListener('load', () => {
        iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'hero' }), '*');
        iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }), '*');
      });
      if (heroVideo.dataset.fit === 'contain') {
        // Whole video shown uncropped in the middle; a blurred, muted copy fills the banner behind it.
        const backdrop = iframe.cloneNode() as HTMLIFrameElement;
        backdrop.src = iframe.src.replace('&enablejsapi=1', '');
        backdrop.className = 'hero__video-backdrop';
        iframe.className = 'hero__video-main';
        heroVideo.appendChild(backdrop);
      }
      heroVideo.appendChild(iframe);
      // Browsers pause background-tab video; resume when the visitor comes back.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && playing) send('playVideo'); });
    }
  };
  // Load after everything else so the video never slows the page down.
  const later = () => ('requestIdleCallback' in window ? (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(start) : setTimeout(start, 300));
  document.readyState === 'complete' ? later() : window.addEventListener('load', later, { once: true });
}

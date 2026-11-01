// Chat widget for the DCC website assistant (markup in components/Assistant.astro, server in assistant/).
type Turn = { role: 'user' | 'assistant'; content: string };

const STORE = 'dcc-assistant';
const root = document.querySelector<HTMLElement>('[data-assistant]');
if (root?.dataset.endpoint) setup(root, root.dataset.endpoint.replace(/\/+$/, '') + '/chat');

function setup(root: HTMLElement, endpoint: string) {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const launcher = q<HTMLButtonElement>('[data-assistant-open]');
  const panel = q<HTMLElement>('.assistant__panel');
  const log = q<HTMLElement>('[data-assistant-log]');
  const chips = q<HTMLElement>('[data-assistant-chips]');
  const form = q<HTMLFormElement>('[data-assistant-form]');
  const input = q<HTMLTextAreaElement>('[data-assistant-input]');
  const send = q<HTMLButtonElement>('[data-assistant-send]');
  const greeting = log.firstElementChild!.cloneNode(true);

  // The conversation is kept for this browser tab only, so it survives moving between pages.
  let turns: Turn[] = [];
  let busy = false;
  try { turns = JSON.parse(sessionStorage.getItem(STORE) ?? '[]'); } catch { turns = []; }
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(turns.slice(-20))); } catch { /* storage unavailable */ } };
  for (const t of turns) addBubble(t.role, t.content);
  chips.hidden = turns.length > 0;

  const open = (focus = true) => {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    log.scrollTop = log.scrollHeight;
    if (focus) input.focus();
  };
  const close = () => {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    launcher.focus();
  };
  launcher.addEventListener('click', () => (panel.hidden ? open() : close()));
  q('[data-assistant-close]').addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  q('[data-assistant-reset]').addEventListener('click', () => {
    if (busy) return;
    turns = [];
    save();
    log.replaceChildren(greeting.cloneNode(true), chips);
    chips.hidden = false;
    input.focus();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-assistant-suggest]').forEach((b) =>
    b.addEventListener('click', () => ask(b.textContent ?? '')));
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });
  input.addEventListener('input', autosize);

  function autosize() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    busy = true;
    send.disabled = true;
    chips.hidden = true;
    input.value = '';
    autosize();
    turns.push({ role: 'user', content: question });
    save();
    addBubble('user', question);
    const bubble = addBubble('assistant', '');
    bubble.classList.add('is-typing');
    bubble.setAttribute('aria-busy', 'true');

    let answer = '';
    let error = '';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: turns }),
      });
      if (!res.ok || !res.body) {
        error = (await res.json().catch(() => null))?.error ?? 'Sorry, the assistant is unavailable right now.';
      } else {
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const ev of events) {
            const data = ev.replace(/^data: /, '');
            let msg: { text?: string; error?: string; done?: boolean };
            try { msg = JSON.parse(data); } catch { continue; }
            if (msg.text) {
              answer += msg.text;
              bubble.classList.remove('is-typing');
              render(bubble, answer);
              stick();
            }
            if (msg.error) error = msg.error;
          }
        }
      }
    } catch {
      error = 'Sorry, I couldn\'t connect. Please check your connection and try again.';
    }

    bubble.classList.remove('is-typing');
    bubble.removeAttribute('aria-busy');
    if (answer) {
      turns.push({ role: 'assistant', content: answer });
    } else {
      turns.pop(); // nothing came back: let the visitor ask again
      error ||= 'Sorry, something went wrong. Please try again.';
    }
    if (error) {
      const p = document.createElement('p');
      p.className = 'assistant__error';
      p.textContent = error;
      bubble.append(p);
    }
    save();
    stick();
    busy = false;
    send.disabled = false;
    input.focus();
  }

  function addBubble(role: Turn['role'], text: string) {
    const div = document.createElement('div');
    div.className = `assistant__msg assistant__msg--${role === 'user' ? 'user' : 'bot'}`;
    if (role === 'user') {
      const p = document.createElement('p');
      p.textContent = text;
      div.append(p);
    } else {
      render(div, text);
    }
    log.append(div);
    stick();
    return div;
  }

  function stick() {
    log.scrollTop = log.scrollHeight;
  }

  // Remember whether the panel was open, so it stays open when moving to another page.
  try {
    if (sessionStorage.getItem(`${STORE}-open`) === '1') open(false);
    new MutationObserver(() => {
      try { sessionStorage.setItem(`${STORE}-open`, panel.hidden ? '0' : '1'); } catch { /* ignore */ }
    }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  } catch { /* storage unavailable */ }
}

/** Shows the assistant's reply: plain text with Markdown links, bold, lists and paragraphs. Never inserts raw HTML. */
function render(el: HTMLElement, text: string) {
  el.replaceChildren();
  let list: HTMLUListElement | null = null;
  for (const block of text.split(/\n/)) {
    const item = block.match(/^\s*[-*•]\s+(.*)$/);
    if (item) {
      if (!list) { list = document.createElement('ul'); el.append(list); }
      const li = document.createElement('li');
      inline(li, item[1]);
      list.append(li);
      continue;
    }
    list = null;
    if (!block.trim()) continue;
    const p = document.createElement('p');
    inline(p, block.replace(/^#+\s*/, ''));
    el.append(p);
  }
}

function inline(el: HTMLElement, text: string) {
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s)<]+[^\s)<.,;:!?])/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    el.append(text.slice(last, m.index));
    if (m[3]) {
      const b = document.createElement('strong');
      b.textContent = m[3];
      el.append(b);
    } else {
      const href = m[2] ?? m[4];
      const a = document.createElement('a');
      a.href = href;
      a.textContent = m[1] ?? href;
      if (/^https?:/.test(href) && new URL(href).origin !== location.origin) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      el.append(a);
    }
    last = m.index! + m[0].length;
  }
  el.append(text.slice(last));
}

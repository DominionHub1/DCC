// DCC website assistant: receives a visitor's conversation from the chat widget on the website,
// asks Claude for a reply using the website's own information, and streams the answer back.
import Anthropic from '@anthropic-ai/sdk';
import { INSTRUCTIONS } from './prompt';

interface Env {
  ANTHROPIC_API_KEY: string;
  SITE_URL: string;
  ALLOWED_ORIGINS: string;
  MODEL: string;
  CHAT_LIMITER?: RateLimit;
  /** Optional: send requests somewhere other than the Claude API (used only for local testing). */
  ANTHROPIC_BASE_URL?: string;
}

const MAX_TURNS = 20; // messages kept from the conversation
const MAX_CHARS = 1500; // per visitor message
const KNOWLEDGE_TTL = 600; // seconds: the site's information is re-read at most every 10 minutes

// Models that support the server-side refusal fallback ("default" picks the right fallback model).
const FALLBACK_MODELS = /^claude-(opus-5|fable-5|sonnet-5-5)/;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true }, 200, cors);
    if (request.method !== 'POST' || url.pathname !== '/chat') return json({ error: 'Not found' }, 404, cors);
    if (!cors) return json({ error: 'This assistant is only available on the church website.' }, 403);

    if (env.CHAT_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.CHAT_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "You're sending messages quickly. Please wait a minute and try again." }, 429, cors);
    }

    let messages: Anthropic.Beta.BetaMessageParam[];
    try {
      messages = parseConversation(await request.json());
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Invalid request' }, 400, cors);
    }

    let knowledge: string;
    try {
      knowledge = await getKnowledge(env, ctx);
    } catch {
      return json({ error: 'The assistant is unavailable right now.' }, 503, cors);
    }

    return streamReply(env, messages, knowledge, cors);
  },
} satisfies ExportedHandler<Env>;

function corsHeaders(origin: string, env: Env): Record<string, string> | null {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!origin || !(allowed.includes(origin) || local)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string> | null = null): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(headers ?? {}) } });
}

/** Accepts { messages: [{ role: 'user' | 'assistant', content: string }, ...] } ending with a user message. */
function parseConversation(body: unknown): Anthropic.Beta.BetaMessageParam[] {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('No messages');
  const msgs = raw.slice(-MAX_TURNS).map((m) => {
    const role = (m as { role?: unknown })?.role;
    const content = (m as { content?: unknown })?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) throw new Error('Invalid message');
    return { role, content: content.trim().slice(0, role === 'user' ? MAX_CHARS : 4 * MAX_CHARS) } as Anthropic.Beta.BetaMessageParam;
  });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift(); // the conversation must start with the visitor
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new Error('The last message must be from the visitor');
  return msgs;
}

/** The website's information, with site paths (/events) turned into full links. Cached briefly at the edge. */
async function getKnowledge(env: Env, ctx: ExecutionContext): Promise<string> {
  const site = env.SITE_URL.replace(/\/+$/, '');
  const source = `${site}/assistant-knowledge.txt`;
  const cache = caches.default;
  const key = new Request(source);
  let res = await cache.match(key);
  if (!res) {
    const fresh = await fetch(source);
    if (!fresh.ok) throw new Error(`Knowledge fetch failed: ${fresh.status}`);
    res = new Response(await fresh.text(), { headers: { 'Cache-Control': `max-age=${KNOWLEDGE_TTL}` } });
    ctx.waitUntil(cache.put(key, res.clone()));
  }
  const text = await res.text();
  return text.replace(/(^|[\s(])\/(?=[a-z#?]|$)/gm, `$1${site}/`);
}

function streamReply(env: Env, messages: Anthropic.Beta.BetaMessageParam[], knowledge: string, cors: Record<string, string>): Response {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });
  const now = new Date();
  const today = now.toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const useFallback = FALLBACK_MODELS.test(env.MODEL);

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (data: object) => writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

  (async () => {
    try {
      const stream = client.beta.messages.stream({
        model: env.MODEL,
        max_tokens: 4000,
        output_config: { effort: 'low' },
        ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        system: [
          { type: 'text', text: INSTRUCTIONS },
          // The large, slowly-changing website information is cached between visitors' messages.
          { type: 'text', text: `# Church information\n\n${knowledge}`, cache_control: { type: 'ephemeral' } },
          // Changes every request, so it comes after the cached part.
          { type: 'text', text: `Today is ${today} (UK time).` },
        ],
        messages,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') await send({ text: event.delta.text });
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        await send({ text: "\n\nI'm sorry, I can't help with that here. For anything else, please contact the church directly." });
      }
      await send({ done: true });
    } catch (e) {
      console.error('Assistant error', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      const busy = e instanceof Anthropic.RateLimitError || (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500);
      await send({ error: busy ? 'The assistant is busy right now. Please try again in a moment.' : 'Sorry, something went wrong. Please try again.' });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', ...cors },
  });
}

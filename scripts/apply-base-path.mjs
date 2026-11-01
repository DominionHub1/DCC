// Prefixes root-relative URLs in the built site (dist/) with a base path, e.g. /DCC.
// Used when the site is served from a sub-folder such as https://<owner>.github.io/DCC/
// instead of its own domain. With no base path (or "/") it does nothing.
//
// Usage: node scripts/apply-base-path.mjs /DCC   (or set BASE_PATH=/DCC)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const raw = process.argv[2] ?? process.env.BASE_PATH ?? '';
const base = raw.replace(/\/+$/, '');
if (!base || base === '/') {
  console.log('apply-base-path: no base path, nothing to do');
  process.exit(0);
}
if (!base.startsWith('/')) throw new Error(`Base path must start with "/": ${raw}`);

const dist = new URL('../dist/', import.meta.url).pathname;
// A root-relative path: "/" followed by anything except another "/" (which would be protocol-relative).
const rootPath = '/(?!/)';

function rewriteHtml(html) {
  return html
    // href="/x", src="/x", action="/x", poster="/x", data-*="/x"
    .replace(new RegExp(`(\\s(?:href|src|action|poster|data-[\\w-]+)=["'])(${rootPath})`, 'g'), (_, a) => `${a}${base}/`)
    // srcset="/a.jpg 1x, /b.jpg 2x"
    .replace(/(\ssrcset=["'])([^"']*)/g, (_, a, set) =>
      a + set.split(',').map((part) => part.replace(/^(\s*)\/(?!\/)/, (m, s) => `${s}${base}/`)).join(','))
    // <meta http-equiv="refresh" content="0;url=/x">
    .replace(new RegExp(`(content=["']\\d+;\\s*url=)(${rootPath})`, 'gi'), (_, a) => `${a}${base}/`)
    .replace(/url\((['"]?)\/(?!\/)/g, (_, q) => `url(${q}${base}/`);
}

function rewriteCss(css) {
  return css.replace(/url\((['"]?)\/(?!\/)/g, (_, q) => `url(${q}${base}/`);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path === join(dist, 'admin')) continue; // Decap CMS has its own config
      yield* walk(path);
    } else yield path;
  }
}

let count = 0;
for await (const file of walk(dist)) {
  const ext = extname(file);
  if (ext !== '.html' && ext !== '.css') continue;
  const before = await readFile(file, 'utf8');
  const after = ext === '.html' ? rewriteHtml(before) : rewriteCss(before);
  if (after !== before) {
    await writeFile(file, after);
    count++;
  }
}
console.log(`apply-base-path: prefixed links with ${base} in ${count} files`);

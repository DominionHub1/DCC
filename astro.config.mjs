// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://dominionconnections.org',
  // /theme mirrors the current theme's permanent page, so only the permanent page is listed.
  integrations: [sitemap({ filter: (page) => !/\/theme\/?$/.test(new URL(page).pathname) })],
  trailingSlash: 'ignore',
  vite: {
    server: {
      allowedHosts: ['monthly-curly-cycling.ngrok-free.dev'],
    },
  },
  // Pages that moved (Four F's merged into Ministries; Care moved under Community) — keep old links working.
  redirects: {
    '/four-fs': '/ministries',
    '/winter-events': '/events',
    '/plan-your-visit': '/new-here',
    '/care': '/ministries/community',
    '/care/prayer': '/ministries/community/prayer',
    '/care/[slug]': '/ministries/community/[slug]',
  },
});

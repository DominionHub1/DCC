import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeState, pickCurrent, isPublic, type ThemeWindow } from '../src/lib/theme-rules.ts';

const d = (s: string) => new Date(s);
const t2026: ThemeWindow = { id: '2026', status: 'published', from: d('2026-01-01T00:00:00Z'), until: d('2027-01-01T00:00:00Z') };
const t2027: ThemeWindow = { id: '2027', status: 'published', from: d('2027-01-01T00:00:00Z'), until: d('2028-01-01T00:00:00Z') };
const t2025: ThemeWindow = { id: '2025', status: 'archived', from: d('2025-01-01T00:00:00Z'), until: d('2026-01-01T00:00:00Z') };

test('AC-01: a published theme inside its active dates is current', () => {
  assert.equal(themeState(t2026, d('2026-10-10T12:00:00Z')), 'current');
  assert.equal(pickCurrent([t2025, t2026, t2027], d('2026-10-10T12:00:00Z'))?.id, '2026');
});

test('AC-05: a future theme published in advance takes over when its start date arrives', () => {
  assert.equal(themeState(t2027, d('2026-12-31T23:59:00Z')), 'upcoming');
  assert.equal(pickCurrent([t2026, t2027], d('2026-12-31T23:59:00Z'))?.id, '2026');
  assert.equal(pickCurrent([t2026, t2027], d('2027-01-01T00:00:00Z'))?.id, '2027');
});

test('AC-05: when active windows overlap, the most recently started theme wins', () => {
  const early2027 = { ...t2027, from: d('2026-12-01T00:00:00Z') };
  assert.equal(pickCurrent([t2026, early2027], d('2026-12-15T00:00:00Z'))?.id, '2027');
});

test('AC-06: an archived theme is never presented as current, even inside its dates', () => {
  const archivedButInWindow = { ...t2026, status: 'archived' as const };
  assert.equal(themeState(archivedButInWindow, d('2026-06-01T00:00:00Z')), 'archived');
  assert.equal(pickCurrent([archivedButInWindow], d('2026-06-01T00:00:00Z')), undefined);
  assert.equal(themeState(t2026, d('2027-02-01T00:00:00Z')), 'past');
  assert.equal(pickCurrent([t2025, t2026], d('2027-02-01T00:00:00Z')), undefined);
});

test('drafts are never public or current', () => {
  const draft = { ...t2026, status: 'draft' as const };
  assert.equal(isPublic(draft), false);
  assert.equal(pickCurrent([draft], d('2026-06-01T00:00:00Z')), undefined);
  assert.equal(isPublic(t2025), true);
});

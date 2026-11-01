import { getCollection, type CollectionEntry } from 'astro:content';
import { ukTime } from './schedule';
import { themeState, pickCurrent, isPublic, type ThemeState, type ThemeWindow } from './theme-rules';

export interface Theme extends ThemeWindow {
  entry: CollectionEntry<'themes'>;
  state: ThemeState;
  href: string;
  /** Body (pastor's message) is still empty. */
  messagePending: boolean;
  /** Description is still empty. */
  descriptionPending: boolean;
}

const nextDay = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

export async function getThemes(now = new Date()): Promise<Theme[]> {
  const entries = await getCollection('themes');
  return entries
    .map((entry) => {
      const w: ThemeWindow = {
        id: entry.id,
        status: entry.data.status,
        from: ukTime(`${entry.data.activeFrom}T00:00`),
        until: ukTime(`${nextDay(entry.data.activeUntil)}T00:00`),
      };
      return {
        ...w,
        entry,
        state: themeState(w, now),
        href: `/theme/${entry.id}`,
        messagePending: !entry.body?.trim(),
        descriptionPending: !entry.data.description.trim(),
      };
    })
    .sort((a, b) => b.from.getTime() - a.from.getTime());
}

export async function getCurrentTheme(now = new Date()) {
  return pickCurrent(await getThemes(now), now);
}

export async function getPublicThemes(now = new Date()) {
  return (await getThemes(now)).filter(isPublic);
}

export type PopularItem = {
  menuItem: string | null;
  name?: string;
  imageUrl?: string;
  category?: string;
  count: number;
};

export type PopularWindow = {
  since: string;
  until?: string;
  items: PopularItem[];
};

export type PopularResponse = {
  since: string;
  hours: number;
  items: PopularItem[];
  previous?: PopularWindow;
};

export type ChangeDirection = 'up' | 'down' | 'flat' | 'new';

export type ChangeSummary = {
  current: PopularItem;
  previous?: PopularItem;
  diff: number;
  pct: number | null;
  direction: ChangeDirection;
};

const makeKey = (item: PopularItem) => item.menuItem ?? item.name ?? '';

export const buildPopularMap = (items?: PopularItem[]): Map<string, PopularItem> => {
  const map = new Map<string, PopularItem>();
  (items ?? []).forEach((item) => map.set(makeKey(item), item));
  return map;
};

const roundPct = (value: number): number => (Number.isFinite(value) ? Math.round(value) : value);

export const computeChange = (current: PopularItem, previous?: PopularItem): ChangeSummary => {
  const prevCount = previous?.count ?? 0;
  const currentCount = current.count ?? 0;

  if (!previous && currentCount > 0) {
    return { current, previous, diff: currentCount, pct: null, direction: 'new' };
  }
  if (prevCount === 0) {
    return {
      current,
      previous,
      diff: currentCount,
      pct: currentCount > 0 ? null : 0,
      direction: currentCount > 0 ? 'new' : 'flat'
    };
  }

  const diff = currentCount - prevCount;
  const pctRaw = (diff / prevCount) * 100;
  const pct = Number.isFinite(pctRaw) ? roundPct(pctRaw) : null;

  let direction: ChangeDirection = 'flat';
  if (pct === null) direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  else if (pct > 0) direction = 'up';
  else if (pct < 0) direction = 'down';

  return { current, previous, diff, pct, direction };
};

export const computeChangeFromMap = (current: PopularItem, previousMap: Map<string, PopularItem>): ChangeSummary => {
  const previous = previousMap.get(makeKey(current));
  return computeChange(current, previous);
};


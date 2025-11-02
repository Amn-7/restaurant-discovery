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

export const makePopularKey = (item: PopularItem): string =>
  item.menuItem ?? item.name ?? '';

export const buildPopularMap = (items?: PopularItem[]): Map<string, PopularItem> => {
  const map = new Map<string, PopularItem>();
  (items ?? []).forEach((item) => {
    map.set(makePopularKey(item), item);
  });
  return map;
};

const roundPct = (value: number): number =>
  Number.isFinite(value) ? Math.round(value) : value;

export const computeChange = (
  current: PopularItem,
  previous?: PopularItem
): ChangeSummary => {
  const prevCount = previous?.count ?? 0;
  const currentCount = current.count ?? 0;

  if (!previous && currentCount > 0) {
    return {
      current,
      previous,
      diff: currentCount,
      pct: null,
      direction: 'new'
    };
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
  if (pct === null) {
    direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  } else if (pct > 0) {
    direction = 'up';
  } else if (pct < 0) {
    direction = 'down';
  }

  return {
    current,
    previous,
    diff,
    pct,
    direction
  };
};

export const computeChangeFromMap = (
  current: PopularItem,
  previousMap: Map<string, PopularItem>
): ChangeSummary => {
  const previous = previousMap.get(makePopularKey(current));
  return computeChange(current, previous);
};

export const deriveTrends = (
  currentItems: PopularItem[],
  previousItems: PopularItem[] = [],
  take = 3
) => {
  const previousMap = buildPopularMap(previousItems);
  const summaries = currentItems.map((item) =>
    computeChangeFromMap(item, previousMap)
  );

  const rising = summaries
    .filter((entry) => entry.direction === 'up' || entry.direction === 'new')
    .sort((a, b) => {
      const pctA = a.pct ?? a.diff;
      const pctB = b.pct ?? b.diff;
      return pctB - pctA;
    })
    .slice(0, take);

  const falling = summaries
    .filter((entry) => entry.direction === 'down')
    .sort((a, b) => {
      const pctA = a.pct ?? a.diff;
      const pctB = b.pct ?? b.diff;
      return pctA - pctB;
    })
    .slice(0, take);

  const stable = summaries
    .filter((entry) => entry.direction === 'flat')
    .sort((a, b) => (b.current.count ?? 0) - (a.current.count ?? 0))
    .slice(0, take);

  return { rising, falling, stable };
};

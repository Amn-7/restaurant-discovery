'use client';
import useSWR, { useSWRConfig } from 'swr';
import { useEffect, useMemo, useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  PopularResponse,
  buildPopularMap,
  computeChangeFromMap
} from '@/lib/popular';

type OrderItem = { name: string; imageUrl?: string; quantity: number; menuItem?: string | null };
type Order = { _id: string; tableNumber: string; items: OrderItem[]; status: 'ordered'|'preparing'|'served'; createdAt: string };

type RatingItem = { menuItem: string | null; name?: string; imageUrl?: string; category?: string; count: number; avg: number };
type RatingsRes = { since: string; hours: number; sort: 'count'|'avg'; items: RatingItem[] };

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
const EMPTY_POPULAR_ITEMS: PopularResponse['items'] = [];

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 30) return 'just now';
  const m = Math.floor(diff / 60);
  if (m < 1) return `${Math.floor(diff)}s ago`;
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function LiveFeedPage() {
  const { mutate } = useSWRConfig();
  const ordersKey = '/api/orders?active=1&hours=6&limit=50';
  const [popularRev, setPopularRev] = useState(0);
  const popularKey = useMemo(
    () => `/api/analytics/popular?hours=6&limit=20&compare=1&rev=${popularRev}`,
    [popularRev]
  );
  const refreshPopular = useCallback(() => {
    setPopularRev((rev) => rev + 1);
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/stream/orders');
    const bump = () => {
      mutate(ordersKey);
      refreshPopular();
    };
    es.addEventListener('order-created', bump);
    es.addEventListener('order-updated', bump);
    return () => {
      es.removeEventListener('order-created', bump);
      es.removeEventListener('order-updated', bump);
      es.close();
    };
  }, [mutate, ordersKey, refreshPopular]);

  const { data: orders, error, isLoading } = useSWR<Order[]>(ordersKey, fetcher, {
    refreshInterval: 3000
  });
  const { data: popular } = useSWR<PopularResponse>(popularKey, fetcher, {
    refreshInterval: 10000
  });
  const { data: favouriteData } = useSWR<RatingsRes>(
    '/api/analytics/ratings?hours=48&limit=1&sort=avg',
    fetcher,
    { refreshInterval: 12000 }
  );

  const popularItems = popular?.items ?? EMPTY_POPULAR_ITEMS;
  const sortedPopular = useMemo(() => {
    return [...popularItems].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  }, [popularItems]);
  const previousMap = useMemo(
    () => buildPopularMap(popular?.previous?.items),
    [popular]
  );

  const topPicks = useMemo(() => popularItems.slice(0, 3), [popularItems]);

  const getChangeBadge = (item: PopularResponse['items'][number]) => {
    const summary = computeChangeFromMap(item, previousMap);
    if (summary.direction === 'new') return 'NEW';
    if (summary.pct && summary.pct !== 0) {
      return `${summary.pct > 0 ? '+' : ''}${summary.pct}%`;
    }
    if (summary.diff !== 0 && summary.pct === null) {
      return `${summary.diff > 0 ? '+' : ''}${summary.diff}`;
    }
    return '—';
  };

  const popularSince = useMemo(() => {
    if (!popular?.since) return null;
    try {
      return new Date(popular.since).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return null;
    }
  }, [popular]);

  const popularRefreshedLabel = useMemo(() => {
    if (!popular?.since) return 'live';
    return timeAgo(popular.since);
  }, [popular]);

  const favourite = favouriteData?.items?.[0];
  const activeTables = useMemo(() => {
    if (!orders) return 0;
    return new Set(orders.map(o => o.tableNumber)).size;
  }, [orders]);
  const inFlight = useMemo(() => (orders ?? []).filter(o => o.status !== 'served').length, [orders]);

  const orderEntries = useMemo(() => {
    if (!orders) return [] as Array<{ id: string; name: string; imageUrl?: string; quantity: number; table: string; status: Order['status']; createdAt: string; menuItem?: string | null }>;
    return orders
      .flatMap((order) =>
        (order.items ?? []).map((item, idx) => ({
          id: `${order._id}-${idx}`,
          name: item.name ?? 'Dish',
          imageUrl: item.imageUrl,
          quantity: item.quantity ?? 1,
          table: order.tableNumber,
          status: order.status,
          createdAt: order.createdAt,
          menuItem: item.menuItem ?? null
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders]);

  const latestOrderMap = useMemo(() => {
    const map = new Map<string, string>();
    (orderEntries ?? []).forEach((entry) => {
      const key = entry.menuItem ?? entry.name;
      if (!key) return;
      const prev = map.get(key);
      if (!prev || new Date(entry.createdAt).getTime() > new Date(prev).getTime()) {
        map.set(key, entry.createdAt);
      }
    });
    return map;
  }, [orderEntries]);

  const showLoading = isLoading && !orders;
  const showError = Boolean(error);

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Live dining room</span>
        <h1 className="hero__title">Catch the buzz from every table</h1>
        <p className="hero__text">
          Explore what guests are ordering in real time, surface crowd-favourite dishes, and keep your team a step
          ahead during every service.
        </p>
        <div className="hero__insights">
          <div className="hero__card">
            <span className="hero__card-label">Live orders</span>
            <span className="hero__card-value">{orders?.length ?? 0}</span>
            <span className="hero__card-hint">
              {inFlight} in progress • {activeTables} active table{activeTables === 1 ? '' : 's'}
            </span>
          </div>
          <div className="hero__card">
            <span className="hero__card-label">Top Picks</span>
            {topPicks.length ? (
              <ul className="hero__list">
                {topPicks.map((item, index) => {
                  const href = item.menuItem ? `/dish/${item.menuItem}` : '/menu';
                  const changeLabel = getChangeBadge(item);
                  const summary = computeChangeFromMap(item, previousMap);
                  const badgeClass =
                    summary.direction === 'up' || summary.direction === 'new'
                      ? 'trend-up'
                      : summary.direction === 'down'
                      ? 'trend-down'
                      : 'trend-flat';
                  return (
                    <li key={`${item.menuItem ?? item.name ?? index}`} className="hero__list-item">
                      <Link href={href} className="hero__list-link hero__list-link--rich" aria-disabled={!item.menuItem}>
                        <span className="hero__list-rank">#{index + 1}</span>
                        {item.imageUrl ? (
                          <span className="hero__list-thumb">
                            <Image
                              src={item.imageUrl}
                              alt=""
                              width={40}
                              height={40}
                              className="hero__list-thumb-img"
                            />
                          </span>
                        ) : (
                          <span className="hero__list-thumb hero__list-thumb--placeholder" aria-hidden>
                            🍽️
                          </span>
                        )}
                        <span className="hero__list-body">
                          <span className="hero__list-name">{item.name ?? 'Unknown dish'}</span>
                          <span className="hero__list-count">{item.count} orders</span>
                        </span>
                      </Link>
                      <span className={`hero__list-change ${badgeClass}`}>{changeLabel}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="hero__card-hint">Serve a trending dish to see insights</span>
            )}
          </div>
          <div className="hero__card">
            <span className="hero__card-label">Guest favourites</span>
            <span className="hero__card-value">{favourite?.name ?? 'Awaiting reviews'}</span>
            <span className="hero__card-hint">
              {favourite?.avg
                ? `${Number(favourite.avg).toFixed(1)} ★ • ${favourite.count} review${favourite.count === 1 ? '' : 's'}`
                : 'Collect ratings to showcase favourites'}
            </span>
          </div>
        </div>
      </section>

      {sortedPopular.length > 0 && (
        <section className="card card--stacked card--scroll">
          <div className="page__header">
            <div>
              <h2 className="section-heading">🔥 Popular right now</h2>
              {popularSince ? (
                <p className="section-subtitle">Since {popularSince}</p>
              ) : (
                <p className="section-subtitle">Recent dishes ordered across the floor.</p>
              )}
            </div>
            <Link href="/analytics" className="btn btn--ghost">
              Open analytics
            </Link>
          </div>
          <div className="hero__list hero__list--scroll hero__list--popular">
            {sortedPopular.map((p, idx) => {
              const latestKey = p.menuItem ?? p.name ?? '';
              const latestTime = latestOrderMap.get(latestKey);
              return (
                <Link
                  key={`${p.menuItem ?? p.name}-${idx}`}
                  href={p.menuItem ? `/dish/${p.menuItem}` : '/menu'}
                  className="hero__list-item hero__list-item--card hero__list-item--popular"
                  aria-disabled={!p.menuItem}
                >
                  {p.imageUrl ? (
                    <span className="hero__list-thumb">
                      <Image
                        src={p.imageUrl}
                        alt={p.name ?? 'Dish'}
                        width={48}
                        height={48}
                        className="hero__list-thumb-img"
                      />
                    </span>
                  ) : (
                    <span className="hero__list-thumb hero__list-thumb--placeholder" aria-hidden>
                      🍽️
                    </span>
                  )}
                  <span className="hero__list-body">
                    <span className="hero__list-name">{p.name ?? 'Dish'}</span>
                    <span className="hero__list-count">
                      <span className="hero__list-count-pill">Ordered {p.count} times</span>
                    </span>
                  </span>
                  <span className="hero__list-tag">{latestTime ? timeAgo(latestTime) : popularRefreshedLabel}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="card card--stacked">
        <div className="page__header">
          <div>
            <h2 className="section-heading">Live order feed</h2>
            <p className="section-subtitle">Refreshed every few seconds. Tap a dish to read or leave a review.</p>
          </div>
          <span className="chip chip--accent">Tracking {orders?.length ?? 0} tickets</span>
        </div>

        {showError && <p className="muted">Failed to load feed. Please refresh to try again.</p>}
        {showLoading && <p className="muted">Loading live feed…</p>}

        {!showError && (
          <div className="hero__list hero__list--scroll hero__list--timeline">
            {orderEntries.map((entry) => {
              const href = entry.menuItem ? `/dish/${entry.menuItem}` : '/menu';
              const statusClass =
                entry.status === 'served'
                  ? 'status status--success'
                  : entry.status === 'preparing'
                  ? 'status status--accent'
                  : 'status status--neutral';
              return (
                <Link
                  key={`${entry.id}-feed`}
                  href={href}
                  className="hero__list-item hero__list-item--card hero__list-item--feed"
                  aria-disabled={!entry.menuItem}
                >
                  {entry.imageUrl ? (
                    <span className="hero__list-thumb">
                      <Image
                        src={entry.imageUrl}
                        alt={entry.name}
                        width={48}
                        height={48}
                        className="hero__list-thumb-img"
                      />
                    </span>
                  ) : (
                    <span className="hero__list-thumb hero__list-thumb--placeholder" aria-hidden>
                      🍽️
                    </span>
                  )}
                  <span className="hero__list-body">
                    <span className="hero__list-name">{entry.name}</span>
                    <span className="hero__list-count">Qty {entry.quantity} • Table {entry.table}</span>
                    <span className="hero__list-hint">
                      <span className={statusClass} style={{ fontSize: '0.68rem' }}>{entry.status}</span>
                      <span className="chip chip--faded">#{entry.id.slice(-6)}</span>
                    </span>
                  </span>
                  <span className="hero__list-tag">{timeAgo(entry.createdAt)}</span>
                </Link>
              );
            })}
          </div>
        )}

        {!showError && !showLoading && orderEntries.length === 0 && (
          <p className="muted">No recent orders yet. Hungry silence…</p>
        )}
      </section>
    </div>
  );
}

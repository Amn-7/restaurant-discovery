// app/analytics/page.tsx
'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Stars from '@/components/Stars';
import {
  buildPopularMap,
  computeChangeFromMap,
  type ChangeSummary,
  type PopularResponse
} from '@/lib/popular';

type RatedItem = {
  menuItem: string | null;
  name?: string;
  imageUrl?: string;
  category?: string;
  count: number;
  avg: number;
};
type RatingsRes = { since: string; hours: number; sort: 'count' | 'avg'; items: RatedItem[] };

type OrderItem = { itemId?: string; menuItem?: string; name?: string; quantity?: number };
type Order = {
  _id: string;
  tableNumber?: number | string;
  status?: 'ordered' | 'preparing' | 'served';
  items: OrderItem[];
  createdAt: string;
  servedAt?: string;
};

type MenuItem = {
  _id: string;
  name: string;
  category?: string | null;
  imageUrl?: string | null;
};

type PopularItem = PopularResponse['items'][number];

const TIME_WINDOWS = [6, 12, 24, 72] as const;
const POPULAR_LIMIT = 12;
const RATINGS_LIMIT = 12;

const EMPTY_POPULAR_ITEMS: PopularResponse['items'] = [];
const EMPTY_RATED_ITEMS: RatingsRes['items'] = [];

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  return res.json();
};

const formatWindow = (since?: string) => {
  if (!since) return null;
  try {
    return new Date(since).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return null;
  }
};

const describeChange = (summary?: ChangeSummary | null): string | null => {
  if (!summary) return null;
  if (summary.direction === 'new') return 'New in the top charts';
  if (summary.pct && summary.pct !== 0) {
    return `${summary.pct > 0 ? '+' : ''}${summary.pct}% vs. previous window`;
  }
  if (summary.diff !== 0) {
    return `${summary.diff > 0 ? '+' : ''}${summary.diff} orders vs. previous window`;
  }
  return 'Holding steady vs. last window';
};

const formatBadge = (summary: ChangeSummary): string => {
  if (summary.direction === 'new') return 'NEW';
  if (summary.pct && summary.pct !== 0) return `${summary.pct > 0 ? '+' : ''}${summary.pct}%`;
  if (summary.diff !== 0) return `${summary.diff > 0 ? '+' : ''}${summary.diff}`;
  return '—';
};

export default function AnalyticsPage() {
  const [hours, setHours] = useState<number>(24);
  const [category, setCategory] = useState<string>('all');
  const [table, setTable] = useState<string>('all');
  const [sort, setSort] = useState<'count' | 'avg'>('count');

  // Build URLs
  const popularUrl = useMemo(() => {
    const params = new URLSearchParams({
      hours: String(hours),
      limit: String(POPULAR_LIMIT),
      compare: '1'
    });
    if (category !== 'all') params.set('category', category);
    if (table !== 'all') params.set('table', table);
    return `/api/analytics/popular?${params.toString()}`;
  }, [hours, category, table]);

  const ratingsUrl = useMemo(() => {
    const params = new URLSearchParams({
      hours: String(hours),
      limit: String(RATINGS_LIMIT),
      sort
    });
    if (category !== 'all') params.set('category', category);
    return `/api/analytics/ratings?${params.toString()}`;
  }, [hours, category, sort]);

  const ordersUrl = useMemo(() => `/api/orders?hours=${hours}`, [hours]);

  // Data
const { data: popular, error: popErr, isLoading: popLoading } =
  useSWR<PopularResponse>(popularUrl, fetcher, { refreshInterval: 10000 });

  const { data: ratings, error: ratErr, isLoading: ratLoading } =
    useSWR<RatingsRes>(ratingsUrl, fetcher, { refreshInterval: 15000 });

  const { data: recentOrders } = useSWR<Order[]>(ordersUrl, fetcher, { refreshInterval: 8000 });
  const { data: menuItems } = useSWR<MenuItem[]>('/api/menu', fetcher, { refreshInterval: 60000 });

  // Derivations
  const popularItems = popular?.items ?? EMPTY_POPULAR_ITEMS;
const previousItems = popular?.previous?.items ?? EMPTY_POPULAR_ITEMS; // previous is present only when compare=1
  const ratedItems = ratings?.items ?? EMPTY_RATED_ITEMS;

  const previousMap = useMemo(() => buildPopularMap(previousItems), [previousItems]);

  const topPick = popularItems[0];
  const topPickSummary = topPick ? computeChangeFromMap(topPick, previousMap) : null;
  const favourite = ratedItems[0];

  const popularSince = formatWindow(popular?.since);
  const ratingsSince = formatWindow(ratings?.since);
  const popularWindowLabel = popularSince ? `since ${popularSince}` : `last ${hours}h`;
  const ratingsWindowLabel = ratingsSince ? `since ${ratingsSince}` : `last ${hours}h`;

  const satisfaction = useMemo(() => {
    if (!ratedItems.length) return null;
    const totals = ratedItems.reduce(
      (acc, item) => {
        acc.count += item.count;
        acc.weighted += item.avg * item.count;
        return acc;
      },
      { count: 0, weighted: 0 }
    );
    if (totals.count === 0) return null;
    return {
      avg: totals.weighted / totals.count,
      count: totals.count
    };
  }, [ratedItems]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (menuItems ?? []).forEach((item) => item.category && set.add(item.category));
    const options = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (category !== 'all' && !set.has(category)) options.unshift(category);
    return options;
  }, [menuItems, category]);

  const tableOptions = useMemo(() => {
    const set = new Set<string>();
    (recentOrders ?? []).forEach((order) => {
      if (order.tableNumber !== undefined && order.tableNumber !== null) {
        set.add(String(order.tableNumber));
      }
    });
    if (table !== 'all' && !set.has(table)) set.add(table);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [recentOrders, table]);

  const filteredOrders = useMemo(() => {
    if (!recentOrders) return [];
    if (table === 'all') return recentOrders;
    return recentOrders.filter((o) => String(o.tableNumber ?? '') === table);
  }, [recentOrders, table]);

  const totalOrders = filteredOrders.length;
  const activeTables = useMemo(() => {
    if (!filteredOrders.length) return 0;
    return new Set(filteredOrders.map((o) => String(o.tableNumber ?? ''))).size;
  }, [filteredOrders]);

  const inFlight = useMemo(
    () => filteredOrders.filter((o) => o.status !== 'served').length,
    [filteredOrders]
  );

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Dining room pulse</span>
        <h1 className="hero__title">Analytics for smarter service</h1>
        <p className="hero__text">
          Dial in the timeframe to surface trending plates, discover surprise hits, and spotlight the dishes that deserve
          a front-row seat on your menu.
        </p>
        <div className="hero__insights">
          <div className="hero__card">
            <span className="hero__card-label">Orders analysed</span>
            <span className="hero__card-value">{totalOrders}</span>
            <span className="hero__card-hint">
              {inFlight} in progress • {activeTables} active table{activeTables === 1 ? '' : 's'}
            </span>
          </div>
          <div className="hero__card">
            <span className="hero__card-label">Top pick</span>
            <span className="hero__card-value">{topPick?.name ?? 'Waiting for orders'}</span>
            <span className="hero__card-hint">
              {topPick?.count
                ? `${topPick.count} orders ${popularWindowLabel}`
                : 'Serve a trending dish to see insights'}
            </span>
            {topPickSummary ? (
              <span
                className={`hero__card-trend ${
                  topPickSummary.direction === 'down'
                    ? 'trend-down'
                    : topPickSummary.direction === 'up' || topPickSummary.direction === 'new'
                    ? 'trend-up'
                    : 'trend-flat'
                }`}
              >
                {describeChange(topPickSummary)}
              </span>
            ) : null}
          </div>
          <div className="hero__card">
            <span className="hero__card-label">Guest favourites</span>
            <span className="hero__card-value">{favourite?.name ?? 'Awaiting reviews'}</span>
            <span className="hero__card-hint">
              {favourite?.avg
                ? `${Number(favourite.avg).toFixed(1)} ★ • ${favourite.count} review${favourite.count === 1 ? '' : 's'} ${ratingsWindowLabel}`
                : 'Collect ratings to showcase favourites'}
            </span>
          </div>
          <div className="hero__card">
            <span className="hero__card-label">Guest satisfaction</span>
            <span className="hero__card-value">
              {satisfaction ? `${satisfaction.avg.toFixed(1)} ★` : 'Awaiting feedback'}
            </span>
            <span className="hero__card-hint">
              {satisfaction
                ? `${satisfaction.count} review${satisfaction.count === 1 ? '' : 's'} ${ratingsWindowLabel}`
                : 'Encourage diners to rate their dishes to unlock this metric'}
            </span>
          </div>
        </div>
      </section>

      <section className="control-bar">
        <label className="labelled-control">
          Time window
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {TIME_WINDOWS.map((option) => (
              <option key={option} value={option}>
                Last {option}h
              </option>
            ))}
          </select>
        </label>

        <label className="labelled-control">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        <label className="labelled-control">
          Table
          <select value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="all">All tables</option>
            {tableOptions.map((tn) => (
              <option key={tn} value={tn}>
                Table {tn}
              </option>
            ))}
          </select>
        </label>

        <label className="labelled-control">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as 'count' | 'avg')}>
            <option value="count">Most reviews</option>
            <option value="avg">Highest rated</option>
          </select>
        </label>
      </section>

      {/* Popular */}
      <section className="card card--stacked card--scroll">
        <div className="page__header">
          <div>
            <h2 className="section-heading">🔥 Popular right now</h2>
            {popularSince ? (
              <p className="section-subtitle">Since {popularSince}</p>
            ) : (
              <p className="section-subtitle">Orders within the last {hours} hours.</p>
            )}
          </div>
          <span className="chip">
            Showing {popularItems.length} of {POPULAR_LIMIT}
          </span>
        </div>

        {popErr && <p className="muted">Failed to load popular dishes.</p>}
        {popLoading && <p className="muted">Crunching fresh numbers…</p>}

        {!popErr && !popLoading && (
          <>
            {popularItems.length > 0 ? (
              <div className="popular-grid">
                {popularItems.map((item, idx) => {
                  const href = item.menuItem ? `/dish/${item.menuItem}` : '/menu';
                  const summary = computeChangeFromMap(item as PopularItem, previousMap);
                  const badgeText = formatBadge(summary);

                  const badgeClass =
                    summary.direction === 'down'
                      ? 'trend-badge--down'
                      : summary.direction === 'up' || summary.direction === 'new'
                      ? 'trend-badge--up'
                      : '';

                  return (
                    <Link
                      key={`${item.menuItem ?? item.name}-${idx}`}
                      href={href}
                      className="card card--interactive card--tight"
                      aria-disabled={!item.menuItem}
                    >
                      {item.imageUrl ? (
                        <div className="card__media">
                          <Image
                            src={item.imageUrl}
                            alt={item.name ?? 'Featured menu item'}
                            fill
                            sizes="(max-width: 768px) 100vw, 280px"
                            className="card__media-image"
                          />
                        </div>
                      ) : null}
                      <div className="card__body">
                        <div className="card__title">{item.name}</div>
                        <p className="card__meta">{item.count} orders</p>
                        <div className="trend-inline">
                          <span className={`trend-badge ${badgeClass}`}>{badgeText}</span>
                          <span className="trend-inline__hint">{describeChange(summary)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No popular items in this window. Try widening the timeframe.</p>
            )}
          </>
        )}
      </section>

      {/* Ratings */}
      <section className="card card--stacked card--scroll">
        <div className="page__header">
          <div>
            <h2 className="section-heading">⭐ Top rated</h2>
            {ratingsSince ? (
              <p className="section-subtitle">Reviews since {ratingsSince}</p>
            ) : (
              <p className="section-subtitle">Where guests are leaving the brightest praise.</p>
            )}
          </div>
          <span className="chip chip--accent">{sort === 'avg' ? 'Highest averages' : 'Most buzz'}</span>
        </div>

        {ratErr && <p className="muted">Failed to load ratings.</p>}
        {ratLoading && <p className="muted">Gathering reviews…</p>}

        {!ratErr && !ratLoading && (
          <>
            {ratedItems.length > 0 ? (
              <div className="grid grid--cols-wide">
                {ratedItems.map((item, idx) => (
                  <article key={item.menuItem ?? idx} className="card card--interactive card--tight">
                    <div className="page__header page__header--compact">
                      <Link
                        href={item.menuItem ? `/dish/${item.menuItem}` : '/menu'}
                        aria-disabled={!item.menuItem}
                        className="card__title flex-fill"
                      >
                        {item.name ?? 'Unknown dish'}
                      </Link>
                      <span className="chip">
                        {item.count} review{item.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="pill-group">
                      <Stars value={item.avg} readOnly size={18} ariaLabel="average rating" />
                      <span className="tag tag--accent">{item.avg.toFixed(1)} / 5</span>
                      {item.category ? <span className="tag">{item.category}</span> : null}
                    </div>
                    {item.imageUrl ? (
                      <div className="card__media">
                        <Image
                          src={item.imageUrl}
                          alt={item.name ?? 'Dish'}
                          fill
                          sizes="(max-width: 768px) 100vw, 280px"
                          className="card__media-image"
                        />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No ratings yet for this window.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

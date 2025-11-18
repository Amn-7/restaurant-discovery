'use client';

import useSWR from 'swr';
import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

type OrderItem = { name?: string; quantity?: number; menuItem?: string | null };
type Order = {
  _id: string;
  tableNumber?: number | string;
  status?: 'ordered' | 'preparing' | 'served';
  items: OrderItem[];
  createdAt: string;
  servedAt?: string | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const HOURS_OPTIONS = [6, 12, 24, 72, 168] as const;
const STATUSES: Array<'all' | 'ordered' | 'preparing' | 'served'> = ['all', 'ordered', 'preparing', 'served'];

export default function AdminOrdersPage() {
  const [hours, setHours] = useState<number>(24);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [tableFilter, setTableFilter] = useState('');
  const { push } = useToast();

  const queryKey = useMemo(() => {
    const params = new URLSearchParams({ hours: String(hours), limit: '250' });
    if (status !== 'all') params.set('status', status);
    if (tableFilter.trim()) params.set('table', tableFilter.trim());
    return `/api/orders?${params.toString()}`;
  }, [hours, status, tableFilter]);

  const { data: orders, isLoading, error } = useSWR<Order[]>(queryKey, fetcher, {
    refreshInterval: 60000
  });

  const summary = useMemo(() => {
    const rows = orders ?? [];
    const counts = rows.reduce(
      (acc, order) => {
        acc.total += 1;
        if (order.status === 'ordered') acc.ordered += 1;
        if (order.status === 'preparing') acc.preparing += 1;
        if (order.status === 'served') acc.served += 1;
        return acc;
      },
      { total: 0, ordered: 0, preparing: 0, served: 0 }
    );
    return counts;
  }, [orders]);

  const handleExport = useCallback(
    async (format: 'pdf') => {
      try {
        const params = new URLSearchParams({ hours: String(hours), format });
        if (status !== 'all') params.set('status', status);
        if (tableFilter.trim()) params.set('table', tableFilter.trim());

        const res = await fetch(`/api/orders/export?${params.toString()}`, {
          method: 'GET'
        });
        if (!res.ok) {
          const text = await res.text().catch(() => 'Export failed');
          throw new Error(text);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `orders-${Date.now()}.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to export orders';
        push({ title: 'Export failed', description: message, variant: 'error' });
      }
    },
    [hours, status, tableFilter, push]
  );

  const filteredOrders = orders ?? [];

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Order history</span>
        <h1 className="hero__title">Timeline &amp; exports for every ticket</h1>
        <p className="hero__text">
          Filter by timeframe, table, or status, then export a PDF snapshot for end-of-day reconciliation or refunds.
        </p>
        <div className="hero__insights">
          <div className="hero__card">
            <span className="hero__card-label">Orders in view</span>
            <span className="hero__card-value">{summary.total}</span>
            <span className="hero__card-hint">
              {summary.ordered} ordered • {summary.preparing} preparing • {summary.served} served
            </span>
          </div>
          <div className="hero__card">
            <span className="hero__card-label">Filters</span>
            <span className="hero__card-value">Last {hours}h</span>
            <span className="hero__card-hint">
              Status: {status} • Table: {tableFilter.trim() || 'All'}
            </span>
          </div>
          <div className="hero__card">
            <span className="hero__card-label">Export</span>
            <button type="button" className="btn btn--ghost" onClick={() => handleExport('pdf')}>
              Download PDF
            </button>
          </div>
        </div>
      </section>

      <section className="control-bar">
        <label className="labelled-control">
          Time window
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {HOURS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option}h
              </option>
            ))}
          </select>
        </label>

        <label className="labelled-control">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}>
            {STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {entry === 'all' ? 'All statuses' : entry}
              </option>
            ))}
          </select>
        </label>

        <label className="labelled-control">
          Table
          <input
            placeholder="Search table #"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
          />
        </label>
      </section>

      <section className="card card--stacked">
        <div className="page__header">
          <div>
            <h2 className="section-heading">Order timeline</h2>
            <p className="section-subtitle">Newest first. Click a dish to open the guest-facing view.</p>
          </div>
          <span className="chip chip--accent">{filteredOrders.length} row{filteredOrders.length === 1 ? '' : 's'}</span>
        </div>

        {error && <p className="muted">Failed to load orders. Please refresh.</p>}
        {isLoading && <p className="muted">Loading order history…</p>}

        {!isLoading && !error && filteredOrders.length === 0 && (
          <p className="muted">No orders match the selected filters.</p>
        )}

        {!isLoading && !error && filteredOrders.length > 0 && (
          <div className="live-feed">
            {filteredOrders.map((order) => {
              const created = new Date(order.createdAt);
              const served = order.servedAt ? new Date(order.servedAt) : null;
              return (
                <article key={order._id} className="live-feed__item">
                  <div className="live-feed__meta">
                    <div className="live-feed__meta-left">
                      <strong>Order #{order._id.slice(-6)}</strong>
                      <span>
                        {created.toLocaleString(undefined, {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="live-feed__meta-right">
                      <span className="chip">Table {order.tableNumber ?? '—'}</span>
                      <span className="status status--accent">{order.status ?? 'unknown'}</span>
                    </div>
                  </div>
                  <div className="pill-group">
                    {(order.items ?? []).map((item, idx) => (
                      <span key={`${order._id}-${idx}`} className="tag">
                        {item.name ?? 'Dish'} × {item.quantity ?? 1}{' '}
                        {item.menuItem ? (
                          <Link className="order-item__link" href={`/dish/${item.menuItem}`}>
                            View
                          </Link>
                        ) : null}
                      </span>
                    ))}
                  </div>
                  <div className="pill-group">
                    <span className="tag tag--accent">
                      Created: {created.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {served ? (
                      <span className="tag">
                        Served:{' '}
                        {served.toLocaleString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

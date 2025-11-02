'use client';

import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useToast } from '@/components/ToastProvider';
import { formatINR } from '@/lib/currency';

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
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  isAvailable?: boolean;
};

type OrderEventPayload = {
  _id: string;
  tableNumber?: string | number;
  status?: Order['status'];
  items?: Array<{ name?: string; quantity?: number }>;
};

const fetcher = (u: string) => fetch(u).then(r => r.json());

const EMPTY_ORDERS: Order[] = [];

export default function TablePage() {
  const { table } = useParams<{ table: string }>();
  const ordersKey = `/api/orders?hours=24&table=${encodeURIComponent(table)}`;
  const { mutate } = useSWRConfig();
  const { push } = useToast();
  const recentToastRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !table) return;
    const value = String(table);
    window.localStorage.setItem('guest.tableNumber', value);
    window.dispatchEvent(
      new CustomEvent('table-number-change', { detail: value })
    );
  }, [table]);

  const {
    data,
    error,
    isLoading
  } = useSWR<Order[]>(ordersKey, fetcher, { refreshInterval: 8000 });

  const {
    data: menu,
    error: menuError,
    isLoading: menuLoading
  } = useSWR<MenuItem[]>('/api/menu', fetcher, { refreshInterval: 60000 });

  const [draft, setDraft] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const showLoading = isLoading && !data;
  const showError = Boolean(error);
  const orders = data ?? EMPTY_ORDERS;

  const availableMenu = useMemo(
    () => (menu ?? []).filter((item) => item.isAvailable !== false),
    [menu]
  );

  const selectedItems = useMemo(() => {
    if (!menu) return [];
    return Object.entries(draft)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = menu.find((m) => m._id === id);
        return item
          ? {
              item,
              quantity: qty
            }
          : null;
      })
      .filter(Boolean) as { item: MenuItem; quantity: number }[];
  }, [draft, menu]);

  const totalPlates = useMemo(
    () => selectedItems.reduce((acc, entry) => acc + entry.quantity, 0),
    [selectedItems]
  );

  const adjustQuantity = useCallback((id: string, delta: number) => {
    setDraft((prev) => {
      const next = { ...prev };
      const nextQty = Math.max(0, (next[id] ?? 0) + delta);
      if (nextQty === 0) {
        delete next[id];
      } else {
        next[id] = nextQty;
      }
      return next;
    });
  }, []);

  const resetDraft = useCallback(() => setDraft({}), []);

  const submitOrder = useCallback(async () => {
    if (!selectedItems.length || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: table,
          status: 'ordered',
          source: 'table',
          items: selectedItems.map(({ item, quantity }) => ({
            menuItem: item._id,
            quantity
          }))
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Failed to place order');
      }

      push({
        title: 'Order sent to the kitchen',
        description: 'We will keep you posted as it progresses.',
        variant: 'success'
      });
      resetDraft();
      await mutate(ordersKey);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again shortly.';
      push({
        title: 'Unable to place order',
        description: message,
        variant: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  }, [selectedItems, submitting, table, push, resetDraft, mutate, ordersKey]);

  useEffect(() => {
    const es = new EventSource('/api/stream/orders');

    const handleEvent = (evt: MessageEvent<string>) => {
      const payload: OrderEventPayload = JSON.parse(evt.data ?? '{}');
      if (!payload || String(payload.tableNumber ?? '') !== String(table)) {
        return;
      }

      mutate(ordersKey);

      const headline =
        evt.type === 'order-created'
          ? 'New order created'
          : payload.status === 'served'
          ? 'Order served'
          : 'Order updated';
      const summary =
        payload.items && Array.isArray(payload.items)
          ? payload.items.map((it) => `${it?.name ?? 'Dish'} × ${it?.quantity ?? 1}`).join(', ')
          : undefined;

      const toastKey = `${evt.type}-${payload._id}-${payload.status}`;
      if (recentToastRef.current === toastKey) return;
      recentToastRef.current = toastKey;
      push({
        title: headline,
        description: summary,
        variant: evt.type === 'order-created' ? 'success' : 'default'
      });
    };

    es.addEventListener('order-created', handleEvent as EventListener);
    es.addEventListener('order-updated', handleEvent as EventListener);

    return () => {
      es.removeEventListener('order-created', handleEvent as EventListener);
      es.removeEventListener('order-updated', handleEvent as EventListener);
      es.close();
    };
  }, [mutate, ordersKey, push, table]);

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Table experience</span>
        <h1 className="hero__title">Welcome, Table {table}</h1>
        <p className="hero__text">
          Track your orders as they move from the kitchen to your table. Explore the menu, add dishes on the fly, and
          leave shout-outs for favourites.
        </p>
        <div className="pill-group">
          <Link href="/menu" className="btn btn--ghost">
            Browse the full menu
          </Link>
        </div>
      </section>

      <section className="card card--stacked">
        <div className="page__header">
          <div>
            <h2 className="section-heading">Add something else?</h2>
            <p className="section-subtitle">
              Tap a dish to add it to this table&apos;s tab — we will ping the kitchen immediately.
            </p>
          </div>
          <span className="chip">
            {totalPlates > 0 ? `${totalPlates} plate${totalPlates === 1 ? '' : 's'}` : 'No selections yet'}
          </span>
        </div>

        {menuLoading && <p className="muted">Loading menu highlights…</p>}
        {menuError && <p className="muted">Unable to load menu right now. Please refresh.</p>}

        {!menuLoading && !menuError && (
          <>
            <div className="menu-grid">
              {availableMenu.map((item) => {
                const qty = draft[item._id] ?? 0;
                return (
                  <article key={item._id} className="menu-card">
                    <div className="menu-card__body">
                      <div className="menu-card__header">
                        <h3>{item.name}</h3>
                        <span>{formatINR(item.price)}</span>
                      </div>
                      {item.description ? <p className="menu-card__description">{item.description}</p> : null}
                      {item.category ? <span className="tag">{item.category}</span> : null}
                    </div>
                    <div className="menu-card__footer">
                      <button
                        type="button"
                        className="counter__btn"
                        onClick={() => adjustQuantity(item._id, -1)}
                        disabled={qty === 0}
                      >
                        −
                      </button>
                      <span className="counter__value">{qty}</span>
                      <button
                        type="button"
                        className="counter__btn counter__btn--accent"
                        onClick={() => adjustQuantity(item._id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="order-summary">
              <div>
                <h3 className="order-summary__title">Order summary</h3>
                {selectedItems.length ? (
                  <ul className="order-summary__list">
                    {selectedItems.map(({ item, quantity }) => (
                      <li key={item._id}>
                        <span>{item.name}</span>
                        <span className="order-summary__badge">× {quantity}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Your tray is empty. Add a dish to begin.</p>
                )}
              </div>
              <div className="order-summary__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={submitOrder}
                  disabled={!selectedItems.length || submitting}
                >
                  {submitting ? 'Sending…' : 'Send to kitchen'}
                </button>
                {selectedItems.length > 0 ? (
                  <button type="button" className="btn btn--ghost" onClick={resetDraft} disabled={submitting}>
                    Clear selection
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      {showLoading && <p className="muted">Loading your orders…</p>}
      {showError && <p className="muted">Failed to load orders. Please refresh.</p>}

      {!showLoading && !showError && (
        <section className="card card--stacked">
          <div className="page__header">
            <div>
              <h2 className="section-heading">Your orders</h2>
              <p className="section-subtitle">Updated automatically — no need to refresh.</p>
            </div>
            <span className="chip chip--accent">{orders.length} total</span>
          </div>

          <div className="live-feed">
            {orders.map((o) => (
              <article key={o._id} className="live-feed__item">
                <div className="live-feed__meta">
                  <div className="live-feed__meta-left">
                    <strong>Order #{o._id.slice(-6)}</strong>
                    <span>{new Date(o.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="live-feed__meta-right">
                    <span className="status status--accent">{o.status ?? 'ordered'}</span>
                  </div>
                </div>
                <div className="pill-group">
                  {o.items.map((it, idx) => (
                    <span key={idx} className="tag">
                      {it.name ?? 'Dish'} × {it.quantity ?? 1}
                    </span>
                  ))}
                </div>
                <div className="pill-group">
                  {(o.items ?? []).map(
                    (it, idx) =>
                      (it.menuItem || it.itemId) && (
                        <Link
                          key={`${o._id}-${idx}`}
                          href={`/dish/${it.menuItem ?? it.itemId}`}
                          className="order-item__link"
                        >
                          Rate {it.name ?? 'dish'}
                        </Link>
                      )
                  )}
                </div>
              </article>
            ))}
            {orders.length === 0 && (
              <p className="muted">
                No orders yet for this table. Try something from the <Link href="/menu">menu</Link>!
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

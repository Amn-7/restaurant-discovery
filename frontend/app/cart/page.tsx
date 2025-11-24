'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/currency';
import { useToast } from '@/components/ToastProvider';
import { CART_STORAGE_KEY, readCartDraft, writeCartDraft } from '@/lib/cart';
import { safeLocalStorage } from '@/lib/safeStorage';
import type { CartDraft } from '@/lib/cart';

type MenuItem = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable?: boolean;
  category?: string;
  tags?: string[];
  stock?: number | null;
  lowStockThreshold?: number | null;
};

type CartEntry = {
  id: string;
  quantity: number;
  item: MenuItem | null;
};

const TABLE_STORAGE_KEY = 'guest.tableNumber';

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const ct = r.headers.get('content-type') ?? '';
  if (!r.ok) {
    if (ct.includes('application/json')) {
      type ApiError = { message?: string; error?: string };
      const body = (await r.json().catch(() => ({}))) as unknown as ApiError;
      const msg = body && (body.message || body.error) ? (body.message || body.error) : `HTTP ${r.status}`;
      throw new Error(String(msg));
    } else {
      const text = await r.text().catch(() => '');
      if (r.status === 401 && text.includes('Authentication Required')) {
        throw new Error('Deployment is protected by Vercel. Disable protection or use a bypass token.');
      }
      throw new Error(`HTTP ${r.status}`);
    }
  }
  if (ct.includes('application/json')) return r.json();
  throw new Error('Unexpected response type from API');
};

export default function CartPage() {
  const { data, error, isLoading } = useSWR<MenuItem[]>('/api/menu', fetcher, { refreshInterval: 0 });
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    return readCartDraft();
  });
  const [tableNumber, setTableNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const stored = safeLocalStorage.get(TABLE_STORAGE_KEY);
    if (stored) setTableNumber(stored);

    const handleTableEvent = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setTableNumber(detail ?? '');
    };

    const handleCartEvent = (event: Event) => {
      const detail = (event as CustomEvent<CartDraft>).detail;
      setDraft(detail ?? {});
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === TABLE_STORAGE_KEY) {
        setTableNumber(event.newValue ?? '');
      }
      if (event.key === CART_STORAGE_KEY) {
        setDraft(readCartDraft());
      }
    };

    window.addEventListener('table-number-change', handleTableEvent as EventListener);
    window.addEventListener('menu-cart-change', handleCartEvent as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('table-number-change', handleTableEvent as EventListener);
      window.removeEventListener('menu-cart-change', handleCartEvent as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const stockMap = useMemo(() => {
    const map = new Map<string, number | null | undefined>();
    (data ?? []).forEach((item) => {
      map.set(item._id, item.stock ?? null);
    });
    return map;
  }, [data]);

  const cartEntries = useMemo<CartEntry[]>(() => {
    const byId = new Map<string, MenuItem>();
    (data ?? []).forEach((item) => byId.set(item._id, item));
    return Object.entries(draft)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        id,
        quantity: qty,
        item: byId.get(id) ?? null
      }));
  }, [data, draft]);

  const validEntries = useMemo(
    () => cartEntries.filter((entry): entry is CartEntry & { item: MenuItem } => Boolean(entry.item)),
    [cartEntries]
  );

  const hasUnavailable = cartEntries.length > validEntries.length;

  const totalPlates = useMemo(() => cartEntries.reduce((sum, entry) => sum + entry.quantity, 0), [cartEntries]);
  const totalAmount = useMemo(
    () =>
      cartEntries.reduce(
        (sum, entry) => sum + (entry.item ? entry.item.price * entry.quantity : 0),
        0
      ),
    [cartEntries]
  );

  const adjustQuantity = useCallback(
    (id: string, delta: number) => {
      setDraft((prev) => {
        const next = { ...prev };
        const current = next[id] ?? 0;
        const stock = stockMap.get(id);
        const maxQty = typeof stock === 'number' && Number.isFinite(stock) ? stock : Number.MAX_SAFE_INTEGER;
        const nextQty = Math.max(0, Math.min(current + delta, maxQty));
        if (nextQty === current) return prev;
        if (nextQty === 0) delete next[id];
        else next[id] = nextQty;
        writeCartDraft(next);
        return next;
      });
    },
    [stockMap]
  );

  const removeItem = useCallback((id: string) => {
    setDraft((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      writeCartDraft(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setDraft(() => {
      writeCartDraft({});
      return {};
    });
  }, []);

  const handleSetTable = useCallback(() => {
    if (typeof window === 'undefined') return;
    const entry = window.prompt('Enter your table number or code');
    if (!entry) return;
    const trimmed = entry.trim();
    if (!trimmed) return;
    setTableNumber(trimmed);
    safeLocalStorage.set(TABLE_STORAGE_KEY, trimmed);
    window.dispatchEvent(new CustomEvent('table-number-change', { detail: trimmed }));
  }, []);

  const goToMenu = useCallback(() => {
    router.push('/menu');
  }, [router]);

  const submitOrder = useCallback(async () => {
    if (!cartEntries.length || submitting) return;
    if (!tableNumber.trim()) {
      pushToast({
        title: 'Set a table number',
        description: 'Choose your table before placing an order.',
        variant: 'error'
      });
      return;
    }
    if (hasUnavailable) {
      pushToast({
        title: 'Update your cart',
        description: 'Some dishes are unavailable. Remove them to continue.',
        variant: 'error'
      });
      return;
    }
    setSubmitting(true);
    try {
      const payloadItems = validEntries.map(({ item, quantity }) => ({
        menuItem: item._id,
        quantity
      }));
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: tableNumber.trim(),
          status: 'ordered',
          source: 'table',
          items: payloadItems
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Failed to place order');
      }
      pushToast({
        title: 'Order submitted',
        description: 'We sent the ticket to the kitchen.',
        variant: 'success'
      });
      clearCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      router.push('/menu');
    } catch (err) {
      pushToast({
        title: 'Unable to submit',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  }, [cartEntries, clearCart, hasUnavailable, pushToast, router, submitting, tableNumber, validEntries]);

  const showLoading = isLoading && !data;
  const showError = Boolean(error);

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Your cart</span>
        <h1 className="hero__title">Review and send your selections</h1>
        <p className="hero__text">
          We keep this cart synced with the menu so you can add dishes, tweak quantities, and submit the order when
          you&apos;re ready.
        </p>
      </section>

      <section className="menu-table-chip">
        <div>
          <p className="menu-table-chip__label">{tableNumber ? `Table ${tableNumber}` : 'No table selected yet'}</p>
          <p className="menu-table-chip__hint">
            Orders placed here will be routed to this table. Update it anytime.
          </p>
        </div>
        <button className="btn btn--ghost" type="button" onClick={handleSetTable}>
          {tableNumber ? 'Change table' : 'Set table'}
        </button>
      </section>

      {showError && (
        <p className="muted">Failed to load menu data: {error instanceof Error ? error.message : 'Unknown error'}</p>
      )}
      {showLoading && <p className="muted">Loading cart…</p>}

      {!showError && (
        <>
          {cartEntries.length > 0 ? (
            <section className="card card--stacked cart-list">
              {cartEntries.map((entry) => (
                <article key={entry.id} className="cart-item">
                  {entry.item?.imageUrl ? (
                    <div className="cart-item__media">
                      <Image
                        src={entry.item.imageUrl}
                        alt={entry.item.name}
                        fill
                        sizes="96px"
                      />
                    </div>
                  ) : (
                    <div className="cart-item__media cart-item__media--placeholder" aria-hidden>
                      🍽️
                    </div>
                  )}
                  <div className="cart-item__body">
                    <div className="cart-item__title-row">
                      <div>
                        <h3 className="cart-item__title">{entry.item?.name ?? 'Unavailable dish'}</h3>
                        {entry.item?.category ? (
                          <p className="cart-item__subtitle">{entry.item.category}</p>
                        ) : null}
                      </div>
                      <span className="cart-item__price">
                        {entry.item ? formatINR(entry.item.price) : '—'}
                      </span>
                    </div>
                    {entry.item?.description ? (
                      <p className="cart-item__description">{entry.item.description}</p>
                    ) : null}
                    {entry.item ? (
                      <div className="cart-item__status">
                        <span
                          className={
                            entry.item.isAvailable === false ? 'status status--danger' : 'status status--success'
                          }
                        >
                          {entry.item.isAvailable === false ? 'Sold out' : 'Available'}
                        </span>
                        {typeof entry.item.stock === 'number' && entry.item.stock >= 0 ? (
                          <span className="chip chip--faded">Stock: {entry.item.stock}</span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="cart-item__warning">This dish is no longer on the menu.</p>
                    )}
                  </div>
                  <div className="cart-item__actions">
                    <div className="qty-pill">
                      <button
                        type="button"
                        onClick={() => adjustQuantity(entry.id, -1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span>{entry.quantity}</span>
                      <button
                        type="button"
                        onClick={() => adjustQuantity(entry.id, 1)}
                        disabled={entry.item?.isAvailable === false}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button type="button" className="btn btn--ghost btn--small cart-item__remove" onClick={() => removeItem(entry.id)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="card card--stacked cart-empty">
              <h3 className="section-heading">Your cart is empty</h3>
              <p className="section-subtitle">Browse the menu to start building an order.</p>
              <Link href="/menu" className="btn btn--primary">
                Go to menu
              </Link>
            </section>
          )}

          {cartEntries.length > 0 && (
            <section className="card card--stacked cart-summary">
              <div className="page__header">
                <div>
                  <h2 className="section-heading">Summary</h2>
                  <p className="section-subtitle">Total {totalPlates} item{totalPlates === 1 ? '' : 's'}</p>
                </div>
                <button type="button" className="btn btn--ghost" onClick={goToMenu}>
                  Add more dishes
                </button>
              </div>
              <div className="cart-summary__stats">
                <div>
                  <span className="muted">Items</span>
                  <strong>{totalPlates}</strong>
                </div>
                <div>
                  <span className="muted">Total</span>
                  <strong>{formatINR(totalAmount)}</strong>
                </div>
              </div>
              {hasUnavailable ? (
                <p className="cart-warning">Remove unavailable dishes to place this order.</p>
              ) : null}
              <div className="cart-summary__actions">
                <button type="button" className="btn btn--ghost" onClick={clearCart}>
                  Clear cart
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={submitOrder}
                  disabled={submitting || hasUnavailable}
                >
                  {submitting ? 'Sending…' : 'Submit order'}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {cartEntries.length > 0 && (
        <div className="cart-sticky">
          <div>
            <strong>{totalPlates} item{totalPlates === 1 ? '' : 's'}</strong>
            <span className="cart-sticky__total">{formatINR(totalAmount)}</span>
            <p className="cart-sticky__hint">{tableNumber ? `Table ${tableNumber}` : 'Set table to submit'}</p>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={submitOrder}
            disabled={submitting || hasUnavailable}
          >
            {submitting ? 'Sending…' : 'Submit order'}
          </button>
        </div>
      )}
    </div>
  );
}

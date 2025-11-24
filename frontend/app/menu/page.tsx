'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/currency';
import { useToast } from '@/components/ToastProvider';
import { readCartDraft, writeCartDraft } from '@/lib/cart';

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const ct = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    if (ct.includes('application/json')) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
    }
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  if (ct.includes('application/json')) return res.json();
  throw new Error('Unexpected response type');
};

const CART_TIMEOUT = 4000;

export default function MenuPage() {
  const router = useRouter();
  const { push } = useToast();
  const { data, error, isLoading } = useSWR<MenuItem[]>('/api/menu', fetcher);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [tableNumber, setTableNumber] = useState('');

  const [draft, setDraft] = useState<Record<string, number>>(() => (typeof window === 'undefined' ? {} : readCartDraft()));
  const [submitting, setSubmitting] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('guest.tableNumber');
    if (stored) setTableNumber(stored);
  }, []);

  useEffect(() => {
    writeCartDraft(draft);
  }, [draft]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((item) => item.category && set.add(item.category));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [data]);

  const filteredItems = useMemo(() => {
    let list = (data ?? []).slice();
    if (onlyAvailable) list = list.filter((item) => item.isAvailable !== false);
    if (cat !== 'all') list = list.filter((item) => (item.category ?? '') === cat);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((item) => {
        const name = item.name.toLowerCase();
        const desc = (item.description ?? '').toLowerCase();
        const category = (item.category ?? '').toLowerCase();
        return name.includes(s) || desc.includes(s) || category.includes(s);
      });
    }
    return list;
  }, [data, q, cat, onlyAvailable]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number | null | undefined>();
    (data ?? []).forEach((item) => {
      map.set(item._id, item.stock ?? null);
    });
    return map;
  }, [data]);

  const selectedItems = useMemo(() => {
    if (!data) return [] as Array<{ item: MenuItem; quantity: number }>;
    return Object.entries(draft)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = data.find((m) => m._id === id);
        return item ? { item, quantity: qty } : null;
      })
      .filter(Boolean) as Array<{ item: MenuItem; quantity: number }>;
  }, [draft, data]);

  const totalPlates = useMemo(() => selectedItems.reduce((sum, entry) => sum + entry.quantity, 0), [selectedItems]);
  const totalAmount = useMemo(
    () => selectedItems.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0),
    [selectedItems]
  );

  const showCartNow = useCallback(() => {
    if (!selectedItems.length) return;
    setCartVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setCartVisible(false), CART_TIMEOUT);
  }, [selectedItems.length]);

  useEffect(() => {
    if (!selectedItems.length) {
      setCartVisible(false);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      return;
    }
    showCartNow();
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, [selectedItems, showCartNow]);

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
        return next;
      });
    },
    [stockMap]
  );

  const handleSetTable = useCallback(() => {
    if (typeof window === 'undefined') return;
    const entry = window.prompt('Enter your table number or code');
    if (!entry) return;
    const trimmed = entry.trim();
    if (!trimmed) return;
    setTableNumber(trimmed);
    window.localStorage.setItem('guest.tableNumber', trimmed);
    window.dispatchEvent(new CustomEvent('table-number-change', { detail: trimmed }));
  }, []);

  const submitOrder = useCallback(async () => {
    if (!selectedItems.length || submitting) return;
    if (!tableNumber.trim()) {
      push({ title: 'Assign a table', description: 'Please set a table before placing an order.', variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: tableNumber.trim(),
          status: 'ordered',
          source: 'table',
          items: selectedItems.map(({ item, quantity }) => ({ menuItem: item._id, quantity }))
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Failed to place order');
      }
      push({ title: 'Order sent', description: 'The kitchen received your request.', variant: 'success' });
      setDraft({});
      writeCartDraft({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      push({
        title: 'Unable to submit',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  }, [selectedItems, submitting, tableNumber, push]);

  const showError = Boolean(error);
  const showLoading = isLoading && !data;

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Menu explorer</span>
        <h1 className="hero__title">Dish discovery for every guest</h1>
        <p className="hero__text">
          Search, filter, and keep tabs on availability. Add plates to your cart and we&apos;ll route the order to the
          right table.
        </p>
      </section>

      <section className="control-bar">
        <input
          placeholder="Search dishes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search dishes"
        />

        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : c}
            </option>
          ))}
        </select>

        <label className="labelled-control labelled-control--checkbox">
          <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
          Only available
        </label>
      </section>

      {selectedItems.length > 0 && (
        <div className="menu-cart-toggle-wrapper">
          <button
            type="button"
            className="app-nav__toggle menu-cart-toggle"
            onClick={showCartNow}
            aria-label="Show cart summary"
          >
            🛒
          </button>
        </div>
      )}

      <section className="menu-table-chip">
        <div>
          <p className="menu-table-chip__label">{tableNumber ? `Table ${tableNumber}` : 'No table selected'}</p>
          <p className="menu-table-chip__hint">Orders will be routed to this table. Change it anytime.</p>
        </div>
        <button className="btn btn--ghost" type="button" onClick={handleSetTable}>
          {tableNumber ? 'Change table' : 'Set table'}
        </button>
      </section>

      {showError && <p className="muted">Failed to load menu: {error instanceof Error ? error.message : 'Error'}</p>}
      {showLoading && <p className="muted">Loading menu…</p>}

      {!showError && !showLoading && (
        <>
          <div className="grid grid--cols-auto">
            {filteredItems.map((item) => {
              const availabilityClass =
                item.isAvailable === false ? 'status status--danger' : 'status status--success';
              const availabilityText = item.isAvailable === false ? 'Sold out' : 'Available';
              const lowStock =
                item.isAvailable !== false &&
                typeof item.stock === 'number' &&
                item.lowStockThreshold !== null &&
                item.lowStockThreshold !== undefined &&
                item.stock !== null &&
                item.stock <= item.lowStockThreshold;
              return (
                <article key={item._id} className="card card--interactive card--tight">
                  {item.imageUrl ? (
                    <div className="card__media">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="(max-width: 480px) 90vw, (max-width: 1024px) 40vw, 320px"
                        className="card__media-image"
                      />
                    </div>
                  ) : null}
                  <div className="card__body">
                    <div className="card__title">{item.name}</div>
                    <div className="card__meta">
                      {item.category ? `${item.category} • ` : ''}
                      {formatINR(item.price)}
                    </div>
                    {item.description ? <p className="muted">{item.description}</p> : null}
                    <div className="pill-group">
                      <span className={availabilityClass}>{availabilityText}</span>
                      {(item.tags ?? []).slice(0, 3).map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                      {lowStock ? <span className="tag tag--accent">Only {item.stock} left</span> : null}
                    </div>
                    <div className="menu-card__actions">
                      <div className="qty-pill">
                        <button
                          type="button"
                          onClick={() => adjustQuantity(item._id, -1)}
                          disabled={!draft[item._id]}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span>{draft[item._id] ?? 0}</span>
                        <button
                          type="button"
                          onClick={() => adjustQuantity(item._id, 1)}
                          disabled={item.isAvailable === false}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <Link href={`/dish/${item._id}`} className="btn btn--ghost">
                        View dish
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="card card--stacked">
              <h3 className="section-heading">No dishes found</h3>
              <p className="section-subtitle">Try clearing filters or searching for something else.</p>
            </div>
          )}
        </>
      )}

      {selectedItems.length > 0 && cartVisible && (
        <div className="menu-cart-bar">
          <div>
            <strong>{totalPlates} item{totalPlates === 1 ? '' : 's'} selected</strong>
            <span className="menu-cart-bar__meta">{formatINR(totalAmount)}</span>
            <p className="menu-cart-bar__hint">
              {tableNumber ? `Table ${tableNumber}` : 'Set a table before you submit the order'}
            </p>
          </div>
          <div className="menu-cart-bar__actions">
            <button
              type="button"
              className="btn btn--primary btn--pill"
              onClick={submitOrder}
              disabled={submitting || !tableNumber.trim()}
            >
              {submitting ? 'Sending…' : 'Send order'}
            </button>
            <button
              type="button"
              className="btn btn--cart btn--pill"
              style={{ background: '#f97316', color: '#fff' }}
              onClick={() => router.push('/cart')}
            >
              View cart
            </button>
            <button type="button" className="btn btn--ghost btn--pill" onClick={() => setDraft({})}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import useSWR, { mutate } from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/components/ToastProvider';
import { formatINR } from '@/lib/currency';

type MenuItem = {
  _id: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  imageUrl?: string;
  tags?: string[];
  isAvailable?: boolean;
  stock?: number | null;
  lowStockThreshold?: number | null;
};

type OrderItem = { itemId?: string; menuItem?: string; name?: string; quantity?: number };
type Order = {
  _id: string;
  tableNumber?: number | string;
  status?: 'ordered' | 'preparing' | 'served';
  items: OrderItem[];
  createdAt: string;
  servedAt?: string;
};

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function AdminPage() {
  const router = useRouter();
  const { push } = useToast();
  const { data: menu, error: menuErr, isLoading: menuLoading } = useSWR<MenuItem[]>('/api/menu', fetcher);
  const { data: orders, error: ordErr, isLoading: ordLoading } = useSWR<Order[]>('/api/orders?hours=24', fetcher, {
    refreshInterval: 8000
  });

  // Create dish form state
  const [draft, setDraft] = useState({
    name: '',
    price: '',
    category: '',
    imageUrl: '',
    description: '',
    stock: '',
    lowStockThreshold: ''
  });
  const [creating, setCreating] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function uploadImage() {
    if (!file) { push({ title: 'Pick an image first', variant: 'error' }); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include', // send session cookie
        body: form,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Upload failed');
      }
      const data = await res.json();
      setUploadedUrl(data.url);
      setDraft(d => ({ ...d, imageUrl: data.url }));
      push({ title: 'Image uploaded', variant: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error';
      push({ title: 'Upload failed', description: message, variant: 'error' });
    } finally {
      setUploading(false);
    }
  }

  const [menuLoadingState, setMenuLoadingState] = useState<Record<string, boolean>>({});
  const [orderLoadingState, setOrderLoadingState] = useState<Record<string, boolean>>({});
  const [menuDeletingState, setMenuDeletingState] = useState<Record<string, boolean>>({});

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    router.replace('/admin/login');
    push({ title: 'Signed out', variant: 'success' });
  }

  async function createItem() {
    const price = Number(draft.price);
    const stockValue = draft.stock.trim() === '' ? undefined : Number(draft.stock);
    const thresholdValue =
      draft.lowStockThreshold.trim() === '' ? undefined : Number(draft.lowStockThreshold);

    if (!draft.name.trim() || !Number.isFinite(price) || price <= 0) {
      push({ title: 'Name and a positive price are required', variant: 'error' });
      return;
    }
    if (stockValue !== undefined && (!Number.isFinite(stockValue) || stockValue < 0)) {
      push({ title: 'Stock must be zero or greater', variant: 'error' });
      return;
    }
    if (thresholdValue !== undefined && (!Number.isFinite(thresholdValue) || thresholdValue < 0)) {
      push({ title: 'Threshold must be zero or greater', variant: 'error' });
      return;
    }
    if (
      stockValue !== undefined &&
      stockValue !== null &&
      thresholdValue !== undefined &&
      thresholdValue !== null &&
      thresholdValue > stockValue
    ) {
      push({ title: 'Threshold cannot exceed stock', variant: 'error' });
      return;
    }
    setCreating(true);
    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: draft.name.trim(),
        price,
        category: draft.category || undefined,
        imageUrl: (draft.imageUrl || uploadedUrl) || undefined,
        description: draft.description || undefined,
        isAvailable: true,
        stock: stockValue ?? undefined,
        lowStockThreshold: thresholdValue ?? undefined
      })
    });
    if (!res.ok) {
      const t = await res.text();
      push({ title: 'Failed to create dish', description: t, variant: 'error' });
    } else {
      setDraft({
        name: '',
        price: '',
        category: '',
        imageUrl: '',
        description: '',
        stock: '',
        lowStockThreshold: ''
      });
      setFile(null); setPreview(null); setUploadedUrl('');
      push({ title: 'Dish created', variant: 'success' });
      mutate('/api/menu');
    }
    setCreating(false);
  }

  async function toggleAvailability(item: MenuItem) {
    setMenuLoadingState((prev) => ({ ...prev, [item._id]: true }));
    const res = await fetch(`/api/menu/${item._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isAvailable: item.isAvailable === false ? true : false })
    });
    if (!res.ok) {
      const t = await res.text();
      push({ title: 'Failed to update availability', description: t, variant: 'error' });
    } else {
      push({ title: item.isAvailable === false ? 'Marked available' : 'Marked sold out', variant: 'success' });
      mutate('/api/menu');
    }
    setMenuLoadingState((prev) => {
      const next = { ...prev };
      delete next[item._id];
      return next;
    });
  }

  async function editInventory(item: MenuItem) {
    if (typeof window === 'undefined') return;

    const stockEntry = window.prompt(
      `Set available stock for "${item.name}" (leave blank for unlimited)`,
      item.stock !== null && item.stock !== undefined ? String(item.stock) : ''
    );
    if (stockEntry === null) return;

    const payload: Record<string, unknown> = {};
    const trimmedStock = stockEntry.trim();
    if (trimmedStock === '') {
      payload.stock = null;
    } else {
      const stockValue = Number(trimmedStock);
      if (!Number.isFinite(stockValue) || stockValue < 0) {
        push({ title: 'Invalid stock value', variant: 'error' });
        return;
      }
      payload.stock = stockValue;
    }

    const thresholdEntry = window.prompt(
      `Set low-stock alert threshold for "${item.name}" (optional, leave blank to clear)`,
      item.lowStockThreshold !== null && item.lowStockThreshold !== undefined ? String(item.lowStockThreshold) : ''
    );
    if (thresholdEntry === null) return;
    const trimmedThreshold = thresholdEntry.trim();
    if (trimmedThreshold === '') {
      payload.lowStockThreshold = null;
    } else {
      const thresholdValue = Number(trimmedThreshold);
      if (!Number.isFinite(thresholdValue) || thresholdValue < 0) {
        push({ title: 'Invalid threshold value', variant: 'error' });
        return;
      }

      const effectiveStock =
        payload.stock === undefined
          ? item.stock ?? null
          : (payload.stock as number | null);

      if (
        effectiveStock !== null &&
        typeof effectiveStock === 'number' &&
        thresholdValue > effectiveStock
      ) {
        push({ title: 'Threshold cannot exceed stock', variant: 'error' });
        return;
      }

      payload.lowStockThreshold = thresholdValue;
    }

    const effectiveStockAfterUpdate =
      payload.stock === undefined ? item.stock ?? null : payload.stock;
    if (
      payload.isAvailable === undefined &&
      item.isAvailable === false &&
      (
        (typeof effectiveStockAfterUpdate === 'number' && effectiveStockAfterUpdate > 0) ||
        effectiveStockAfterUpdate === null
      )
    ) {
      payload.isAvailable = true;
    }

    if (Object.keys(payload).length === 0) {
      push({ title: 'No inventory changes applied', variant: 'default' });
      return;
    }

    setMenuLoadingState((prev) => ({ ...prev, [item._id]: true }));
    const res = await fetch(`/api/menu/${item._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const t = await res.text();
      push({ title: 'Inventory update failed', description: t, variant: 'error' });
    } else {
      push({ title: 'Inventory updated', variant: 'success' });
      mutate('/api/menu');
    }
    setMenuLoadingState((prev) => {
      const next = { ...prev };
      delete next[item._id];
      return next;
    });
  }

  async function deleteItem(item: MenuItem) {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete "${item.name}" from the menu? This cannot be undone.`);
      if (!confirmed) return;
    }

    setMenuDeletingState((prev) => ({ ...prev, [item._id]: true }));
    const res = await fetch(`/api/menu/${item._id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) {
      const t = await res.text();
      push({ title: 'Delete failed', description: t, variant: 'error' });
    } else {
      push({ title: 'Dish removed', variant: 'success' });
      mutate('/api/menu');
    }
    setMenuDeletingState((prev) => {
      const next = { ...prev };
      delete next[item._id];
      return next;
    });
  }

  async function markServed(orderId: string) {
    setOrderLoadingState((prev) => ({ ...prev, [orderId]: true }));
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'served' })
    });
    if (!res.ok) {
      const t = await res.text();
      push({ title: 'Failed to mark served', description: t, variant: 'error' });
    } else {
      push({ title: 'Order marked served', variant: 'success' });
      mutate('/api/orders?hours=24');
    }
    setOrderLoadingState((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }

  const activeOrders = useMemo(() => (orders ?? []).filter(o => o.status !== 'served'), [orders]);

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Back of house</span>
        <h1 className="hero__title">Keep the floor moving and the menu sharp</h1>
        <p className="hero__text">
          Update dishes in seconds, monitor active tickets, and react to the dining room pulse with real-time data.
        </p>
        <div className="pill-group">
          <button className="btn btn--ghost" type="button" onClick={logout}>Sign out</button>
        </div>
      </section>

      {/* Create dish */}
      <section className="card card--stacked">
        <h2 className="section-heading">Add a new dish</h2>
        <p className="section-subtitle">Launch a special or seasonal feature straight to the live menu.</p>

        <div className="grid grid--cols-auto">
          <input placeholder="Dish name" value={draft.name}
                 onChange={(e) => setDraft({ ...draft, name: e.target.value })}/>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
          <input placeholder="Category (e.g. Mains)" value={draft.category}
                 onChange={(e) => setDraft({ ...draft, category: e.target.value })}/>
          <input placeholder="Image URL (optional)" value={draft.imageUrl}
                 onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}/>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Available stock (optional)"
            value={draft.stock}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
          />
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Low-stock threshold (optional)"
            value={draft.lowStockThreshold}
            onChange={(e) => setDraft({ ...draft, lowStockThreshold: e.target.value })}
          />
        </div>

        {/* Image upload block */}
        <div className="grid" style={{ gap: 8 }}>
          <div className="pill-group" style={{ alignItems: 'center' }}>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button className="btn btn--ghost" type="button" onClick={uploadImage} disabled={!file || uploading}>
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            {uploadedUrl && <span className="chip chip--success">Uploaded ✓</span>}
          </div>
          {preview && (
            <Image
              src={preview}
              alt="Preview"
              width={320}
              height={200}
              style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }}
            />
          )}
        </div>

        <textarea placeholder="Description" rows={3} value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}/>

        <div>
          <button className="btn btn--primary" type="button" onClick={createItem} disabled={creating}>
            {creating ? 'Creating…' : 'Create dish'}
          </button>
        </div>
      </section>

      {/* Menu items */}
      <section className="card card--stacked">
        <div className="page__header">
          <div>
            <h2 className="section-heading">Menu items</h2>
            <p className="section-subtitle">Toggle availability as service evolves.</p>
          </div>
          <span className="chip">Total {menu?.length ?? 0}</span>
        </div>
        {menuLoading && <p className="muted">Loading menu…</p>}
        {menuErr && <p className="muted">Failed to load menu.</p>}
        {!menuLoading && !menuErr && (
          <div className="grid grid--cols-auto">
            {(menu ?? []).map((mi) => {
              const availabilityClass =
                mi.isAvailable === false ? 'status status--danger' : 'status status--success';
              const availabilityText = mi.isAvailable === false ? 'Sold out' : 'Available';
              const stockValue = mi.stock ?? null;
              const hasFiniteStock = typeof stockValue === 'number' && Number.isFinite(stockValue);
              const lowStock =
                hasFiniteStock &&
                stockValue > 0 &&
                mi.lowStockThreshold !== undefined &&
                mi.lowStockThreshold !== null &&
                stockValue <= mi.lowStockThreshold;

              return (
                <article key={mi._id} className="card card--interactive card--tight">
                  {/* Show image if present */}
                  {mi.imageUrl ? (
                    <Image
                      src={mi.imageUrl}
                      alt={mi.name}
                      width={400}
                      height={230}
                      style={{
                        width: '100%',
                        height: 180,
                        objectFit: 'cover',
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8
                      }}
                    />
                  ) : null}

                    <div className="card__body">
                      <div className="card__title">{mi.name}</div>
                      <div className="card__meta">
                        {mi.category ?? 'Uncategorised'} • {formatINR(mi.price)}
                      </div>
                      <div className="pill-group">
                        <span className={availabilityClass}>{availabilityText}</span>
                        {(mi.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                      <div className="pill-group">
                        {hasFiniteStock ? (
                          <span className={`tag ${lowStock ? 'tag--accent' : ''}`}>
                            Stock: {stockValue}
                            {mi.lowStockThreshold !== undefined && mi.lowStockThreshold !== null
                              ? ` (alert at ${mi.lowStockThreshold})`
                              : ''}
                          </span>
                        ) : (
                          <span className="tag">Stock: unlimited</span>
                        )}
                      </div>
                      <div className="pill-group">
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => toggleAvailability(mi)}
                          disabled={Boolean(menuLoadingState[mi._id])}
                        >
                          {menuLoadingState[mi._id]
                            ? 'Updating…'
                            : mi.isAvailable === false
                            ? 'Mark available'
                            : 'Mark sold out'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => editInventory(mi)}
                          disabled={Boolean(menuLoadingState[mi._id])}
                        >
                          Edit inventory
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--danger"
                          onClick={() => deleteItem(mi)}
                          disabled={Boolean(menuDeletingState[mi._id])}
                        >
                          {menuDeletingState[mi._id] ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Active orders */}
      <section className="card card--stacked">
        <div className="page__header">
          <div>
            <h2 className="section-heading">Active orders</h2>
            <p className="section-subtitle">Close tickets right from the dashboard.</p>
          </div>
        <span className="chip chip--accent">{activeOrders.length} in progress</span>
        </div>
        {ordLoading && <p className="muted">Loading orders…</p>}
        {ordErr && <p className="muted">Failed to load orders.</p>}

        {!ordLoading && !ordErr && (
          <div className="live-feed">
            {activeOrders.map((o) => (
              <article key={o._id} className="live-feed__item">
                <div className="live-feed__meta">
                  <div className="live-feed__meta-left">
                    <strong>Table {o.tableNumber ?? '—'}</strong>
                    <span>{new Date(o.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="live-feed__meta-right">
                    <span className="status status--accent">{o.status ?? 'ordered'}</span>
                    <span className="chip">#{o._id.slice(-6)}</span>
                  </div>
                </div>
                <div className="pill-group">
                  {o.items.map((it, idx) => (
                    <span key={idx} className="tag">
                      {(it.name ?? 'Dish')} × {it.quantity ?? 1}
                    </span>
                  ))}
                </div>
                <div>
                  <button
                    className="btn btn--primary"
                    type="button"
                    onClick={() => markServed(o._id)}
                    disabled={Boolean(orderLoadingState[o._id])}
                  >
                    {orderLoadingState[o._id] ? 'Updating…' : 'Mark served'}
                  </button>
                </div>
              </article>
            ))}
            {activeOrders.length === 0 && <p className="muted">No active orders right now.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { formatINR } from '@/lib/currency'; // ← make sure lib/currency.ts exists

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

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function MenuPage() {
  const { data, error, isLoading } = useSWR<MenuItem[]>('/api/menu', fetcher, { refreshInterval: 0 });
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach(i => i.category && set.add(i.category));
    return ['all', ...Array.from(set).sort()];
  }, [data]);

  const items = useMemo(() => {
    let list = (data ?? []).slice();
    if (onlyAvailable) list = list.filter(i => i.isAvailable !== false);
    if (cat !== 'all') list = list.filter(i => (i.category ?? '') === cat);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(s) ||
        (i.description ?? '').toLowerCase().includes(s) ||
        (i.category ?? '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [data, q, cat, onlyAvailable]);

  const showLoading = isLoading && !data;
  const showError = Boolean(error);

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Menu explorer</span>
        <h1 className="hero__title">Dish discovery for every guest</h1>
        <p className="hero__text">
          Search, filter, and celebrate the standouts from your kitchen. Keep availability up-to-date and let guests fall
          in love with their next favourite plate.
        </p>
      </section>

      <section className="control-bar">
        <input
          placeholder="Search dishes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search dishes"
        />

        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Filter by category"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : c}
            </option>
          ))}
        </select>

        <label className="labelled-control">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          Only available
        </label>
      </section>

      {showError && <p className="muted">Failed to load menu. Please refresh.</p>}
      {showLoading && <p className="muted">Loading menu…</p>}

      {!showError && !showLoading && (
        <>
          <div className="grid grid--cols-auto">
            {items.map((item) => {
              const availabilityClass =
                item.isAvailable === false ? 'status status--danger' : 'status status--success';
              const availabilityText = item.isAvailable === false ? 'Sold out' : 'Available';
              const lowStock =
                item.isAvailable !== false &&
                item.stock !== undefined &&
                item.stock !== null &&
                item.stock > 0 &&
                item.lowStockThreshold !== undefined &&
                item.lowStockThreshold !== null &&
                item.stock <= item.lowStockThreshold;

              return (
                <article key={item._id} className="card card--interactive card--tight">
                  {item.imageUrl ? (
                    <div className="card__media">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 320px"
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
                      {lowStock ? (
                        <span className="tag tag--accent">Only {item.stock} left</span>
                      ) : null}
                      <div className="pill-group">
                        <span className={availabilityClass}>{availabilityText}</span>
                        {(item.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                        </span>
                      ))}
                    </div>
                    <Link href={`/dish/${item._id}`} className="btn btn--ghost">
                      View dish
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {items.length === 0 && (
            <div className="card card--stacked">
              <h3 className="section-heading">No dishes found</h3>
              <p className="section-subtitle">Adjust your filters or clear the search to see everything available.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

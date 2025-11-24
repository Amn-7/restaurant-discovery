'use client';

import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Stars from '@/components/Stars';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { formatINR } from '@/lib/currency';

type MenuItem = {
  _id: string;
  name: string;
  description?: string;
  // price can arrive as number OR string from Mongo
  price?: number | string | null;
  imageUrl?: string;
  category?: string;
  tags?: string[];
};
type Review = { _id: string; menuItem: string; rating: number; comment?: string; createdAt: string };
type RatingsSummary = {
  since: string;
  hours: number;
  sort: 'count' | 'avg';
  items: { menuItem: string | null; count: number; avg: number }[];
};

// fetcher that throws on non-2xx (so SWR shows error state correctly)
const fetcher = async (u: string) => {
  const r = await fetch(u);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(text || `Request failed: ${r.status}`);
  }
  return r.json();
};

export default function DishPage() {
  const { id } = useParams<{ id: string }>();

  const { data: item, error: itemErr, isLoading: itemLoading } = useSWR<MenuItem>(`/api/menu/${id}`, fetcher);
  const { data: reviews, isLoading: revLoading } = useSWR<Review[]>(
    `/api/reviews?menuItem=${id}&hours=720&limit=20`,
    fetcher
  );
  const { data: summary } = useSWR<RatingsSummary>(
    `/api/analytics/ratings?menuItem=${id}&hours=720&limit=1`,
    fetcher
  );

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const avg = useMemo(() => summary?.items?.[0]?.avg ?? 0, [summary]);
  const count = useMemo(() => summary?.items?.[0]?.count ?? 0, [summary]);

  async function submitReview() {
    if (!rating) return alert('Pick a rating 1–5');
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId: id, rating, comment })
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to submit review'));
      setRating(0);
      setComment('');
      // refresh lists/summaries
      mutate(`/api/reviews?menuItem=${id}&hours=720&limit=20`);
      mutate(`/api/analytics/ratings?menuItem=${id}&hours=720&limit=1`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error submitting review';
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (itemErr) {
    return (
      <div className="page">
        <div className="card card--stacked">
          <h1 className="section-heading">We couldn’t find that dish</h1>
          <p className="section-subtitle">It may have been removed or renamed. Head back to the menu to explore more.</p>
        </div>
      </div>
    );
  }

  if (itemLoading || !item) {
    return (
      <div className="page">
        <div className="card card--stacked">
          <p className="muted">Loading dish…</p>
        </div>
      </div>
    );
  }

  const priceLabel =
    item.price === undefined || item.price === null
      ? '—'
      : formatINR(item.price as number | string);

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Signature dish</span>
        <h1 className="hero__title">{item.name}</h1>
        <div className="pill-group">
          <Stars value={avg} readOnly ariaLabel="average rating" />
          <span className="chip">
            {avg ? `${avg.toFixed(1)} / 5` : 'No ratings yet'}
            {count ? ` • ${count} review${count > 1 ? 's' : ''}` : ''}
          </span>
        </div>
      </section>

      {item.imageUrl ? (
        <div className="card card--flush">
          <div className="card__media">
            <Image
              src={item.imageUrl.startsWith('http') ? `${item.imageUrl}${item.imageUrl.includes('?') ? '&' : '?'}w=800&h=600&c_fill&f_auto&q=70` : item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 480px) 100vw, 640px"
              priority
              className="card__media-image"
            />
          </div>
        </div>
      ) : null}

      <section className="card card--stacked">
        {item.category ? <span className="chip chip--accent">{item.category}</span> : null}
        {item.description ? <p>{item.description}</p> : null}
        <div className="section-heading">{priceLabel}</div>
        <div className="pill-group">
          {(item.tags ?? []).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="card card--stacked">
        <h2 className="section-heading">Add your rating</h2>
        <p className="section-subtitle">Share a quick note — it helps others decide what to try next.</p>
        <Stars value={rating} onChange={setRating} ariaLabel="set your rating" />
        <textarea
          placeholder="Optional short comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
        <div>
          <button className="btn btn--primary" type="button" onClick={submitReview} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </section>

      <section className="card card--stacked">
        <h2 className="section-heading">Recent reviews</h2>
        <p className="section-subtitle">Fresh voices from guests who just dined.</p>

        {(revLoading || !reviews) && <p className="muted">Loading reviews…</p>}
        {reviews && reviews.length === 0 && <p className="muted">No reviews yet. Be the first!</p>}
        {reviews && reviews.length > 0 && (
          <ul className="list-reset grid">
            {reviews.map((r) => (
              <li key={r._id} className="card card--interactive card--tight">
                <div className="card__body">
                  <div className="page__header page__header--compact">
                    <Stars value={r.rating} readOnly ariaLabel="user rating" />
                    <span className="chip">
                      {new Date(r.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {r.comment ? <p>{r.comment}</p> : <p className="muted">No comment provided.</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

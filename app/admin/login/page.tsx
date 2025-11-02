'use client';

import { Suspense, FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [key, setKey] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath = searchParams?.get('next') || '/admin';

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/login', { method: 'GET' })
      .then(res => res.json())
      .then((data) => {
        if (!cancelled && data?.authenticated) {
          router.replace(nextPath);
        }
      })
      .catch(() => {
        // ignore status check failures
      });
    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, rememberMe }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to sign in');
      }
      router.replace(nextPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">Admin access</span>
        <h1 className="hero__title">Sign in to manage the floor</h1>
        <p className="hero__text">
          Enter the admin key provided for this venue. Guests can continue exploring the menu without signing in.
        </p>
      </section>

      <section className="card card--stacked" style={{ maxWidth: 420 }}>
        <form onSubmit={handleSubmit} className="page" style={{ gap: 'var(--space-sm)' }}>
          <label className="labelled-control" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Admin key</span>
            <input
              type="password"
              placeholder="Enter admin key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="labelled-control" style={{ justifyContent: 'flex-start' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me on this device
          </label>

          {error ? <p style={{ color: 'crimson', fontSize: '0.9rem' }}>{error}</p> : null}

          <button className="btn btn--primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="page"><p className="muted">Loading…</p></div>}>
      <AdminLoginForm />
    </Suspense>
  );
}

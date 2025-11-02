import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPopular } from '@/app/api/analytics/popular/route';
import { GET as getRatings } from '@/app/api/analytics/ratings/route';
import { GET as getTrends } from '@/app/api/analytics/trends/route';

describe('Analytics API routes', () => {
  it('returns popular items with comparison window', async () => {
    const req = new NextRequest('http://localhost/api/analytics/popular?hours=6&limit=5&compare=1');
    const res = await getPopular(req);
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.previous).toBeDefined();
    expect(Array.isArray(payload.previous.items)).toBe(true);
  });

  it('filters popular dishes by category', async () => {
    const category = 'Starters';
    const req = new NextRequest(
      `http://localhost/api/analytics/popular?hours=12&limit=10&compare=0&category=${encodeURIComponent(category)}`
    );
    const res = await getPopular(req);
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.items.every((item: { category?: string | null }) => item.category === category)).toBe(true);
  });

  it('returns ratings sorted by average score', async () => {
    const req = new NextRequest('http://localhost/api/analytics/ratings?hours=48&limit=5&sort=avg');
    const res = await getRatings(req);
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThan(0);

    const averages = payload.items.map((item: { avg: number }) => item.avg);
    const sorted = [...averages].sort((a, b) => b - a);
    expect(averages).toEqual(sorted);
  });

  it('returns rising and falling trends for multiple windows', async () => {
    const req = new NextRequest('http://localhost/api/analytics/trends?windows=6,24&limit=4');
    const res = await getTrends(req);
    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(Array.isArray(payload.windows)).toBe(true);
    expect(payload.windows.length).toBeGreaterThan(0);

    payload.windows.forEach((window: { hours: number; rising: unknown[]; falling: unknown[]; steady: unknown[] }) => {
      expect(typeof window.hours).toBe('number');
      expect(Array.isArray(window.rising)).toBe(true);
      expect(Array.isArray(window.falling)).toBe(true);
      expect(Array.isArray(window.steady)).toBe(true);
    });
  });
});

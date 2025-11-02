import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/reviews/route';
import { dbConnect } from '@/lib/db';
import MenuItem from '@/models/MenuItem';
import { ensureDemoData } from '@/lib/demoSeed';

const reviewsUrl = 'http://localhost/api/reviews';

describe('Reviews API', () => {
  beforeEach(async () => {
    await dbConnect();
    await ensureDemoData();
  });

  it('lists recent reviews', async () => {
    const request = new NextRequest(`${reviewsUrl}?hours=24&limit=5`, { method: 'GET' });
    const response = await GET(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThan(0);
  });

  it('allows submitting a new review', async () => {
    const menuItem = await MenuItem.findOne().lean();
    expect(menuItem).toBeTruthy();

    const request = new NextRequest(reviewsUrl, {
      method: 'POST',
      body: JSON.stringify({
        menuItemId: menuItem!._id.toString(),
        rating: 5,
        comment: 'Fantastic dish from automated test'
      }),
      headers: { 'content-type': 'application/json' }
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const payload = await response.json();
    expect(payload.menuItem).toBe(menuItem!._id.toString());
    expect(payload.rating).toBe(5);
  });
});

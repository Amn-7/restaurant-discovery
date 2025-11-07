import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/orders/route';
import { dbConnect } from '@/lib/db';
import MenuItem from '@/models/MenuItem';
import Order from '@/models/Order';
import { ensureDemoData } from '@/lib/demoSeed';

const ordersUrl = 'http://localhost/api/orders';

describe('Orders API', () => {
  beforeEach(async () => {
    await dbConnect();
    await ensureDemoData();
  });

  it('allows a guest table to create a new order', async () => {
    const item = await MenuItem.findOne().lean();
    expect(item).toBeTruthy();

    const payload = {
      tableNumber: '42',
      source: 'table',
      notificationPhone: '+1234567890',
      items: [
        { menuItem: item!._id.toString(), quantity: 2 }
      ]
    };

    const request = new NextRequest(ordersUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' }
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.tableNumber).toBe('42');
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(2);

    const stored = await Order.findById(body._id).lean();
    expect(stored).toBeTruthy();
    expect(stored?.source).toBe('table');
    expect(stored?.notificationPhone).toBe('+1234567890');
  });

  it('returns recent orders', async () => {
    const listRequest = new NextRequest(`${ordersUrl}?hours=24`, { method: 'GET' });
    const listResponse = await GET(listRequest);
    expect(listResponse.status).toBe(200);

    const orders = await listResponse.json();
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const uploadUrl = 'http://localhost/api/upload';
const loginUrl = 'http://localhost/api/admin/login';

const { uploadStreamMock, configMock } = vi.hoisted(() => {
  const streamMock = vi.fn((_options: unknown, callback: (err: unknown, result: { secure_url: string; public_id: string; width: number; height: number; format: string }) => void) => ({
    end: () =>
      callback(null, {
        secure_url: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
        public_id: 'test',
        width: 640,
        height: 480,
        format: 'jpg'
      })
  }));

  return {
    uploadStreamMock: streamMock,
    configMock: vi.fn()
  };
});

vi.mock('cloudinary', () => ({
  v2: {
    config: configMock,
    uploader: {
      upload_stream: uploadStreamMock
    }
  }
}));

const ADMIN_KEY = 'aman';

beforeAll(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'demo-name';
  process.env.CLOUDINARY_API_KEY = 'demo-key';
  process.env.CLOUDINARY_API_SECRET = 'demo-secret';
  process.env.CLOUDINARY_UPLOAD_FOLDER = 'restaurant/menu';
  process.env.CLOUDINARY_UPLOAD_PRESET = 'restaurant-menu';
  if (!process.env.IRON_SESSION_PASSWORD || process.env.IRON_SESSION_PASSWORD.length < 32) {
    process.env.IRON_SESSION_PASSWORD = 'abcdefghijklmnopqrstuvwxyz012345678901234567';
  }
  process.env.ADMIN_KEY = ADMIN_KEY;
  // Note: NODE_ENV is read-only in some environments, but for tests we can set it
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
});

beforeEach(() => {
  vi.clearAllMocks();
});

const FileCtor =
  typeof File === 'undefined'
    ? class PolyfillFile extends Blob {
        name: string;
        lastModified: number;
        constructor(parts: BlobPart[], filename: string, options: FilePropertyBag = {}) {
          super(parts, options);
          this.name = filename;
          this.lastModified = options.lastModified ?? Date.now();
        }
      }
    : File;

function createJpegFile(name: string) {
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03]);
  return new FileCtor([header], name, { type: 'image/jpeg' }) as unknown as File;
}

async function loginAsAdmin() {
  const { POST } = await import('@/app/api/admin/login/route');

  const request = new NextRequest(loginUrl, {
    method: 'POST',
    body: JSON.stringify({ key: ADMIN_KEY }),
    headers: { 'content-type': 'application/json' }
  });

  const response = await POST(request);
  if (response.status !== 200) {
    throw new Error(`Admin login failed with status ${response.status}`);
  }

  const raw = response.headers.get('set-cookie') ?? '';
  const sessionCookie = raw
    .split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('restaurant_admin='))
    ?.split(';')[0] ?? '';
  return sessionCookie;
}

describe('Upload API', () => {
  it('rejects unauthenticated uploads', async () => {
    const form = new FormData();
    form.append('file', createJpegFile('unauth.jpg'));

    const request = new NextRequest(uploadUrl, {
      method: 'POST',
      body: form
    });

    const { POST } = await import('@/app/api/upload/route');
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('accepts authenticated uploads when Cloudinary succeeds', async () => {
    const cookie = await loginAsAdmin();
    expect(cookie).not.toEqual('');

    const form = new FormData();
    form.append('file', createJpegFile('auth.jpg'));

    const request = new NextRequest(uploadUrl, {
      method: 'POST',
      body: form,
      headers: { cookie }
    });

    const { POST } = await import('@/app/api/upload/route');
    const response = await POST(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.url).toContain('https://res.cloudinary.com/demo');
    expect(uploadStreamMock).toHaveBeenCalled();
  });
});

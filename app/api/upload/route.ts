export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { assertAdmin } from '@/lib/auth';

const REQUIRED_ENV = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
] as const;

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.warn(
    `[upload] Missing Cloudinary configuration keys: ${missingEnv.join(', ')}`
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif'] as const;

type AllowedFormat = (typeof ALLOWED_FORMATS)[number];

function sniffFormat(buffer: Buffer): AllowedFormat | null {
  if (buffer.length < 4) return null;

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.slice(0, 8).equals(pngSignature)) {
    return 'png';
  }

  // WEBP
  if (
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  // AVIF
  if (
    buffer.slice(4, 12).toString('ascii') === 'ftypavif' ||
    buffer.slice(4, 12).toString('ascii') === 'ftypavis'
  ) {
    return 'avif';
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const denied = await assertAdmin(req);
    if (denied) return denied;

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads allowed' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Max file size is 5MB' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedFormat = sniffFormat(buffer);
    if (!detectedFormat) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 415 });
    }

    if (!ALLOWED_FORMATS.includes(detectedFormat)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 415 });
    }

    if (process.env.NODE_ENV === 'production' && missingEnv.length) {
      console.error('[upload] Cloudinary credentials missing in production.');
      return NextResponse.json({ error: 'Upload misconfigured' }, { status: 500 });
    }

    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'restaurant/menu';
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          upload_preset: uploadPreset,
          use_filename: true,
          unique_filename: false,
          overwrite: false,
          allowed_formats: ALLOWED_FORMATS as unknown as string[],
          transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
        },
        (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          if (!res) {
            reject(new Error('Empty response from Cloudinary'));
            return;
          }
          resolve(res);
        }
      );
      stream.end(buffer);
    });

    return NextResponse.json(
      {
        url: result.secure_url as string,
        public_id: result.public_id as string,
        width: result.width,
        height: result.height,
        format: result.format,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

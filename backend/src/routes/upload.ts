import { Router, type Request } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { assertAdmin } from '../session.js';

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

const REQUIRED = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const;
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`[upload] Missing Cloudinary keys: ${missing.join(', ')}`);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const resolveLocalDir = () => {
  if (process.env.LOCAL_UPLOAD_DIR) return path.resolve(process.env.LOCAL_UPLOAD_DIR);
  // Default to frontend/public/uploads relative to repo root
  return path.resolve(process.cwd(), '../frontend/public/uploads');
};

const saveLocal = async (file: Express.Multer.File) => {
  const dir = resolveLocalDir();
  await fs.mkdir(dir, { recursive: true });
  const safeName = (file.originalname || 'upload.jpg').replace(/[^\w.-]+/g, '_');
  const filename = `${Date.now()}-${safeName}`;
  const target = path.join(dir, filename);
  await fs.writeFile(target, file.buffer);
  return { url: `/uploads/${filename}` };
};

router.post('/', assertAdmin, upload.single('file'), async (req: Request & { file?: Express.Multer.File }, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const canUseCloud = missing.length === 0 && process.env.LOCAL_UPLOAD_ONLY !== '1';
    if (canUseCloud) {
      const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'restaurant/menu';
      const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
      const originalName = req.file.originalname || 'upload';
      const safeName = originalName.replace(/[^\w.-]+/g, '_');
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const publicId = `${uniqueSuffix}-${safeName}`.replace(/\.+$/, '');
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
            upload_preset: uploadPreset || undefined,
            public_id: publicId,
            overwrite: false,
            transformation: [{ width: 1600, height: 1600, crop: 'limit' }]
          },
          (err, cloudResult) => (err ? reject(err) : resolve(cloudResult))
        );
        stream.end(req.file!.buffer);
      });
      return res.json({
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format
      });
    }
    const local = await saveLocal(req.file);
    return res.json(local);
  } catch (err) {
    console.error('[upload] failed', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;

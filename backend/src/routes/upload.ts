import { Router } from 'express';
import multer from 'multer';
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

router.post('/', assertAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    if (process.env.NODE_ENV === 'production' && missing.length) return res.status(500).json({ error: 'Upload misconfigured' });
    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'restaurant/menu';
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', upload_preset: uploadPreset, use_filename: true, unique_filename: false, overwrite: false, transformation: [{ width: 1600, height: 1600, crop: 'limit' }] },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(req.file!.buffer);
    });
    res.json({ url: result.secure_url, public_id: result.public_id, width: result.width, height: result.height, format: result.format });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;


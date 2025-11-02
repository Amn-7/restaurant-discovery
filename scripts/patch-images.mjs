import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = 'restaurant_order_discovery';

if (!uri) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

// Read all files from public/menu and build { dishName -> /menu/file.jpg }
const menuDir = join(process.cwd(), 'public', 'menu');
const images = {};
for (const file of readdirSync(menuDir)) {
  const name = basename(file, extname(file))
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  images[name] = `/menu/${file}`;
}

await mongoose.connect(uri, { dbName });
const col = mongoose.connection.db.collection('menuitems');

let updated = 0;
const missing = [];
for (const [name, url] of Object.entries(images)) {
  const res = await col.updateOne(
    { name },
    { $set: { imageUrl: url } },
    { collation: { locale: 'en', strength: 1 } }
  );
  if (res.matchedCount === 0) {
    missing.push(name);
    continue;
  }
  if (res.modifiedCount) {
    updated += 1;
  }
}

console.log(`Updated ${updated} menu items.`);
if (missing.length) {
  console.warn('No menu item match for:', missing.join(', '));
}
await mongoose.disconnect();

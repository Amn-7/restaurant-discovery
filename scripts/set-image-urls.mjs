// scripts/set-image-urls.mjs
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = 'restaurant_order_discovery';

if (!uri) {
  console.error('❌ Missing MONGODB_URI in .env.local');
  process.exit(1);
}

// Map dish name -> stable Unsplash URL (direct photo IDs)
const IMAGE_MAP = {
  'Truffle Mushroom Risotto': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80',
  'Margherita Pizza': 'https://images.unsplash.com/photo-1548365328-8b849f840a1f?auto=format&fit=crop&w=1200&q=80',
  'Spicy Pad Thai': 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80',
  'Slow-Braised Short Ribs': 'https://images.unsplash.com/photo-1481931098730-318b6f776db0?auto=format&fit=crop&w=1200&q=80',
  'Coconut Curry Ramen': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
  'Citrus Herb Salmon': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  'Smoky BBQ Jackfruit Burger': 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=1200&q=80',
  'Burrata Caprese Salad': 'https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=1200&q=80',
  'Fire-Grilled Prawns': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=1200&q=80',
  'Hand-cut Parmesan Fries': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
  'Charred Broccolini': 'https://images.unsplash.com/photo-1589308078054-832d8de93450?auto=format&fit=crop&w=1200&q=80',
  'Chili Lime Street Corn': 'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=1200&q=80',
  'Berry Cheesecake': 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
  'Dark Chocolate Mousse': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=80',
  'Crème Brûlée': 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=80',
  'Mango Lassi': 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80',
  'Sparkling Hibiscus Tea': 'https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?auto=format&fit=crop&w=1200&q=80',
  'Cold Brew Tonic': 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80',
  'Sunrise Smoothie Bowl': 'https://images.unsplash.com/photo-1528712306091-ed0763094c98?auto=format&fit=crop&w=1200&q=80',
  'Lobster Bisque': 'https://images.unsplash.com/photo-1506086679525-9f1d0efc83f9?auto=format&fit=crop&w=1200&q=80'
  // Add more here anytime (e.g., "Masala Chaas": "<unsplash-url>")
};

async function run() {
  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(uri, { dbName });
  const col = mongoose.connection.db.collection('menuitems');

  const ops = [];
  for (const [name, url] of Object.entries(IMAGE_MAP)) {
    ops.push({
      updateOne: {
        filter: { name },
        update: { $set: { imageUrl: url } },
        collation: { locale: 'en', strength: 2 } // case-insensitive match
      }
    });
  }

  const res = await col.bulkWrite(ops, { ordered: false });
  console.log('✅ Bulk update complete.');
  console.log('   Matched:', res.matchedCount, 'Modified:', res.modifiedCount);

  // Show which names didn’t match (helps you fix typos)
  for (const name of Object.keys(IMAGE_MAP)) {
    const doc = await col.findOne({ name }, { collation: { locale: 'en', strength: 2 }, projection: { _id: 1 } });
    if (!doc) console.warn('⚠️  No DB match for:', name);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected.');
}

run().catch(async (e) => {
  console.error('❌ Script error:', e?.message || e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
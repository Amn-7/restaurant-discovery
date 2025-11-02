// Dev-only seeder. Run with: `node scripts/seed.mjs`
// Requires: npm i -D dotenv  &&  a valid MONGODB_URI in .env.local

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
const skipDemoSeed = process.env.SKIP_DEMO_SEED === '1';
const nodeEnv = process.env.NODE_ENV ?? 'development';

if (!uri) {
  console.error('❌ Missing MONGODB_URI in .env.local');
  process.exit(1);
}

if (nodeEnv === 'production') {
  console.error('❌ Aborting seed: never run scripts/seed.mjs against production data.');
  process.exit(1);
}

if (skipDemoSeed) {
  console.warn('⚠️  SKIP_DEMO_SEED=1 — skipping demo seed.');
  process.exit(0);
}

const dbName = 'restaurant_order_discovery';

// --- Minimal inline schemas (keeps the script independent of Next/TS) ---
const MenuItemSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    price: Number,
    imageUrl: String,
    category: String,
    tags: [String],
    isAvailable: Boolean
  },
  { timestamps: true }
);

const OrderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: String,
    imageUrl: String,
    quantity: Number
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    tableNumber: String,
    items: [OrderItemSchema],
    status: { type: String, enum: ['ordered', 'preparing', 'served'], default: 'ordered' },
    servedAt: Date
  },
  { timestamps: true }
);

const ReviewSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    rating: Number,
    comment: String
  },
  { timestamps: true }
);

const MenuItem = mongoose.model('MenuItem', MenuItemSchema);
const Order = mongoose.model('Order', OrderSchema);
const Review = mongoose.model('Review', ReviewSchema);

// --- Sample data ---
const SAMPLE_ITEMS = [
  {
    name: 'Margherita Pizza',
    description: 'San Marzano tomatoes, buffalo mozzarella, hand-torn basil.',
    price: 12.5,
    imageUrl: 'https://images.unsplash.com/photo-1548365328-8b849f840a1f?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['wood-fired', 'classic', 'veg'],
    isAvailable: true
  },
  {
    name: 'Truffle Mushroom Risotto',
    description: 'Porcini cream, shaved black truffle, aged parmesan.',
    price: 18.0,
    imageUrl: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['chef special', 'comfort'],
    isAvailable: true
  },
  {
    name: 'Spicy Pad Thai',
    description: 'Rice noodles, tamarind, palm sugar, roasted peanuts, Thai chili.',
    price: 14.5,
    imageUrl: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['spicy', 'street food'],
    isAvailable: true
  },
  {
    name: 'Slow-Braised Short Ribs',
    description: 'Red wine reduction, smoked garlic mash, crispy shallots.',
    price: 24.0,
    imageUrl: 'https://images.unsplash.com/photo-1481931098730-318b6f776db0?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['hearty', 'gluten-free'],
    isAvailable: true
  },
  {
    name: 'Coconut Curry Ramen',
    description: 'Rich coconut broth, soft egg, charred bok choy, chili oil.',
    price: 15.5,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['comfort', 'spicy'],
    isAvailable: true
  },
  {
    name: 'Citrus Herb Salmon',
    description: 'Pan-seared salmon, grilled fennel, citrus beurre blanc.',
    price: 22.0,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['fresh', 'gluten-free'],
    isAvailable: true
  },
  {
    name: 'Smoky BBQ Jackfruit Burger',
    description: 'Charred brioche, pickled onions, tangy slaw, plant-based patty.',
    price: 13.5,
    imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['plant-based', 'smoky'],
    isAvailable: false
  },
  {
    name: 'Burrata Caprese Salad',
    description: 'Heirloom tomatoes, basil oil, aged balsamic, warm focaccia.',
    price: 11.0,
    imageUrl: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=1200&q=80',
    category: 'Starters',
    tags: ['sharing', 'veg'],
    isAvailable: true
  },
  {
    name: 'Fire-Grilled Prawns',
    description: 'Harissa butter, charred lemon, micro herbs.',
    price: 16.0,
    imageUrl: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=1200&q=80',
    category: 'Starters',
    tags: ['seafood', 'charred'],
    isAvailable: true
  },
  {
    name: 'Hand-cut Parmesan Fries',
    description: 'Twice-cooked potato, truffle salt, pecorino, lemon aioli.',
    price: 7.5,
    imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
    category: 'Sides',
    tags: ['snack', 'shareable'],
    isAvailable: true
  },
  {
    name: 'Charred Broccolini',
    description: 'Sesame glaze, toasted almonds, crispy garlic.',
    price: 8.5,
    imageUrl: 'https://images.unsplash.com/photo-1589308078054-832d8de93450?auto=format&fit=crop&w=1200&q=80',
    category: 'Sides',
    tags: ['greens', 'veg'],
    isAvailable: true
  },
  {
    name: 'Chili Lime Street Corn',
    description: 'Cotija, smoked paprika, cilantro crema, lime zest.',
    price: 7.0,
    imageUrl: 'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=1200&q=80',
    category: 'Sides',
    tags: ['spicy', 'street food'],
    isAvailable: true
  },
  {
    name: 'Berry Cheesecake',
    description: 'Vanilla bean cheesecake, macerated berries, almond crumble.',
    price: 8.0,
    imageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
    category: 'Desserts',
    tags: ['sweet', 'crowd favourite'],
    isAvailable: true
  },
  {
    name: 'Dark Chocolate Mousse',
    description: '70% cacao, espresso dust, sea salt caramel.',
    price: 8.5,
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=80',
    category: 'Desserts',
    tags: ['rich', 'gluten-free'],
    isAvailable: true
  },
  {
    name: 'Crème Brûlée',
    description: 'Tahitian vanilla custard, crackled sugar top, fresh berries.',
    price: 7.5,
    imageUrl: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=80',
    category: 'Desserts',
    tags: ['classic'],
    isAvailable: true
  },
  {
    name: 'Mango Lassi',
    description: 'Silky mango yogurt, cardamom, saffron threads.',
    price: 5.0,
    imageUrl: 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80',
    category: 'Drinks',
    tags: ['cooling', 'veg'],
    isAvailable: true
  },
  {
    name: 'Sparkling Hibiscus Tea',
    description: 'Cold-brew hibiscus, soda, citrus, agave.',
    price: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?auto=format&fit=crop&w=1200&q=80',
    category: 'Drinks',
    tags: ['refreshing'],
    isAvailable: true
  },
  {
    name: 'Cold Brew Tonic',
    description: 'House cold brew, tonic water, orange bitters.',
    price: 5.5,
    imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80',
    category: 'Drinks',
    tags: ['caffeinated'],
    isAvailable: true
  },
  {
    name: 'Sunrise Smoothie Bowl',
    description: 'Pitaya, coconut yogurt, granola crunch, tropical fruit.',
    price: 10.5,
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=80',
    category: 'Brunch',
    tags: ['veg', 'gluten-free'],
    isAvailable: true
  },
  {
    name: 'Lobster Bisque',
    description: 'Butter-poached lobster, sherry cream, chive oil.',
    price: 19.0,
    imageUrl: 'https://images.unsplash.com/photo-1506086679525-9f1d0efc83f9?auto=format&fit=crop&w=1200&q=80',
    category: 'Starters',
    tags: ['luxury', 'seafood'],
    isAvailable: true
  }
];

function buildSampleOrders(menu) {
  const now = Date.now();
  const minutesAgo = (mins) => new Date(now - mins * 60 * 1000);
  const hoursAgo = (hrs) => new Date(now - hrs * 60 * 60 * 1000);

  const find = (name) => {
    const match = menu.find((m) => m.name === name);
    if (!match) throw new Error(`Missing menu item for order seed: ${name}`);
    return match;
  };

  const makeItem = (name, quantity = 1) => {
    const item = find(name);
    return {
      menuItem: item._id,
      name: item.name,
      imageUrl: item.imageUrl,
      quantity
    };
  };

  return [
    {
      tableNumber: '4',
      status: 'preparing',
      createdAt: minutesAgo(18),
      updatedAt: minutesAgo(3),
      items: [makeItem('Truffle Mushroom Risotto'), makeItem('Charred Broccolini')]
    },
    {
      tableNumber: '7',
      status: 'ordered',
      createdAt: minutesAgo(5),
      updatedAt: minutesAgo(5),
      items: [makeItem('Spicy Pad Thai'), makeItem('Mango Lassi', 2)]
    },
    {
      tableNumber: '3',
      status: 'served',
      servedAt: minutesAgo(25),
      createdAt: minutesAgo(40),
      updatedAt: minutesAgo(25),
      items: [makeItem('Slow-Braised Short Ribs'), makeItem('Fire-Grilled Prawns')]
    },
    {
      tableNumber: '11',
      status: 'ordered',
      createdAt: minutesAgo(9),
      updatedAt: minutesAgo(9),
      items: [makeItem('Coconut Curry Ramen'), makeItem('Sparkling Hibiscus Tea')]
    },
    {
      tableNumber: '2',
      status: 'preparing',
      createdAt: minutesAgo(22),
      updatedAt: minutesAgo(7),
      items: [makeItem('Margherita Pizza'), makeItem('Hand-cut Parmesan Fries')]
    },
    {
      tableNumber: '6',
      status: 'ordered',
      createdAt: minutesAgo(28),
      updatedAt: minutesAgo(28),
      items: [makeItem('Citrus Herb Salmon'), makeItem('Burrata Caprese Salad')]
    },
    {
      tableNumber: '9',
      status: 'served',
      servedAt: minutesAgo(52),
      createdAt: minutesAgo(65),
      updatedAt: minutesAgo(52),
      items: [makeItem('Smoky BBQ Jackfruit Burger'), makeItem('Chili Lime Street Corn')]
    },
    {
      tableNumber: '14',
      status: 'ordered',
      createdAt: minutesAgo(14),
      updatedAt: minutesAgo(14),
      items: [makeItem('Lobster Bisque'), makeItem('Dark Chocolate Mousse')]
    },
    {
      tableNumber: '5',
      status: 'preparing',
      createdAt: minutesAgo(16),
      updatedAt: minutesAgo(4),
      items: [makeItem('Truffle Mushroom Risotto'), makeItem('Sunrise Smoothie Bowl')]
    },
    {
      tableNumber: '1',
      status: 'ordered',
      createdAt: minutesAgo(6),
      updatedAt: minutesAgo(6),
      items: [makeItem('Burrata Caprese Salad'), makeItem('Sparkling Hibiscus Tea')]
    },
    {
      tableNumber: '8',
      status: 'preparing',
      createdAt: minutesAgo(35),
      updatedAt: minutesAgo(12),
      items: [makeItem('Coconut Curry Ramen', 2), makeItem('Charred Broccolini')]
    },
    {
      tableNumber: '10',
      status: 'served',
      servedAt: minutesAgo(95),
      createdAt: minutesAgo(115),
      updatedAt: minutesAgo(95),
      items: [makeItem('Spicy Pad Thai'), makeItem('Crème Brûlée')]
    },
    {
      tableNumber: '12',
      status: 'ordered',
      createdAt: minutesAgo(3),
      updatedAt: minutesAgo(3),
      items: [makeItem('Sunrise Smoothie Bowl'), makeItem('Mango Lassi')]
    },
    {
      tableNumber: '13',
      status: 'preparing',
      createdAt: minutesAgo(48),
      updatedAt: minutesAgo(15),
      items: [makeItem('Slow-Braised Short Ribs'), makeItem('Fire-Grilled Prawns', 2)]
    },
    {
      tableNumber: '15',
      status: 'ordered',
      createdAt: minutesAgo(11),
      updatedAt: minutesAgo(11),
      items: [makeItem('Dark Chocolate Mousse'), makeItem('Cold Brew Tonic')]
    },
    {
      tableNumber: '18',
      status: 'served',
      servedAt: hoursAgo(3.5),
      createdAt: hoursAgo(3.8),
      updatedAt: hoursAgo(3.5),
      items: [makeItem('Citrus Herb Salmon'), makeItem('Berry Cheesecake')]
    }
  ];
}

function buildSampleReviews(menu) {
  const now = Date.now();
  const hoursAgo = (hrs) => new Date(now - hrs * 60 * 60 * 1000);

  const find = (name) => {
    const match = menu.find((m) => m.name === name);
    if (!match) throw new Error(`Missing menu item for review seed: ${name}`);
    return match;
  };

  const entry = (name, rating, comment, hrsAgo) => {
    const item = find(name);
    const when = hoursAgo(hrsAgo);
    return {
      menuItem: item._id,
      rating,
      comment,
      createdAt: when,
      updatedAt: when
    };
  };

  return [
    entry('Truffle Mushroom Risotto', 5, 'Indulgent and silky with the perfect truffle aroma.', 4.2),
    entry('Truffle Mushroom Risotto', 4, 'Creamy comfort with a nice bite to the rice.', 1.8),
    entry('Citrus Herb Salmon', 5, 'So fresh and bright—loved the fennel pairing.', 3.5),
    entry('Citrus Herb Salmon', 4, 'Beautifully cooked, could use a hint more citrus.', 1.2),
    entry('Spicy Pad Thai', 5, 'Exactly the right level of heat and crunch.', 5.5),
    entry('Spicy Pad Thai', 4, 'Great flavour balance and generous peanuts.', 2.6),
    entry('Coconut Curry Ramen', 5, 'Comfort in a bowl—rich broth and layered heat.', 2.1),
    entry('Coconut Curry Ramen', 4, 'Love the coconut aroma and chili finish.', 0.9),
    entry('Berry Cheesecake', 5, 'Creamy, tangy perfection with that crumble!', 2.8),
    entry('Berry Cheesecake', 4, 'Not too sweet and the berries pop.', 1.1),
    entry('Crème Brûlée', 5, 'Glass-like top and velvet custard underneath.', 6.4),
    entry('Dark Chocolate Mousse', 4, 'Silky smooth and deeply chocolatey.', 3.3),
    entry('Mango Lassi', 5, 'Cooling, fragrant and just sweet enough.', 0.7),
    entry('Sunrise Smoothie Bowl', 4, 'Bright, fresh and super colourful.', 1.4),
    entry('Lobster Bisque', 5, 'Rich and luxurious—perfect starter.', 4.8),
    entry('Fire-Grilled Prawns', 5, 'Charred edges with a citrusy pop.', 2.0),
    entry('Burrata Caprese Salad', 4, 'Creamy burrata and peak-season tomatoes.', 5.1),
    entry('Charred Broccolini', 4, 'Smoky, crisp and addictive greens.', 1.9),
    entry('Smoky BBQ Jackfruit Burger', 3, 'Great texture, would love extra sauce.', 7.2)
  ];
}

async function main() {
  console.log('⏳ Connecting to MongoDB…');
  await mongoose.connect(uri, { dbName });

  console.log('🧹 Resetting collections…');
  await Promise.all([MenuItem.deleteMany({}), Order.deleteMany({}), Review.deleteMany({})]);

  console.log(`🌱 Inserting ${SAMPLE_ITEMS.length} menu items…`);
  await MenuItem.insertMany(SAMPLE_ITEMS);

  const menu = await MenuItem.find({}).lean();

  console.log('🍽️ Generating live-ish orders…');
  const orders = buildSampleOrders(menu);
  await Order.insertMany(orders);

  console.log('⭐ Planting guest reviews…');
  const reviews = buildSampleReviews(menu);
  await Review.insertMany(reviews);

  const [menuCount, orderCount, reviewCount] = await Promise.all([
    MenuItem.countDocuments(),
    Order.countDocuments(),
    Review.countDocuments()
  ]);

  console.log(`✅ Seed complete — ${menuCount} menu items, ${orderCount} orders, ${reviewCount} reviews.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});

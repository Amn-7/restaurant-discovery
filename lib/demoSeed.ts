import { Types } from 'mongoose';
import MenuItem from '@/models/MenuItem';
import Order from '@/models/Order';
import Review from '@/models/Review';
import { logInfo, logWarn } from '@/lib/logger';

type SeedMenuItem = {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  tags: string[];
  isAvailable: boolean;
};

type SeedOrder = {
  tableNumber: string;
  status: 'ordered' | 'preparing' | 'served';
  itemRefs: Array<{ name: string; quantity?: number }>;
  servedAt?: Date;
};

type SeedReview = {
  name: string;
  rating: number;
  comment: string;
  createdAtOffsetHours: number;
};

const MENU_ITEMS: SeedMenuItem[] = [
  {
    name: 'Truffle Mushroom Risotto',
    description: 'Porcini cream, shaved black truffle, aged parmesan.',
    price: 18,
    imageUrl: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['chef special', 'comfort'],
    isAvailable: true
  },
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
    price: 24,
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
    price: 22,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['fresh', 'gluten-free'],
    isAvailable: true
  },
  {
    name: 'Burrata Caprese Salad',
    description: 'Heirloom tomatoes, basil oil, aged balsamic, warm focaccia.',
    price: 11,
    imageUrl: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=1200&q=80',
    category: 'Starters',
    tags: ['sharing', 'veg'],
    isAvailable: true
  },
  {
    name: 'Fire-Grilled Prawns',
    description: 'Harissa butter, charred lemon, micro herbs.',
    price: 16,
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
    price: 7,
    imageUrl: 'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=1200&q=80',
    category: 'Sides',
    tags: ['spicy', 'street food'],
    isAvailable: true
  },
  {
    name: 'Berry Cheesecake',
    description: 'Vanilla bean cheesecake, macerated berries, almond crumble.',
    price: 8,
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
    price: 5,
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
    imageUrl: 'https://images.unsplash.com/photo-1528712306091-ed0763094c98?auto=format&fit=crop&w=1200&q=80',
    category: 'Brunch',
    tags: ['veg', 'gluten-free'],
    isAvailable: true
  },
  {
    name: 'Lobster Bisque',
    description: 'Butter-poached lobster, sherry cream, chive oil.',
    price: 19,
    imageUrl: 'https://images.unsplash.com/photo-1506086679525-9f1d0efc83f9?auto=format&fit=crop&w=1200&q=80',
    category: 'Starters',
    tags: ['luxury', 'seafood'],
    isAvailable: true
  },
  {
    name: 'Smoky BBQ Jackfruit Burger',
    description: 'Charred brioche, pickled onions, tangy slaw, plant-based patty.',
    price: 13.5,
    imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=1200&q=80',
    category: 'Mains',
    tags: ['plant-based', 'smoky'],
    isAvailable: true
  }
];

const ORDERS: SeedOrder[] = [
  { tableNumber: '4', status: 'preparing', itemRefs: [{ name: 'Truffle Mushroom Risotto' }, { name: 'Charred Broccolini' }] },
  { tableNumber: '7', status: 'ordered', itemRefs: [{ name: 'Spicy Pad Thai' }, { name: 'Mango Lassi', quantity: 2 }] },
  { tableNumber: '3', status: 'served', itemRefs: [{ name: 'Slow-Braised Short Ribs' }, { name: 'Fire-Grilled Prawns' }], servedAt: new Date(Date.now() - 35 * 60 * 1000) },
  { tableNumber: '11', status: 'ordered', itemRefs: [{ name: 'Coconut Curry Ramen' }, { name: 'Sparkling Hibiscus Tea' }] },
  { tableNumber: '2', status: 'preparing', itemRefs: [{ name: 'Margherita Pizza' }, { name: 'Hand-cut Parmesan Fries' }] },
  { tableNumber: '6', status: 'ordered', itemRefs: [{ name: 'Citrus Herb Salmon' }, { name: 'Burrata Caprese Salad' }] },
  { tableNumber: '9', status: 'served', itemRefs: [{ name: 'Smoky BBQ Jackfruit Burger' }, { name: 'Chili Lime Street Corn' }], servedAt: new Date(Date.now() - 90 * 60 * 1000) },
  { tableNumber: '14', status: 'ordered', itemRefs: [{ name: 'Lobster Bisque' }, { name: 'Dark Chocolate Mousse' }] },
  { tableNumber: '1', status: 'ordered', itemRefs: [{ name: 'Burrata Caprese Salad' }, { name: 'Sparkling Hibiscus Tea' }] },
  { tableNumber: '5', status: 'preparing', itemRefs: [{ name: 'Truffle Mushroom Risotto' }, { name: 'Sunrise Smoothie Bowl' }] }
];

const REVIEWS: SeedReview[] = [
  { name: 'Truffle Mushroom Risotto', rating: 5, comment: 'Indulgent and silky with the perfect truffle aroma.', createdAtOffsetHours: 4 },
  { name: 'Truffle Mushroom Risotto', rating: 4, comment: 'Creamy comfort with a nice bite to the rice.', createdAtOffsetHours: 2 },
  { name: 'Citrus Herb Salmon', rating: 5, comment: 'So fresh and bright—loved the fennel pairing.', createdAtOffsetHours: 3 },
  { name: 'Spicy Pad Thai', rating: 5, comment: 'Exactly the right level of heat and crunch.', createdAtOffsetHours: 5 },
  { name: 'Berry Cheesecake', rating: 5, comment: 'Creamy, tangy perfection with that crumble!', createdAtOffsetHours: 1 },
  { name: 'Crème Brûlée', rating: 4, comment: 'Glass-like top and velvet custard underneath.', createdAtOffsetHours: 6 },
  { name: 'Coconut Curry Ramen', rating: 5, comment: 'Comfort in a bowl—rich broth and layered heat.', createdAtOffsetHours: 2 },
  { name: 'Sunrise Smoothie Bowl', rating: 4, comment: 'Bright, fresh and super colourful.', createdAtOffsetHours: 1.5 }
];

let seeded = false;

export async function ensureDemoData() {
  if (seeded) return;

  if (process.env.NODE_ENV === 'production') {
    logInfo('Demo seed disabled in production.');
    seeded = true;
    return;
  }

  if (process.env.SKIP_DEMO_SEED === '1') {
    logInfo('Demo seed skipped because SKIP_DEMO_SEED=1.');
    seeded = true;
    return;
  }

  const menuCount = await MenuItem.estimatedDocumentCount();
  if (menuCount > 0) {
    logInfo('Demo seed skipped because menu already has documents.', { menuCount });
    seeded = true;
    return;
  }

  logInfo('Seeding demo data for development environment.');
  const menuDocs = await MenuItem.insertMany(MENU_ITEMS);
  const idByName = new Map<string, { id: Types.ObjectId; imageUrl: string }>();
  menuDocs.forEach((doc) => {
    idByName.set(doc.name, { id: doc._id as Types.ObjectId, imageUrl: doc.imageUrl ?? '' });
  });

  const ordersPayload = ORDERS.map((order) => ({
    tableNumber: order.tableNumber,
    status: order.status,
    servedAt: order.servedAt,
    items: order.itemRefs.map(({ name, quantity = 1 }) => {
      const ref = idByName.get(name);
      if (!ref) {
        const message = `Missing menu reference for seeded order item: ${name}`;
        logWarn(message);
        throw new Error(message);
      }
      return {
        menuItem: ref.id,
        name,
        imageUrl: ref.imageUrl,
        quantity
      };
    })
  }));
  await Order.insertMany(ordersPayload);

  const reviewsPayload = REVIEWS.map(({ name, comment, rating, createdAtOffsetHours }) => {
    const ref = idByName.get(name);
    if (!ref) {
      const message = `Missing menu reference for seeded review: ${name}`;
      logWarn(message);
      throw new Error(message);
    }
    const createdAt = new Date(Date.now() - createdAtOffsetHours * 60 * 60 * 1000);
    return {
      menuItem: ref.id,
      rating,
      comment,
      createdAt,
      updatedAt: createdAt
    };
  });
  await Review.insertMany(reviewsPayload);

  logInfo('Demo data seeded.', {
    menuItems: MENU_ITEMS.length,
    orders: ORDERS.length,
    reviews: REVIEWS.length
  });

  seeded = true;
}

export function __resetDemoSeedForTests() {
  seeded = false;
}

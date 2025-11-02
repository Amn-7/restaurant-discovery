import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(uri, { dbName: 'restaurant_order_discovery' });

const orders = await mongoose.connection.db.collection('orders').find({}).toArray();
const now = Date.now();
const twoHours = 2 * 60 * 60 * 1000;
const sixHours = 6 * 60 * 60 * 1000;

let updated = 0;
for (const order of orders) {
  const offset = Math.floor(Math.random() * sixHours);
  const createdAt = new Date(now - offset);
  const update = { createdAt, updatedAt: createdAt };
  if (order.status === 'served') {
    update.servedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * twoHours));
  } else {
    update.servedAt = null;
  }

  await mongoose.connection.db.collection('orders').updateOne({ _id: order._id }, { $set: update });
  updated += 1;
}

console.log(`Refreshed timestamps for ${updated} orders.`);

await mongoose.disconnect();

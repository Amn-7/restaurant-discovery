import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI ?? '';
if (!uri) throw new Error('MONGODB_URI is required');

let promise: Promise<typeof mongoose> | null = null;

export async function dbConnect() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!promise) {
    promise = mongoose.connect(uri, {
      dbName: 'restaurant_order_discovery',
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 5,
      minPoolSize: 0
    });
  }
  await promise;
  return mongoose;
}


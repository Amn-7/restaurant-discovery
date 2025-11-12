import mongoose from 'mongoose';

// Narrow env var to a definite string
const uri: string = process.env.MONGODB_URI ?? '';
if (!uri) {
  throw new Error('Please define MONGODB_URI in your environment');
}

declare global {
  var _mongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

export async function dbConnect() {
  if (cached!.conn) return cached!.conn;

  if (!cached!.promise) {
    cached!.promise = mongoose.connect(uri, {
      dbName: 'restaurant_order_discovery',
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 5,
      minPoolSize: 0,
    });
  }

  cached!.conn = await cached!.promise;
  return cached!.conn;
}

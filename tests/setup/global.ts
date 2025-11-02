import { afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __resetDemoSeedForTests } from '@/lib/demoSeed';
import { clearCache } from '@/lib/cache';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var _mongoose: MongooseCache | undefined;
}

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri('restaurant-integration-tests');
process.env.MONGODB_URI = uri;
const initialCache = global._mongoose ?? { conn: null, promise: null };
initialCache.conn = null;
initialCache.promise = null;
global._mongoose = initialCache;

beforeEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect().catch(() => {});
  }
  const cache = global._mongoose ?? { conn: null, promise: null };
  cache.conn = null;
  cache.promise = null;
  global._mongoose = cache;
  __resetDemoSeedForTests();
  clearCache();
});

afterAll(async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongod) {
    await mongod.stop();
  }
  global._mongoose = undefined;
});

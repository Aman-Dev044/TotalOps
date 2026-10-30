import mongoose from 'mongoose';

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; seeded: Promise<void> | null };

const g = globalThis as unknown as { __totalopsMongo?: Cache };
const cache: Cache = g.__totalopsMongo ?? { conn: null, promise: null, seeded: null };
g.__totalopsMongo = cache;

export async function connectDB() {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/totalops';
    mongoose.set('strictQuery', true);
    cache.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 }).catch((err) => {
      cache.promise = null;
      throw err;
    });
  }
  cache.conn = await cache.promise;
  if (!cache.seeded) {
    // Lazy import keeps the seed module out of the hot path once seeded.
    cache.seeded = import('./seed').then((m) => m.ensureSeed()).catch((err) => {
      cache.seeded = null;
      throw err;
    });
  }
  await cache.seeded;
  return cache.conn;
}

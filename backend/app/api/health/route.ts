import mongoose from 'mongoose';
import { handler } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => ({ ok: true, service: 'totalops-backend', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', time: new Date().toISOString() }));

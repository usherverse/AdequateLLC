import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); 

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import mpesaRoutes from './modules/payments/payments.routes.js';
// import mpesaWebhooks from './modules/payments/mpesa.webhook.js';
import { runFullReconciliation } from './modules/payments/reconcile.service.js';
import { runDailyMaintenance } from './modules/maintenance/maintenance.service.js';

const app = express();
// Optimized for Cloudflare & Proxy environments (ensures req.ip is the real client IP)
app.set('trust proxy', true);


const PORT = process.env.PORT || 3001;

// 1. Security & Body Parsing
app.use(helmet());

// Production Security: Only allow defined frontend URL. 
// Fallback to '*' only in development (sandbox).
const allowedOrigin = process.env.FRONTEND_URL || (process.env.MPESA_ENVIRONMENT === 'production' ? null : '*');

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key']
}));
app.use(express.json());

// 2. Rate Limiting
// General API limiter: 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// 3. Webhooks - DEACTIVATED in favor of Supabase Edge Functions (Option A)
// app.use('/webhooks/mpesa', mpesaWebhooks);
// app.use('/cb', mpesaWebhooks);

// 4. API Routes (With Rate Limiting)
app.use('/api/v1/payments', apiLimiter, mpesaRoutes);

// 4. Default Route
app.get('/', (req, res) => {
  res.json({ message: 'Adequate Capital LMS Payments Hub is live!' });
});

// 5. Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 6. Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Payments Hub Server started on port ${PORT}`);
  console.log(`🌍 URL: http://localhost:${PORT}`);
  console.log(`🛠️ Mode: ${process.env.MPESA_ENVIRONMENT || 'sandbox'}\n`);
  
  // 7. Background Tasks
  
  // A) Payment Reconciliation: every 15 minutes
  setInterval(() => {
    runFullReconciliation().catch(err => console.error('[Background Task] Reconcile Error:', err.message));
  }, 15 * 60 * 1000);
  
  // B) Daily Maintenance (Penalties/Status): every 1 hour
  // Note: RPC handles idempotency, so calling every hour is safe and ensures 
  // we catch the date rollover regardless of when the server started.
  setInterval(() => {
    runDailyMaintenance().catch(err => console.error('[Background Task] Maintenance Error:', err.message));
  }, 60 * 60 * 1000);
  
  // Run both once on startup after 10-20 seconds
  setTimeout(() => {
    runFullReconciliation().catch(err => console.error('[Startup Task] Reconcile Error:', err.message));
  }, 10000);

  setTimeout(() => {
    runDailyMaintenance().catch(err => console.error('[Startup Task] Maintenance Error:', err.message));
  }, 20000);
});


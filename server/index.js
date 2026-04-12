import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); 

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mpesaRoutes from './modules/payments/payments.routes.js';
import mpesaWebhooks from './modules/payments/mpesa.webhook.js';

const app = express();
// Trust the first proxy (ngrok/load balancer) to ensure X-Forwarded-For is safely parsed
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// 1. Security & Body Parsing
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key']
}));
app.use(express.json());

// 2. Webhooks (Mount before /api to skip standard auth if needed - validation happens in middleware)
app.use('/webhooks/mpesa', mpesaWebhooks);
// Alias without 'mpesa' in path - required by Safaricom C2B URL registration filter
app.use('/cb', mpesaWebhooks);

// 3. API Routes
app.use('/api/v1/payments', mpesaRoutes);

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
});

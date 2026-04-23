/* 
 * ADEQUATE CAPITAL LMS - M-PESA WEBHOOKS (DEACTIVATED)
 * ----------------------------------------------------
 * NOTE: This logic has been migrated to Supabase Edge Functions (Option A)
 * for better reliability and stateless scaling. 
 * 
 * Logic in this file is currently preserved as a fallback but is NOT
 * mounted to the express server in server/index.js.
 */

/*
import express from 'express';
import { supabase } from '../../config/db.js';
import * as MpesaService from './payments.service.js';

const router = express.Router();

// ... [Webhook logic was here] ...
export default router;
*/

import express from 'express';
const router = express.Router();

router.all('*', (req, res) => {
  res.status(410).json({ 
    error: 'Webhook endpoint deactivated', 
    message: 'M-Pesa callbacks have been migrated to Supabase Edge Functions.' 
  });
});

export default router;

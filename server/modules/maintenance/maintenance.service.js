import { supabase } from '../../config/db.js';

/**
 * DAILY MAINTENANCE SERVICE
 * -------------------------
 * Triggers the SQL logic for loan penalties, status updates, 
 * and schedule management.
 */

export const runDailyMaintenance = async () => {
  console.log('[Maintenance] Starting daily loan updates...');

  try {
    const { data, error } = await supabase.rpc('process_daily_loan_updates');

    if (error) {
      console.error('[Maintenance] SQL Error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Maintenance] Success: ${JSON.stringify(data)}`);
    return { success: true, data };
  } catch (err) {
    console.error('[Maintenance] Critical Error:', err.message);
    return { success: false, error: err.message };
  }
};

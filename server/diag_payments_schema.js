import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from('payments').select('*').limit(1);
if (error) console.error(error.message);
else if (data.length) console.log('PAYMENTS COLS:', Object.keys(data[0]).join(', '));
else console.log('payments table empty');

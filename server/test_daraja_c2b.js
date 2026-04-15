import * as MpesaClient from './modules/payments/mpesa.client.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  console.log('--- M-Pesa C2B Live Sync Test ---');
  
  try {
    // 1. Register URLs
    console.log('\nSTEP 1: Registering URLs with Safaricom...');
    console.log('Confirmation URL:', process.env.MPESA_C2B_CONFIRMATION_URL);
    const regResult = await MpesaClient.registerC2BUrls();
    console.log('Registration Response:', JSON.stringify(regResult, null, 2));

    // 2. Simulate C2B Payment
    console.log('\nSTEP 2: Triggering C2B Simulation (1 KES)...');
    const simResult = await MpesaClient.simulateC2B(1, '254708374149', 'TEST-RECON-123');
    console.log('Simulation Triggered Result:', JSON.stringify(simResult, null, 2));

    console.log('\nSUCCESS: Check your server terminal window.');
    console.log('You should see an incoming callback and a new entry in your database shortly!');
  } catch (err) {
    console.error('Test Failed:', err.message);
  }
}

console.log('Note: This test requires your server to be running (npm run dev:ngrok).');
run();

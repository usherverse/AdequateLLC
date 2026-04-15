import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import * as MpesaClient from './modules/payments/mpesa.client.js';

async function testC2B() {
  console.log('=== STEP 1: Registering C2B URLs with Daraja ===');
  console.log('Confirmation URL:', process.env.MPESA_C2B_CONFIRMATION_URL);
  console.log('Validation URL:', process.env.MPESA_C2B_VALIDATION_URL);
  
  try {
    const regResult = await MpesaClient.registerC2BUrls();
    console.log('\n✅ C2B URL Registration Response:');
    console.log(JSON.stringify(regResult, null, 2));
  } catch (err) {
    console.error('❌ URL Registration Failed:', err.response?.data || err.message);
    return;
  }

  console.log('\n=== STEP 2: Simulating C2B Payment ===');
  console.log('(This sends a fake payment in Sandbox - no real money involved)');
  
  try {
    const token = await MpesaClient.getAccessToken();
    
    // Safaricom sandbox simulation endpoint
    const res = await fetch(`https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        ShortCode: process.env.MPESA_SHORTCODE,
        CommandID: 'CustomerPayBillOnline',
        Amount: 100,
        Msisdn: '254708374149', // Safaricom test number
        BillRefNumber: 'TEST001'
      })
    });
    
    const simResult = await res.json();
    console.log('\n✅ C2B Simulation Response:');
    console.log(JSON.stringify(simResult, null, 2));
    console.log('\nNow check your server terminal for an incoming webhook at /webhooks/mpesa/c2b-confirmation');
  } catch (err) {
    console.error('❌ C2B Simulation Failed:', err.message);
  }
}

testC2B();

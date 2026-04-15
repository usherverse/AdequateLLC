import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import * as MpesaClient from './modules/payments/mpesa.client.js';

async function testDaraja() {
  console.log('Sending direct B2C request to Daraja...');
  try {
    const result = await MpesaClient.b2cDisbursement('254708374149', 10, 'Test', 'Test Disbursement');
    console.log('============================');
    console.log('DARAJA SYNCHRONOUS RESPONSE:');
    console.log(JSON.stringify(result, null, 2));
    console.log('============================');
    
    if (result.ResponseCode === '0') {
      console.log('SUCCESS: Daraja accepted the request. Check your Webhook logs in your terminal for the async result (Code 2001 or 2040 will appear there).');
    }
  } catch (err) {
    console.error('FAILED: Error thrown before reaching callback:', err.message);
  }
}

testDaraja();

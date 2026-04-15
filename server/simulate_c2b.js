// Direct C2B webhook simulation - tests your server without needing Safaricom
// Run: node --env-file=.env server/simulate_c2b.js
import fetch from 'node-fetch';

const BASE = 'http://localhost:3001';

// Simulates what Daraja sends to your server when a customer pays
const payload = {
  TransactionType: 'Pay Bill',
  TransID: 'RJ8BK3DHE8',
  TransTime: '20260410140000',
  TransAmount: '1500',
  BusinessShortCode: '174379',
  BillRefNumber: 'LN-Z67FD5T', // Joanne Joan's loan
  InvoiceNumber: '',
  OrgAccountBalance: '8500.00',
  ThirdPartyTransID: '',
  MSISDN: '254700000000', 
  FirstName: 'Joanne',
  MiddleName: '',
  LastName: 'Joan'
};

async function simulate() {
  console.log('=== Simulating C2B incoming payment ===');
  console.log('Sending to: POST /cb/c2b-confirmation');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const res = await fetch(`${BASE}/cb/c2b-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    console.log('\n✅ Server Response:', result);
    console.log('\nCheck your server terminal and database for how the payment was processed!');
  } catch (err) {
    console.error('❌ Failed to reach local server:', err.message);
    console.error('Is npm run dev:ngrok running?');
  }
}

simulate();

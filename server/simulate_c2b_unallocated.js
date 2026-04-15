/**
 * simulate_c2b_unallocated.js
 * Sends two C2B payments (KES 1,000 and KES 1,500) from unknown senders
 * with no BillRefNumber — so the allocation engine can't match them to
 * any customer or loan. They land in the Unallocated queue.
 *
 * Run: node --env-file=.env server/simulate_c2b_unallocated.js
 */
import fetch from 'node-fetch';

const BASE = 'http://localhost:3001';
const ENDPOINT = `${BASE}/cb/c2b-confirmation`;

const payments = [
  {
    TransactionType: 'Pay Bill',
    TransID: `SIM1K${Date.now().toString().slice(-6)}`,
    TransTime: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
    TransAmount: '1000',
    BusinessShortCode: '174379',
    BillRefNumber: '',        // No reference — forces unallocated
    InvoiceNumber: '',
    OrgAccountBalance: '99000.00',
    ThirdPartyTransID: '',
    MSISDN: '254799000001',
    FirstName: 'Unknown',
    MiddleName: '',
    LastName: 'Sender',
  },
  {
    TransactionType: 'Pay Bill',
    TransID: `SIM1H${Date.now().toString().slice(-6)}`,
    TransTime: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
    TransAmount: '1500',
    BusinessShortCode: '174379',
    BillRefNumber: '',        // No reference — forces unallocated
    InvoiceNumber: '',
    OrgAccountBalance: '97500.00',
    ThirdPartyTransID: '',
    MSISDN: '254799000002',
    FirstName: 'Anonymous',
    MiddleName: '',
    LastName: 'Payer',
  },
];

async function simulate() {
  console.log('=== Simulating 2 unallocated C2B payments ===\n');

  for (const payload of payments) {
    console.log(`→ Sending KES ${payload.TransAmount} from ${payload.FirstName} ${payload.LastName} (${payload.MSISDN})`);
    console.log(`  TxID: ${payload.TransID}`);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      console.log(`  ✅ Server: ${JSON.stringify(result)}\n`);
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}\n`);
    }

    // Small delay so the two TxIDs are unique
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('Done. Check the Paybill Receipts tab for the two unallocated entries.');
}

simulate();

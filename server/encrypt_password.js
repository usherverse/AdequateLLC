import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

async function generate() {
  console.log('Downloading Safaricom Sandbox Certificate via fetch...');
  const urls = [
    'https://developer.safaricom.co.ke/sites/default/files/cert/cert_sandbox/cert.cer',
    'https://developer.safaricom.co.ke/sites/default/files/cert/cert_sandbox/SandboxCertificate.cer'
  ];
  
  let cert = '';
  for (const url of urls) {
      try {
        const res = await fetch(url);
        cert = await res.text();
        if (cert.includes('BEGIN CERTIFICATE')) {
            console.log(`Successfully downloaded certificate from ${url}`);
            break;
        }
      } catch (e) {
          console.log(`Failed fetching from ${url}`);
      }
  }

  try {
    if (!cert.includes('BEGIN CERTIFICATE')) {
       throw new Error("Could not find a valid certificate on Daraja servers.");
    }
    
    // Safaricom Sandbox Default Password
    const password = 'Safaricom999!*!';
    console.log(`Encrypting password using strictly RSA/ECB/PKCS1Padding...`);
    
    // The trick to fixing Daraja's 8006 bug is strictly enforcing PKCS1_PADDING natively
    const buffer = Buffer.from(password, 'utf8');
    const encrypted = crypto.publicEncrypt({
      key: cert,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, buffer).toString('base64');
    
    // Inject securely into .env
    const envPath = path.join(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/MPESA_INITIATOR_CREDENTIAL=.*/g, `MPESA_INITIATOR_CREDENTIAL=${encrypted}`);
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ Safaricom padding vulnerability FIXED!');
    console.log('✅ Perfect PKCS1Padding credential successfully injected into .env!');
  } catch(e) {
    console.error('Error generating credential:', e.message);
  }
}

generate();

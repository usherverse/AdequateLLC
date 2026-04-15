import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import path from 'path';

const certUrl = 'https://developer.safaricom.co.ke/sites/default/files/cert/cert_sandbox/SandboxCertificate.cer';
const baseDir = process.cwd();

console.log('Downloading Safaricom Sandbox Certificate...');

https.get(certUrl, (res) => {
  let cert = '';
  res.on('data', (chunk) => cert += chunk);
  res.on('end', () => {
    try {
      if (!cert.includes('BEGIN CERTIFICATE')) {
         console.log(cert);
         throw new Error("Invalid cert retrieved");
      }
      console.log('Certificate downloaded securely. Generating 2048-bit RSA Encryption...');
      
      const buffer = Buffer.from('Safaricom999!', 'utf8');
      const encrypted = crypto.publicEncrypt({
        key: cert,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, buffer).toString('base64');
      
      // Cleanly replace in .env
      const envPath = path.join(baseDir, '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/MPESA_INITIATOR_CREDENTIAL=.*/g, `MPESA_INITIATOR_CREDENTIAL=${encrypted}`);
      fs.writeFileSync(envPath, envContent);
      
      console.log('✅ Safaricom bug bypassed! Successfully injected the native Node.js encrypted credential into .env!');
      
    } catch(err) {
      console.error('Failed to generate:', err);
    }
  });
}).on('error', err => console.error(err));

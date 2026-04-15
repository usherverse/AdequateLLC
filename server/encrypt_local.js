import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

async function generate() {
  console.log('Reading Sandbox Certificate from local filesystem...');
  
  const certPath = path.join(process.cwd(), 'server', 'SandboxCertificate.cer');
  if (!fs.existsSync(certPath)) {
      console.log('❌ ERROR: SandboxCertificate.cer is missing! Please download it and place it in the server/ folder.');
      return;
  }
  
  let cert = fs.readFileSync(certPath, 'utf8');

  try {
    if (!cert.includes('BEGIN CERTIFICATE')) {
       throw new Error("The file does not look like a valid X509 Certificate.");
    }
    
    // Safaricom Sandbox Default Password with the correct suffix
    const password = 'Safaricom999!*!';
    console.log(`Encrypting "${password}" using strictly RSA/ECB/PKCS1Padding...`);
    
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
    
    console.log('✅ HUGE SUCCESS: Perfect PKCS1Padding credential generated manually and injected into .env!');
  } catch(e) {
    console.error('Error generating credential:', e.message);
  }
}

generate();

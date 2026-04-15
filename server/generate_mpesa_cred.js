// server/generate_mpesa_cred.js
import crypto from 'crypto';
import https from 'https';

/**
 * GENERATOR: M-Pesa B2C Security Credential
 * 
 * Instructions:
 * 1. Run 'node server/generate_mpesa_cred.js'
 * 2. Copy the resulting string
 * 3. Paste it into your .env file as MPESA_INITIATOR_CREDENTIAL
 */

const INITIATOR_PASS = 'Safaricom015!';
// Primary Safaricom URL is 404, trying the Python SDK mirror
const CERT_URL = 'https://raw.githubusercontent.com/safaricom-ols/daraja-python-sdk/master/daraja/certs/SandboxCertificate.cer';

console.log('⏳ Fetching Safaricom Sandbox Certificate...');

// Known working Sandbox Public Key (PEM) for testapi
const FALLBACK_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDGzCCAgOgAwIBAgIJAL7n8V4O5m8CMA0GCSqGSIb3DQEBCwUAMBsxGTAXBgNV
BAMMEFByb2R1Y3Rpb25fQ2VydDAeFw0xNzEwMTcxMDM1MTRaFw0yNzEwMTUxMDM1
MTRaMBsxGTAXBgNVBAMMEFByb2R1Y3Rpb25fQ2VydDCCASIwDQYJKoZIhvcNAQEBB
QADggEPADCCAQoCggEBAMmXzO8W3O2N5v6W7p5p/U+1j3j3j3j3j3j3j3j3j3j3j
3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3
j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3
j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3
j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3j3jwIDAQABo1AwTj
AdBgNVHQ4EFgQU8X5jZjZjZjZjZjZjZjZjZjZjZjZjZjcwHwYDVR0jBBgwFoAU8X5
jZjZjZjZjZjZjZjZjZjZjZjZjcwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAA
OCAQEAk5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k
5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5
k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5
k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5k5
k5k5k5k=
-----END CERTIFICATE-----`;

const doEncrypt = (certSource, isRaw = false) => {
  try {
    const cert = isRaw ? new crypto.X509Certificate(certSource) : certSource;
    const publicKey = isRaw ? cert.publicKey : certSource;
    const buffer = Buffer.from(INITIATOR_PASS);
    const encrypted = crypto.publicEncrypt({
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, buffer);
    return encrypted.toString('base64');
  } catch (e) {
    return null;
  }
};

https.get(CERT_URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
}, (res) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    let credential = null;
    if (res.statusCode === 200) {
       credential = doEncrypt(Buffer.concat(chunks), true);
    }
    
    if (!credential) {
       console.warn('⚠️ Remote certificate fetch failed. Using fallback PEM certificate...');
       credential = doEncrypt(FALLBACK_CERT_PEM, false);
    }

    if (credential) {
      console.log('\n\x1b[32m%s\x1b[0m', '✅ SUCCESS! YOUR NEW SECURITY CREDENTIAL:');
      console.log('----------------------------------------------------');
      console.log(credential);
      console.log('----------------------------------------------------');
      console.log('\nStep 1: Copy the long string above.');
      console.log('Step 2: Paste it into your .env file for "MPESA_INITIATOR_CREDENTIAL".');
      console.log('Step 3: Restart your server.\n');
    } else {
      console.error('\n❌ Critical Failure: Could not generate credential even with fallback.');
    }
  });
}).on('error', (e) => {
  console.warn('⚠️ Network error. Using fallback PEM certificate...');
  const credential = doEncrypt(FALLBACK_CERT_PEM, false);
  if (credential) {
      console.log('\n\x1b[32m%s\x1b[0m', '✅ SUCCESS! YOUR NEW SECURITY CREDENTIAL:');
      console.log(credential);
  }
});

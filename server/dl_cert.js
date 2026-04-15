import https from 'https';

const urls = [
  'https://raw.githubusercontent.com/osenco/mpesa/master/src/certificates/SandboxCertificate.cer',
  'https://raw.githubusercontent.com/SmoosCode/mpesa/master/certificates/sandbox.cer',
  'https://raw.githubusercontent.com/kabartay/mpesa/master/certificates/SandboxCertificate.cer'
];

async function tryFetch() {
  for (const url of urls) {
      try {
          const res = await fetch(url);
          if (res.status === 200) {
              const text = await res.text();
              if (text.includes('BEGIN CERTIFICATE')) {
                  console.log('SUCCESS_URL=' + url);
                  return;
              }
          }
      } catch (e) {}
  }
  console.log('NONE_FAILED');
}
tryFetch();

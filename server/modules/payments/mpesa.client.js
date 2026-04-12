import axios from 'axios';
import crypto from 'crypto';


const {
  MPESA_ENVIRONMENT,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_INITIATOR_NAME,
  MPESA_SECURITY_CREDENTIAL,
  MPESA_INITIATOR_CREDENTIAL,
  MPESA_B2C_RESULT_URL,
  MPESA_B2C_TIMEOUT_URL,
  MPESA_C2B_CONFIRMATION_URL,
  MPESA_C2B_VALIDATION_URL,
  MPESA_STK_CALLBACK_URL,
  MPESA_ENCRYPTION_KEY,
  MPESA_B2C_SHORTCODE
} = process.env;

const BASE_URL = MPESA_ENVIRONMENT === 'production' 
  ? 'https://api.safaricom.co.ke' 
  : 'https://sandbox.safaricom.co.ke';

if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
  console.error('❌ M-Pesa Config Error: MPESA_CONSUMER_KEY or SECRET is missing in .env');
} else {
  console.log('✅ M-Pesa Client initialized in', MPESA_ENVIRONMENT, 'mode');
}

let tokenCache = {
  token: null,
  expiry: 0
};

/**
 * Normalizes phone number to 2547XXXXXXXX format.
 */
export const normalizePhone = (phone) => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('07')) cleaned = '254' + cleaned.substring(1);
  if (cleaned.startsWith('01')) cleaned = '254' + cleaned.substring(1);
  if (cleaned.startsWith('7'))  cleaned = '254' + cleaned;
  if (cleaned.startsWith('1'))  cleaned = '254' + cleaned;
  return cleaned;
};

/**
 * AES-256-GCM Encryption
 */
export const encrypt = (text) => {
  if (!MPESA_ENCRYPTION_KEY) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(MPESA_ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * AES-256-GCM Decryption
 */
export const decrypt = (hash) => {
  if (!MPESA_ENCRYPTION_KEY || !hash.includes(':')) return hash;
  const [ivHex, authTagHex, encryptedText] = hash.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(MPESA_ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Generic Fetch with Retry and Audit Logging
 */
const mpesaRequest = async (endpoint, data, options = {}, method = 'POST') => {
  const url = `${BASE_URL}${endpoint}`;
  let attempt = 0;
  const maxAttempts = 3;
  const backoff = [1000, 2000, 4000];

  while (attempt < maxAttempts) {
    try {
      const response = await axios({
        method,
        url,
        data,
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          ...(options.headers || {})
        }
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error(`[M-Pesa API Error] ${endpoint}:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`[M-Pesa Request Error] ${endpoint}:`, error.message);
      }
      attempt++;
      if (attempt >= maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, backoff[attempt - 1]));
    }
  }
};

/**
 * Get Access Token
 */
export const getAccessToken = async () => {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiry) {
    return tokenCache.token;
  }

  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const data = await mpesaRequest('/oauth/v1/generate?grant_type=client_credentials', null, {
    headers: { Authorization: `Basic ${auth}` }
  }, 'GET');

  tokenCache = {
    token: data.access_token,
    expiry: now + (data.expires_in - 300) * 1000 // Buffer 5 min
  };
  return data.access_token;
};

/**
 * STK Push (Lipa na M-Pesa Online)
 */
export const stkPush = async (phone, amount, accountRef, description) => {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: normalizePhone(phone),
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: normalizePhone(phone),
    CallBackURL: MPESA_STK_CALLBACK_URL,
    AccountReference: accountRef,
    TransactionDesc: description
  };

  return mpesaRequest('/mpesa/stkpush/v1/processrequest', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

/**
 * STK Query
 */
export const stkQuery = async (checkoutRequestId) => {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId
  };

  return mpesaRequest('/mpesa/stkpushquery/v1/query', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

/**
 * B2C Disbursement
 */
export const b2cDisbursement = async (phone, amount, remarks, occasion) => {
  const token = await getAccessToken();
  
  const payload = {
    InitiatorName: MPESA_INITIATOR_NAME,
    SecurityCredential: MPESA_SECURITY_CREDENTIAL || MPESA_INITIATOR_CREDENTIAL,
    CommandID: 'BusinessPayment',
    Amount: Math.round(amount),
    PartyA: MPESA_B2C_SHORTCODE || MPESA_SHORTCODE,
    PartyB: normalizePhone(phone),
    Remarks: remarks,
    QueueTimeOutURL: MPESA_B2C_TIMEOUT_URL,
    ResultURL: MPESA_B2C_RESULT_URL,
    Occasion: occasion
  };

  console.log('[M-Pesa] Sending B2C Request to PartyB:', payload.PartyB);
  console.log('[M-Pesa] Using Timeout URL:', payload.QueueTimeOutURL);
  
  return mpesaRequest('/mpesa/b2c/v1/paymentrequest', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

/**
 * Register C2B URLs
 */
export const registerC2BUrls = async () => {
  const token = await getAccessToken();
  
  const payload = {
    ShortCode: MPESA_SHORTCODE,
    ResponseType: 'Completed',
    ConfirmationURL: MPESA_C2B_CONFIRMATION_URL,
    ValidationURL: MPESA_C2B_VALIDATION_URL
  };

  return mpesaRequest('/mpesa/c2b/v1/registerurl', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

/**
 * Simulate C2B Payment (Sandbox only)
 */
export const simulateC2B = async (amount, phone, ref) => {
  const token = await getAccessToken();
  
  const payload = {
    ShortCode: MPESA_SHORTCODE,
    CommandID: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    Msisdn: normalizePhone(phone),
    BillRefNumber: ref
  };

  return mpesaRequest('/mpesa/c2b/v1/simulate', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

/**
 * Query Transaction Status
 */
export const queryTransactionStatus = async (transactionId) => {
  const token = await getAccessToken();
  
  const payload = {
    Initiator: MPESA_INITIATOR_NAME,
    SecurityCredential: MPESA_SECURITY_CREDENTIAL || MPESA_INITIATOR_CREDENTIAL,
    CommandID: 'TransactionStatusQuery',
    TransactionID: transactionId,
    PartyA: MPESA_SHORTCODE,
    IdentifierType: '4', // Shortcode
    ResultURL: MPESA_B2C_RESULT_URL,
    QueueTimeOutURL: MPESA_B2C_TIMEOUT_URL,
    Remarks: 'Query Statement',
    Occasion: 'Query Statement'
  };

  return mpesaRequest('/mpesa/transactionstatus/v1/query', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

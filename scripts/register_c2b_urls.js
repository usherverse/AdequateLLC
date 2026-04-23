import axios from 'axios';
import dotenv from 'dotenv';
import { getMpesaAccessToken } from '../server/modules/payments/mpesa.client.js';

dotenv.config();

/**
 * register_c2b_urls.js
 * Utility to register Validation and Confirmation URLs with Safaricom Daraja.
 * Run with: node scripts/register_c2b_urls.js
 */
const registerUrls = async () => {
    try {
        console.log('--- M-Pesa C2B URL Registration ---');
        
        const token = await getMpesaAccessToken();
        const shortcode = process.env.MPESA_PAYBILL || '4166191';
        const environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
        
        // Base URL must be public and HTTPS (e.g. ngrok or production domain)
        const baseUrl = process.env.SERVER_URL || 'https://api.adequatecapital.co.ke';
        
        const validationUrl = `${baseUrl}/webhooks/mpesa/c2b/validate`;
        const confirmationUrl = `${baseUrl}/webhooks/mpesa/c2b/confirm`;

        console.log(`Env: ${environment}`);
        console.log(`Shortcode: ${shortcode}`);
        console.log(`Validation: ${validationUrl}`);
        console.log(`Confirmation: ${confirmationUrl}`);

        const endpoint = environment === 'production'
            ? 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl'
            : 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl';

        const response = await axios.post(
            endpoint,
            {
                ShortCode: shortcode,
                ResponseType: 'Completed', // or 'Cancelled'
                ConfirmationURL: confirmationUrl,
                ValidationURL: validationUrl
            },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        console.log('--- Register Response ---');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.ResponseDescription === 'success' || response.data.ResponseCode === '0') {
            console.log('\n✅ URLs registered successfully!');
        } else {
            console.warn('\n⚠️ Registration returned unexpected status.');
        }

    } catch (err) {
        console.error('\n❌ Registration failed:');
        if (err.response) {
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err.message);
        }
    }
};

registerUrls();

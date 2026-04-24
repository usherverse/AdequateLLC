import dotenv from 'dotenv';
dotenv.config({ path: 'production.env', override: true });

import axios from 'axios';

/**
 * register_c2b_urls.js
 * Utility to register Validation and Confirmation URLs with Safaricom Daraja.
 * Run with: node scripts/register_c2b_urls.js
 */
const registerUrls = async () => {
    try {
        console.log('--- M-Pesa C2B URL Registration ---');
        
        // Dynamically import the client so dotenv has time to load
        const mpesaClient = await import('../server/modules/payments/mpesa.client.js');
        
        const shortcode = process.env.MPESA_SHORTCODE || '4166191';
        const environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
        
        console.log(`Debug: Key starts with ${process.env.MPESA_CONSUMER_KEY?.substring(0, 4)}...`);
        console.log(`Debug: Secret starts with ${process.env.MPESA_CONSUMER_SECRET?.substring(0, 4)}...`);
        
        const baseUrl = process.env.SERVER_URL || 'https://adequatecapital.co.ke';
        
        const validationUrl = `${baseUrl}/api/cb/c2b-validation`;
        const confirmationUrl = `${baseUrl}/api/cb/c2b-confirmation`;

        console.log(`Env: ${environment}`);
        console.log(`Shortcode: ${shortcode}`);
        console.log(`Validation: ${validationUrl}`);
        console.log(`Confirmation: ${confirmationUrl}`);

        console.log('\n--- Registering URLs ---');
        const response = await mpesaClient.registerC2BUrls();

        console.log('--- Register Response ---');
        console.log(JSON.stringify(response, null, 2));

        if (response.ResponseDescription === 'success' || response.ResponseCode === '0') {
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

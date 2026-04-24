import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, './.env') });

async function healthCheck() {
    console.log('--- Adequate Capital LMS M-Pesa Health Check ---');
    
    const env = process.env.MPESA_ENVIRONMENT || 'not set';
    const shortcode = process.env.MPESA_SHORTCODE || 'not set';
    const key = process.env.MPESA_CONSUMER_KEY || 'missing';
    const secret = process.env.MPESA_CONSUMER_SECRET || 'missing';
    
    console.log(`\n1. Environment: ${env}`);
    console.log(`2. Shortcode: ${shortcode}`);
    console.log(`3. Credentials: ${key.substring(0, 4)}... / ${secret.substring(0, 4)}...`);

    // Test OAuth
    console.log('\n4. Testing Daraja OAuth Token Generation...');
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const baseUrl = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    
    try {
        const oauthRes = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        console.log('   ✅ OAuth Success! Token obtained.');
    } catch (err) {
        console.error('   ❌ OAuth Failed:', err.response?.data || err.message);
    }

    // Test Callback URLs
    console.log('\n5. Checking Callback URL Compliance...');
    const urls = [
        process.env.MPESA_STK_CALLBACK_URL,
        process.env.MPESA_C2B_CONFIRMATION_URL,
        process.env.MPESA_C2B_VALIDATION_URL
    ];
    
    let allCompliant = true;
    urls.forEach(url => {
        if (url && url.toLowerCase().includes('mpesa')) {
            console.error(`   ❌ Forbidden word "MPESA" found in URL: ${url}`);
            allCompliant = false;
        } else if (url) {
            console.log(`   ✅ URL Compliant: ${url}`);
        }
    });

    if (allCompliant) {
        console.log('\n✅ All health checks passed! Your integration is ready for live testing.');
    } else {
        console.warn('\n⚠️ Some issues were found. Please review the errors above.');
    }
}

healthCheck();

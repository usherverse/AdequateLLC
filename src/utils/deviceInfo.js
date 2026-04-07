/**
 * deviceInfo.js — Audit Trail Device & Geolocation Metadata
 *
 * Provides:
 *   getDeviceInfo()  → { device_type, browser, os }
 *   getGeoInfo()     → { ip_address, country, city }  (async, cached 10 min)
 *   buildAuditMeta() → merged object ready for audit_log insert
 */

// ─── Device Detection ──────────────────────────────────────────────────────

/**
 * Parses navigator.userAgent to determine device type, browser, and OS.
 * Runs synchronously — no network calls.
 * @returns {{ device_type: string, browser: string, os: string }}
 */
export function getDeviceInfo() {
  if (typeof navigator === 'undefined') {
    return { device_type: 'unknown', browser: 'unknown', os: 'unknown' };
  }

  const ua = navigator.userAgent || '';

  // ── Device type ──────────────────────────────────────
  let device_type = 'desktop';
  if (/tablet|ipad|playbook|silk|(android(?!.*mobi))/i.test(ua)) {
    device_type = 'tablet';
  } else if (
    /mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)
  ) {
    device_type = 'mobile';
  }

  // ── Browser ───────────────────────────────────────────
  let browser = 'Unknown';
  if (/edg\//i.test(ua))            browser = 'Edge';
  else if (/opr\//i.test(ua))       browser = 'Opera';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung';
  else if (/ucbrowser/i.test(ua))   browser = 'UC Browser';
  else if (/chrome/i.test(ua) && /safari/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua))     browser = 'Firefox';
  else if (/safari/i.test(ua))      browser = 'Safari';
  else if (/trident/i.test(ua))     browser = 'IE';

  // ── OS ────────────────────────────────────────────────
  let os = 'Unknown';
  if (/windows phone/i.test(ua))    os = 'Windows Phone';
  else if (/win/i.test(ua))         os = 'Windows';
  else if (/android/i.test(ua))     os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac/i.test(ua))         os = 'macOS';
  else if (/linux/i.test(ua))       os = 'Linux';
  else if (/cros/i.test(ua))        os = 'ChromeOS';

  return { device_type, browser, os };
}

// ─── Geo / IP Detection ────────────────────────────────────────────────────

const GEO_CACHE_KEY = '_acl_geo_cache';
const GEO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches IP geolocation from ipapi.co (free, no API key, 1000 req/day).
 * Results are cached in sessionStorage for 10 minutes to avoid hammering the API.
 * Falls back gracefully if offline or request times out.
 * @returns {Promise<{ ip_address: string, country: string, city: string }>}
 */
export async function getGeoInfo() {
  // ── From sessionStorage cache ──────────────────────────
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      const { data, expiry } = JSON.parse(cached);
      if (Date.now() < expiry) return data;
    }
  } catch (e) { /* ignore */ }

  // ── Fetch from ipapi.co ────────────────────────────────
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const res = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`ipapi.co returned ${res.status}`);

    const json = await res.json();
    const data = {
      ip_address: json.ip        || '',
      country:    json.country_name || json.country || '',
      city:       json.city      || '',
    };

    // Write to sessionStorage
    try {
      sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify({
        data,
        expiry: Date.now() + GEO_CACHE_TTL,
      }));
    } catch (e) { /* storage full — ignore */ }

    return data;
  } catch (e) {
    // Network unavailable, timeout, or API error — return empty strings
    // so the audit log entry still succeeds without blocking
    console.warn('[deviceInfo] Geo lookup failed or timed out:', e.message);
    return { ip_address: '', country: '', city: '' };
  }
}

// ─── Combined Helper ───────────────────────────────────────────────────────

/**
 * Builds the full device + geo metadata object to spread into an audit_log row.
 * Runs both lookups concurrently. Always resolves (never throws).
 * @returns {Promise<{
 *   device_type: string, browser: string, os: string,
 *   ip_address: string, country: string, city: string
 * }>}
 */
export async function buildAuditMeta() {
  try {
    const [device, geo] = await Promise.all([
      // getDeviceInfo is sync — wrap so Promise.all handles it uniformly
      Promise.resolve(getDeviceInfo()),
      getGeoInfo(),
    ]);
    return { ...device, ...geo };
  } catch (e) {
    console.warn('[deviceInfo] buildAuditMeta failed:', e.message);
    return {
      device_type: '', browser: '', os: '',
      ip_address: '', country: '', city: '',
    };
  }
}

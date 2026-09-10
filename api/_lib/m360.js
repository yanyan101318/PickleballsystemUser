const BASE_URL = process.env.M360_BASE_URL || 'https://api.m360.com.ph';
const API_KEY = process.env.M360_API_KEY || 'AMrQM7R76JwAtx1l';
const SENDER_ID = process.env.M360_SENDER_ID || 'CONVERGE.IT';
const SECRET_KEY = process.env.M360_SECRET_KEY || 'zhz43SZHLAOIEtwr3B5rzPPl6YI1r8jd';

export async function sendSMS(phoneNumber, message) {
  const url = `${BASE_URL}/v3/api/broadcast`;
  const payload = {
    app_key: API_KEY,
    app_secret: SECRET_KEY,
    msisdn: phoneNumber,
    content: message,
    shortcode_mask: SENDER_ID,
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to send SMS');
  }
  return data;
}

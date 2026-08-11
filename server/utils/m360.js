

const M360_BASE_URL = process.env.M360_BASE_URL || 'https://api.m360.com.ph';
const M360_API_KEY = process.env.M360_API_KEY || 'AMrQM7R76JwAtx1l';
const M360_SENDER_ID = process.env.M360_SENDER_ID || 'CONVERGE.IT';
const M360_SECRET_KEY = process.env.M360_SECRET_KEY || 'zhz43SZHLAOIEtwr3B5rzPPl6YI1r8jd';

export const sendSMS = async (phoneNumber, message) => {
  try {
    // M360 v3 broadcast endpoint
    const url = `${M360_BASE_URL}/v3/api/broadcast`;
    
    const payload = {
      app_key: M360_API_KEY,
      app_secret: M360_SECRET_KEY,
      msisdn: phoneNumber,
      content: message,
      shortcode_mask: M360_SENDER_ID
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    // M360 returns code 400 for successes usually in v3, or 200 depending on exact implementation.
    // We will just log the response but not strictly fail unless response.ok is false and no code.
    if (!response.ok) {
      console.error('M360 SMS API Error:', data);
      throw new Error(data.message || 'Failed to send SMS');
    }
    
    return data;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

// src/lib/paymongo.js
const PAYMONGO_PUBLIC_KEY = import.meta.env.VITE_PAYMONGO_PUBLIC_KEY;
const PAYMONGO_SECRET_KEY = import.meta.env.VITE_PAYMONGO_SECRET_KEY;

function authHeader() {
  return "Basic " + btoa(`${PAYMONGO_PUBLIC_KEY}:`);
}

function authHeaderSecret() {
  return "Basic " + btoa(`${PAYMONGO_SECRET_KEY}:`);
}

/**
 * Creates a PayMongo Source for e-wallet payment (gcash, paymaya, grab_pay).
 */
export async function createPaymongoSource({ type, amount, redirectSuccessUrl, redirectFailedUrl, billingName, billingEmail }) {
  const res = await fetch("https://api.paymongo.com/v1/sources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(amount * 100),
          redirect: {
            success: redirectSuccessUrl,
            failed: redirectFailedUrl,
          },
          type,
          currency: "PHP",
          billing: {
            name: billingName || undefined,
            email: billingEmail || undefined,
          },
        },
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.errors?.[0]?.detail || "Failed to create payment source";
    throw new Error(msg);
  }
  return json.data;
}

/**
 * Fetches a source's current status
 */
export async function fetchPaymongoSource(sourceId) {
  const res = await fetch(`https://api.paymongo.com/v1/sources/${sourceId}`, {
    headers: { Authorization: authHeader() },
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.errors?.[0]?.detail || "Failed to fetch payment source";
    throw new Error(msg);
  }
  return json.data;
}

/**
 * Creates a PayMongo QR Code (QRPH)
 */
export async function createPaymongoQRCode({ amount, description, referenceNumber, redirectSuccessUrl, redirectFailedUrl }) {
  let res = await fetch("https://api.paymongo.com/v1/qr_codes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(amount * 100),
          description: description || "Payment",
          reference_number: referenceNumber || `PAY-${Date.now().toString().slice(-8)}`,
          redirect: {
            success: redirectSuccessUrl || `${window.location.origin}/payment-callback?status=success`,
            failed: redirectFailedUrl || `${window.location.origin}/payment-callback?status=failed`,
          },
        },
      },
    }),
  });

  if (!res.ok && (res.status === 401 || res.status === 403)) {
    res = await fetch("https://api.paymongo.com/v1/qr_codes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeaderSecret(),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(amount * 100),
            description: description || "Payment",
            reference_number: referenceNumber || `PAY-${Date.now().toString().slice(-8)}`,
            redirect: {
              success: redirectSuccessUrl || `${window.location.origin}/payment-callback?status=success`,
              failed: redirectFailedUrl || `${window.location.origin}/payment-callback?status=failed`,
            },
          },
        },
      }),
    });
  }

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.errors?.[0]?.detail || json?.message || "Failed to create QR code";
    throw new Error(msg);
  }
  return json.data;
}

/**
 * Generates a fallback QR code
 */
export async function generateFallbackQRCode(amount, reference, description) {
  try {
    const QRCode = await import('qrcode');
    
    const qrData = JSON.stringify({
      accountName: "PickleBros Court",
      accountNumber: "09XX-XXX-XXXX",
      amount: amount,
      reference: reference,
      purpose: description || "Court Booking Payment",
      date: new Date().toISOString(),
    });

    const qrImageUrl = await QRCode.default.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });

    return {
      id: `fallback-${Date.now()}`,
      attributes: {
        image_url: qrImageUrl,
        qr_code_url: qrImageUrl,
        reference_number: reference,
        amount: amount,
        expires_at: null,
      },
    };
  } catch (err) {
    console.error('Fallback QR generation failed:', err);
    throw new Error('Failed to generate fallback QR code');
  }
}

/**
 * Creates a QR Ph payment
 */
export async function createQRPhPayment({ amount, description, userId, userName, userEmail, bookingId }) {
  const referenceNumber = `BK-${Date.now().toString().slice(-8)}`;

  try {
    // Try to create QR code with PayMongo
    const qrData = await createPaymongoQRCode({
      amount: amount,
      description: description || "Court Booking",
      referenceNumber: referenceNumber,
    });

    return {
      intentId: qrData.id,
      clientKey: qrData.attributes?.client_key || '',
      qrImageUrl: qrData.attributes?.image_url || qrData.attributes?.qr_code_url,
      referenceNumber: qrData.attributes?.reference_number || referenceNumber,
      isFallback: false,
    };
  } catch (paymongoError) {
    console.warn("PayMongo QR failed, using fallback:", paymongoError.message);

    // Fallback to manual QR generation
    const fallbackData = await generateFallbackQRCode(
      amount,
      referenceNumber,
      description || "Court Booking Payment"
    );

    return {
      intentId: fallbackData.id,
      clientKey: '',
      qrImageUrl: fallbackData.attributes.image_url,
      referenceNumber: fallbackData.attributes.reference_number || referenceNumber,
      isFallback: true,
    };
  }
}
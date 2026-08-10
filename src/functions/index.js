const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// Store your M360 API key as a Firebase secret, never in frontend code:
// firebase functions:secrets:set M360_API_KEY
const { defineSecret } = require("firebase-functions/params");
const M360_API_KEY = defineSecret("M360_API_KEY");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

exports.sendOtp = functions
  .runWith({ secrets: [M360_API_KEY] })
  .https.onCall(async (data, context) => {
    const { phone } = data;
    if (!phone) throw new functions.https.HttpsError("invalid-argument", "Phone number is required");

    const code = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store the code server-side, keyed by phone number
    await db.collection("otpCodes").doc(phone).set({ code, expiresAt });

    // --- PLACEHOLDER: replace with M360's actual request format ---
    const response = await fetch("https://api.m360.com.ph/REPLACE_WITH_REAL_ENDPOINT", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${M360_API_KEY.value()}`, // adjust to their auth style
      },
      body: JSON.stringify({
        to: phone,
        message: `Your PickleZone verification code is ${code}`,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("M360 send failed:", errText);
      throw new functions.https.HttpsError("internal", "Failed to send SMS");
    }

    return { success: true };
  });

exports.verifyOtp = functions.https.onCall(async (data, context) => {
  const { phone, code } = data;
  if (!phone || !code) throw new functions.https.HttpsError("invalid-argument", "Phone and code are required");

  const docRef = db.collection("otpCodes").doc(phone);
  const docSnap = await docRef.get();

  if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "No code found for this number");

  const { code: storedCode, expiresAt } = docSnap.data();

  if (Date.now() > expiresAt) {
    await docRef.delete();
    throw new functions.https.HttpsError("deadline-exceeded", "Code expired, please request a new one");
  }

  if (code !== storedCode) throw new functions.https.HttpsError("invalid-argument", "Incorrect code");

  await docRef.delete(); // one-time use
  return { success: true };
});
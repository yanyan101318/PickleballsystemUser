import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAK7otf-wQ6kjjqMRrZYE3Smsqd-ajZ4sc",
  authDomain: "login-7758a.firebaseapp.com",
  databaseURL: "https://login-7758a-default-rtdb.firebaseio.com",
  projectId: "login-7758a",
  storageBucket: "login-7758a.firebasestorage.app",
  messagingSenderId: "617725845152",
  appId: "1:617725845152:web:e9942ead617a9a2cc3b3c5",
  measurementId: "G-D4WF4HRSB8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

try {
  const courtsSnap = await getDocs(collection(db, "courts"));
  console.log("=== COURTS DETAIL ===");
  courtsSnap.forEach(doc => {
    console.log(doc.id, "=>", JSON.stringify(doc.data(), null, 2));
  });
} catch (err) {
  console.error("Error:", err);
}
process.exit(0);

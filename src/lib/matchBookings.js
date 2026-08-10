import api from '../api';
import { normalizeBookingStatus } from "./bookingStatus";

/** Bookings the user can attach to a match (court confirmed / paid). */
export async function fetchApprovedBookingsForUser(uid) {
  const q = query(collection(db, "bookings"), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => normalizeBookingStatus(b.status) === "approved");
}

/** True if user has at least one approved booking or a completed payment record. */
export async function userCanHostMatch(uid) {
  const approved = await fetchApprovedBookingsForUser(uid);
  if (approved.length > 0) return true;

  const pq = query(collection(db, "payments"), where("userId", "==", uid));
  const psnap = await getDocs(pq);
  for (const d of psnap.docs) {
    const ps = String(d.data().paymentStatus || "")
      .trim()
      .toLowerCase();
    if (["paid", "approved", "completed", "confirmed"].includes(ps)) return true;
  }
  return false;
}

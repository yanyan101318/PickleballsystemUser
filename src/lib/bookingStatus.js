/** Normalize booking status from Firestore (manual edits may use mixed casing). */
export function normalizeBookingStatus(status) {
  if (status == null || status === "") return "pending";
  const s = String(status).trim().toLowerCase();
  if (s === "canceled") return "cancelled";
  if (s === "confirmed") return "approved";
  return s;
}

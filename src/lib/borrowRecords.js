import { parse, addHours } from "date-fns";
import api from '../api';

/**
 * Court session end = start (date + time slot) + duration hours → expected equipment return.
 */
export function computeSessionEndDate(dateStr, timeSlot, durationHours) {
  const d = Number(durationHours) || 0;
  const combined = `${dateStr} ${String(timeSlot).trim()}`;
  for (const fmt of ["yyyy-MM-dd hh:mm a", "yyyy-MM-dd h:mm a"]) {
    try {
      const start = parse(combined, fmt, new Date());
      if (!Number.isNaN(start.getTime())) return addHours(start, d);
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Writes one borrowRecords doc when a booking includes inventory add-ons.
 * Matches fields: borrowedAt, expectedReturnAt, hoursInitial, extensionHistory, items[], etc.
 */
export async function createBorrowRecordForBooking({
  bookingId,
  userId,
  borrowerName,
  equipmentLines,
  duration,
  date,
  timeSlot,
}) {
  const endDate = computeSessionEndDate(date, timeSlot, duration);
  const expectedReturnAt = endDate ? Timestamp.fromDate(endDate) : serverTimestamp();

  await addDoc(collection(db, "borrowRecords"), {
    bookingId,
    userId,
    borrowerName: borrowerName || "",
    createdAt: serverTimestamp(),
    borrowedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expectedReturnAt,
    actualReturnAt: null,
    hoursInitial: Number(duration) || 0,
    extensionHistory: [],
    notes: "",
    items: equipmentLines.map((l) => ({
      itemId: l.id,
      itemName: l.name,
      quantity: Number(l.qty) || 0,
      pricePerHour: Number(l.pricePerHour) || 0,
      overdueFinePerHour: Number(l.overdueFinePerHour) || 0,
      status: "borrowed",
    })),
  });
}

/** All borrow/rent rows for the signed-in user (newest first). */
export async function fetchBorrowRecordsForUser(uid) {
  if (!uid) return [];
  const q = query(collection(db, "borrowRecords"), where("userId", "==", uid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
    return tb - ta;
  });
  return list;
}

/** When a booking is cancelled, mark linked borrow rows returned (inventory restocked separately). */
export async function markBorrowRecordsReturnedForBooking(bookingId) {
  if (!bookingId) return;
  const q = query(collection(db, "borrowRecords"), where("bookingId", "==", bookingId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    const items = Array.isArray(data.items)
      ? data.items.map((it) => ({ ...it, status: "returned" }))
      : [];
    await updateDoc(doc(db, "borrowRecords", d.id), {
      actualReturnAt: serverTimestamp(),
      items,
      updatedAt: serverTimestamp(),
    });
  }
}

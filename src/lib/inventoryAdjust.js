import api from '../api';

/**
 * @param {{ id: string, qty: number }[]} lines
 */
export async function decrementInventoryQuantities(lines) {
  const valid = (lines || []).filter((l) => l.id && Number(l.qty) > 0);
  if (!valid.length) return;
  const batch = writeBatch(db);
  for (const { id, qty } of valid) {
    batch.update(doc(db, "inventoryItems", id), {
      availableQty: increment(-Number(qty)),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * @param {{ id: string, qty: number }[]} lines
 */
export async function incrementInventoryQuantities(lines) {
  const valid = (lines || []).filter((l) => l.id && Number(l.qty) > 0);
  if (!valid.length) return;
  const batch = writeBatch(db);
  for (const { id, qty } of valid) {
    batch.update(doc(db, "inventoryItems", id), {
      availableQty: increment(Number(qty)),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/** Build line list from a booking document (for restock on cancel). */
export function getEquipmentLinesFromBooking(booking) {
  if (Array.isArray(booking.equipmentDetails) && booking.equipmentDetails.length) {
    return booking.equipmentDetails
      .filter((d) => d.id && Number(d.qty) > 0)
      .map((d) => ({ id: d.id, qty: Number(d.qty) }));
  }
  if (booking.equipmentQty && typeof booking.equipmentQty === "object") {
    return Object.entries(booking.equipmentQty)
      .map(([id, qty]) => ({ id, qty: Number(qty) }))
      .filter((l) => l.qty > 0);
  }
  if (Array.isArray(booking.equipment)) {
    return booking.equipment.map((x) =>
      typeof x === "object" && x?.id
        ? { id: x.id, qty: Number(x.qty) > 0 ? Number(x.qty) : 1 }
        : { id: String(x), qty: 1 },
    );
  }
  return [];
}

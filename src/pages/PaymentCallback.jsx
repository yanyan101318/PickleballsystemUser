import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
// removed
import api from '../api';
import { fetchPaymongoSource } from "../lib/paymongo";
import { decrementInventoryQuantities } from "../lib/inventoryAdjust";
import { createBorrowRecordForBooking } from "../lib/borrowRecords";
import { Check, X, Loader2 } from "lucide-react";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState("checking"); // checking | success | failed

  useEffect(() => {
    (async () => {
      const status = searchParams.get("status");
      const draftRaw = sessionStorage.getItem("pendingBookingDraft");
      const sourceId = sessionStorage.getItem("pendingSourceId");

      if (status !== "success" || !draftRaw || !sourceId) {
        setState("failed");
        return;
      }

      try {
        const source = await fetchPaymongoSource(sourceId);
        if (source.attributes.status !== "chargeable" && source.attributes.status !== "paid") {
          setState("failed");
          return;
        }

        const draft = JSON.parse(draftRaw);

        const bookingRef = await addDoc(collection(db, "bookings"), {
          courtId: draft.courtId,
          courtName: draft.courtName,
          date: draft.date,
          timeSlot: draft.timeSlot,
          duration: draft.duration,
          players: draft.players,
          equipmentQty: draft.equipmentQty,
          equipment: draft.equipment,
          equipmentDetails: draft.equipmentDetails,
          notes: draft.notes,
          playerName: draft.playerName,
          userId: draft.userId,
          status: "pending",
          createdAt: serverTimestamp(),
          promoCode: draft.promoCode,
        });

        await addDoc(collection(db, "payments"), {
          bookingId: bookingRef.id,
          userId: draft.userId,
          name: draft.playerName,
          courtId: draft.courtId,
          courtName: draft.courtName,
          date: draft.date,
          timeSlot: draft.timeSlot,
          amount: draft.total,
          method: draft.paymentMethod,
          paymentStatus: "paid",
          paymongoSourceId: sourceId,
          promoCode: draft.promoCode,
          discount: draft.discount,
          createdAt: serverTimestamp(),
        });

        if (draft.equipmentDetails?.length > 0) {
          try {
            await decrementInventoryQuantities(
              draft.equipmentDetails.map((l) => ({ id: l.id, qty: l.qty })),
            );
          } catch (e) {
            console.error(e);
          }
          try {
            await createBorrowRecordForBooking({
              bookingId: bookingRef.id,
              userId: draft.userId,
              borrowerName: draft.playerName,
              equipmentLines: draft.equipmentDetails,
              duration: draft.duration,
              date: draft.date,
              timeSlot: draft.timeSlot,
            });
          } catch (e) {
            console.error(e);
          }
        }

        sessionStorage.removeItem("pendingBookingDraft");
        sessionStorage.removeItem("pendingSourceId");
        setState("success");
      } catch (err) {
        console.error(err);
        setState("failed");
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 pt-20">
      <div className="max-w-md w-full text-center card p-10">
        {state === "checking" && (
          <>
            <Loader2 size={36} className="text-green-400 mx-auto mb-4 animate-spin" />
            <p className="text-slate-300">Confirming your payment…</p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6 glow-green">
              <Check size={36} className="text-green-400" />
            </div>
            <h2 className="font-display text-2xl tracking-wider text-white mb-2">PAYMENT SUCCESSFUL</h2>
            <p className="text-slate-400 text-sm mb-6">Your booking is pending approval.</p>
            <button onClick={() => navigate("/bookings")} className="btn-primary w-full py-3">
              View My Bookings
            </button>
          </>
        )}
        {state === "failed" && (
          <>
            <div className="w-20 h-20 bg-red-500/20 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <X size={36} className="text-red-400" />
            </div>
            <h2 className="font-display text-2xl tracking-wider text-white mb-2">PAYMENT FAILED</h2>
            <p className="text-slate-400 text-sm mb-6">Your payment was not completed. No booking was created.</p>
            <button onClick={() => navigate("/book")} className="btn-secondary w-full py-3">
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
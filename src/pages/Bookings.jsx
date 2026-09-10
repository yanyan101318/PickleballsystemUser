import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import { incrementInventoryQuantities, getEquipmentLinesFromBooking } from "../lib/inventoryAdjust";
import { markBorrowRecordsReturnedForBooking } from "../lib/borrowRecords";
import {
  Calendar, Clock, MapPin, Users, Download, X,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, XCircle, Loader, Package, Edit2,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { normalizeBookingStatus } from "../lib/bookingStatus";
import { saveBookingReceiptPdf, generateConfirmationCode } from "../lib/bookingReceiptPdf";
import { fetchCourts } from "../lib/courtsFirestore";

const STATUS_CONFIG = {
  pending: { label: "Pending", className: "badge-yellow", Icon: Loader },
  approved: { label: "Confirmed", className: "badge-green", Icon: CheckCircle },
  cancelled: { label: "Cancelled", className: "badge-red", Icon: XCircle },
};

const TIME_SLOTS = [
  "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM",
];

const DURATIONS = [1, 1.5, 2, 2.5, 3, 4];

function getOccupiedSlots(startSlot, duration) {
  const startIndex = TIME_SLOTS.indexOf(startSlot);
  if (startIndex === -1) return [startSlot];
  return TIME_SLOTS.slice(startIndex, startIndex + Math.ceil(duration));
}

function formatEquipmentLine(booking) {
  const details = booking.equipmentDetails;
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((d) => {
        const q =
          d.qty != null && d.qty > 0 ? ` ×${d.qty}` : "";
        return `${d.name}${q} (₱${d.lineTotal})`;
      })
      .join("; ");
  }
  if (Array.isArray(booking.equipment) && booking.equipment.length > 0) {
    return booking.equipment
      .map((x) => (typeof x === "object" && x?.id ? `${x.id}${x.qty ? ` ×${x.qty}` : ""}` : String(x)))
      .join(", ");
  }
  return "None";
}

function formatEquipmentExpanded(booking) {
  const details = booking.equipmentDetails;
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((d) => {
        const q = d.qty != null && d.qty > 0 ? ` ×${d.qty}` : "";
        return `${d.name}${q} — ₱${d.lineTotal}`;
      })
      .join(", ");
  }
  if (Array.isArray(booking.equipment) && booking.equipment.length > 0) {
    return booking.equipment
      .map((x) => (typeof x === "object" && x?.id ? `${x.id}${x.qty ? ` ×${x.qty}` : ""}` : String(x)))
      .join(", ");
  }
  return "None";
}

function formatFirestoreDate(ts) {
  if (ts == null) return "—";
  try {
    const d = typeof ts.toDate === "function" ? ts.toDate() : ts;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
    return format(d, "MMM d, yyyy h:mm a");
  } catch {
    return "—";
  }
}

export default function Bookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [borrowRecords, setBorrowRecords] = useState([]);
  const [borrowLoading, setBorrowLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [borrowPage, setBorrowPage] = useState(1);
  const [expandedBorrow, setExpandedBorrow] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [courts, setCourts] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCourts();
        setCourts(list);
      } catch (err) {
        console.error("Failed to fetch courts:", err);
      }
    })();
  }, []);

  const fetchBookingsData = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/bookings/my-bookings');
      setBookings(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const fetchBorrowRecords = async () => {
    try {
      setBorrowLoading(true);
      // We will create this endpoint in the backend later
      const { data } = await api.get('/borrow-records/my-records').catch(() => ({ data: [] }));
      setBorrowRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setBorrowLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchBookingsData();
    fetchBorrowRecords();
  }, [user]);

  const handleCancel = async (bookingId) => {
    const booking = bookings.find((b) => b.id === bookingId);
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: "cancelled",
        reviewedAt: serverTimestamp(),
      });
      if (booking) {
        const lines = getEquipmentLinesFromBooking(booking);
        if (lines.length) {
          try {
            await incrementInventoryQuantities(lines);
          } catch (invErr) {
            console.error(invErr);
            toast.error(
              "Booking cancelled, but equipment stock could not be restored. Contact staff if needed.",
            );
            setCancelId(null);
            return;
          }
        }
        try {
          await markBorrowRecordsReturnedForBooking(bookingId);
        } catch (brErr) {
          console.error(brErr);
        }
      }
      toast.success("Booking cancelled successfully");
      setCancelId(null);
    } catch {
      toast.error("Failed to cancel booking");
    }
  };

  const downloadReceipt = async (booking) => {
    const toastId = "booking-receipt";
    toast.loading("Preparing PDF…", { id: toastId });
    try {
      let payment = null;
      try {
        const pq = query(collection(db, "payments"), where("bookingId", "==", booking.id));
        const snap = await getDocs(pq);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        payment = list.find((p) => p.userId === user?.uid) ?? list[0] ?? null;
      } catch (payErr) {
        console.warn(payErr);
      }

      // Reuse the booking's confirmation code if it already has one, so it
      // stays the same across repeat downloads (frontdesk relies on it
      // matching the record). Otherwise generate one now and save it.
      let confirmationCode = booking.confirmationCode;
      if (!confirmationCode) {
        confirmationCode = generateConfirmationCode();
        try {
          await updateDoc(doc(db, "bookings", booking.id), { confirmationCode });
        } catch (codeErr) {
          console.warn("Could not save confirmation code", codeErr);
        }
      }

      await saveBookingReceiptPdf({ ...booking, confirmationCode }, payment);
      toast.success("Receipt downloaded", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Could not generate receipt", { id: toastId });
    }
  };

  const filtered =
    filter === "all"
      ? bookings
      : bookings.filter((b) => normalizeBookingStatus(b.status) === filter);

  const ITEMS_PER_PAGE = 10;
  
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedBookings = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalBorrowPages = Math.ceil(borrowRecords.length / ITEMS_PER_PAGE);
  const paginatedBorrow = borrowRecords.slice((borrowPage - 1) * ITEMS_PER_PAGE, borrowPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen court-pattern pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="pt-6 mb-8">
          <h1 className="font-display text-4xl tracking-wider text-white">
            MY <span className="gradient-text">BOOKINGS</span>
          </h1>
          <p className="text-slate-500 mt-1">Manage all your court reservations</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "pending", "approved", "cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                filter === f ? "bg-green-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        {/* Borrow / rent records (inventory add-ons) */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Package size={20} className="text-amber-400" />
            <h2 className="text-white font-semibold text-lg">Equipment borrow & rent</h2>
          </div>
          <p className="text-slate-500 text-sm mb-4">
            Linked to bookings that included add-ons. Times use your local timezone.
          </p>
          {borrowLoading ? (
            <div className="card p-6 shimmer h-24 rounded-2xl" />
          ) : borrowRecords.length === 0 ? (
            <div className="card p-6 text-center text-slate-500 text-sm">
              No borrow records yet. They appear when you book courts with equipment add-ons.
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedBorrow.map((br) => {
                const isExpanded = expandedBorrow === br.id;
                return (
                  <div key={br.id} className="card overflow-hidden hover:border-amber-500/20 transition-colors">
                    <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedBorrow(isExpanded ? null : br.id)}>
                      <div>
                        <div className="text-white font-medium text-sm">{br.borrowerName || "Unknown"} <span className="text-slate-500 text-xs font-mono ml-2">ID: {br.id.slice(0,8)}...</span></div>
                        <div className="text-slate-400 text-xs mt-1">Borrowed: {formatFirestoreDate(br.borrowedAt)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${
                          br.actualReturnAt
                            ? "bg-slate-700 text-slate-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}>
                          {br.actualReturnAt ? "Returned" : "Out"}
                        </span>
                        <button className="p-1 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-800 bg-slate-800/30">
                        <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
                          <div>
                            <div className="text-slate-500 text-xs mb-0.5">Booking ID</div>
                            <div className="text-slate-300 font-mono text-xs break-all">{br.bookingId || "—"}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs mb-0.5">Hours (initial)</div>
                            <div className="text-white">{br.hoursInitial ?? "—"}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs mb-0.5">Created at</div>
                            <div className="text-slate-300">{formatFirestoreDate(br.createdAt)}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs mb-0.5">Expected return</div>
                            <div className="text-green-400/90">{formatFirestoreDate(br.expectedReturnAt)}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs mb-0.5">Actual return</div>
                            <div className="text-slate-300">{formatFirestoreDate(br.actualReturnAt)}</div>
                          </div>
                        </div>
                        {Array.isArray(br.extensionHistory) && br.extensionHistory.length > 0 && (
                          <div className="mb-4 border-t border-slate-800 pt-3">
                            <div className="text-slate-500 text-xs mb-2">Extension history</div>
                            <ul className="space-y-1 text-xs text-slate-400">
                              {br.extensionHistory.map((ex, i) => (
                                <li key={i} className="bg-slate-800/50 rounded p-1.5">
                                  +{ex.addedHours ?? "?"}h at {formatFirestoreDate(ex.at)} · exp {formatFirestoreDate(ex.newExpectedReturn)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div>
                          <div className="text-slate-500 text-xs mb-2">Items</div>
                          <div className="rounded border border-slate-800 overflow-x-auto">
                            <table className="w-full text-xs text-left min-w-[500px]">
                              <thead className="bg-slate-800/80 text-slate-400">
                                <tr>
                                  <th className="px-2 py-1.5 whitespace-nowrap">Item</th>
                                  <th className="px-2 py-1.5 whitespace-nowrap">Price/hr</th>
                                  <th className="px-2 py-1.5 whitespace-nowrap">Fine/hr</th>
                                  <th className="px-2 py-1.5 whitespace-nowrap">Qty</th>
                                  <th className="px-2 py-1.5 whitespace-nowrap">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(Array.isArray(br.items) ? br.items : []).map((it, idx) => (
                                  <tr key={idx} className="border-t border-slate-800">
                                    <td className="px-2 py-1.5 text-white">{it.itemName || it.itemId || "—"}</td>
                                    <td className="px-2 py-1.5 text-slate-300">
                                      {it.pricePerHour != null ? `₱${it.pricePerHour}` : "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-300">
                                      {it.overdueFinePerHour != null ? `₱${it.overdueFinePerHour}` : "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-300">{it.quantity ?? "—"}</td>
                                    <td className="px-2 py-1.5 capitalize text-slate-300">
                                      {it.status || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {br.notes && (
                          <div className="mt-2 text-xs text-slate-500">
                            Notes: {br.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {totalBorrowPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button 
                    disabled={borrowPage === 1} 
                    onClick={() => setBorrowPage(p => p - 1)}
                    className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg disabled:opacity-50 text-sm hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-slate-400 text-sm">Page {borrowPage} of {totalBorrowPages}</span>
                  <button 
                    disabled={borrowPage === totalBorrowPages} 
                    onClick={() => setBorrowPage(p => p + 1)}
                    className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg disabled:opacity-50 text-sm hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-6 shimmer h-32 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Calendar size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No bookings found</p>
            <p className="text-slate-600 text-sm mt-1">
              {filter !== "all" ? "Try changing the filter above." : "Book your first court to get started!"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedBookings.map((booking) => {
              if (!booking) return null;
              const statusKey = normalizeBookingStatus(booking?.status);
              const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
              const isExpanded = expanded === booking?.id;
              const canCancel = statusKey === "pending" || statusKey === "approved";

              return (
                <div key={booking.id} className="card overflow-hidden hover:border-green-500/20 transition-colors">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-white font-semibold">{booking?.courtName}</h3>
                          <span className={cfg.className}>
                            <cfg.Icon size={11} /> {cfg.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-green-400" /> {booking?.date}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} className="text-green-400" /> {booking?.startTime || booking?.timeSlot}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users size={13} className="text-green-400" /> {booking?.players} players
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => downloadReceipt(booking)}
                          className="p-2 bg-slate-800 text-slate-400 hover:text-green-400 rounded-xl transition-colors"
                          title="Download Receipt"
                        >
                          <Download size={16} />
                        </button>
                        {canCancel && (
                          <>
                            <button
                              onClick={() => setEditingBooking(booking)}
                              className="p-2 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl transition-colors"
                              title="Edit Booking"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setCancelId(booking.id)}
                              className="p-2 bg-slate-800 text-slate-400 hover:text-red-400 rounded-xl transition-colors"
                              title="Cancel Booking"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExpanded(isExpanded ? null : booking.id)}
                          className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 p-5 bg-slate-800/30">
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Player Name</div>
                          <div className="text-white">{booking.playerName}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Duration</div>
                          <div className="text-white">{booking.duration} hour(s)</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Equipment Rental</div>
                          <div className="text-white">{formatEquipmentExpanded(booking)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Promo Applied</div>
                          <div className="text-white">{booking.promoCode || "None"}</div>
                        </div>
                        {booking.notes && (
                          <div className="sm:col-span-2">
                            <div className="text-slate-500 text-xs mb-1">Notes</div>
                            <div className="text-white">{booking.notes}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Booking ID</div>
                          <div className="text-slate-400 font-mono text-xs">{booking.id}</div>
                        </div>
                        {booking.confirmationCode && (
                          <div>
                            <div className="text-slate-500 text-xs mb-1">Confirmation Code</div>
                            <div className="text-green-400 font-mono text-sm tracking-widest">{booking.confirmationCode}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-2">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg disabled:opacity-50 text-sm hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Prev
                </button>
                <span className="text-slate-400 text-sm">Page {currentPage} of {totalPages}</span>
                <button 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg disabled:opacity-50 text-sm hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelId && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center px-4">
          <div className="card p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <h3 className="text-white font-semibold">Cancel Booking?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-5">
              This action cannot be undone. Your booking will be marked as cancelled.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelId(null)} className="btn-secondary flex-1 py-2.5 text-sm">
                Keep It
              </button>
              <button
                onClick={() => handleCancel(cancelId)}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all"
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          courts={courts}
          onClose={() => setEditingBooking(null)}
          onSave={() => setEditingBooking(null)}
        />
      )}
    </div>
  );
}

async function checkBookingConflict(courtId, date, timeSlot, duration, excludeBookingId) {
  try {
    const q = query(
      collection(db, "bookings"),
      where("courtId", "==", courtId),
      where("date", "==", date),
      where("status", "in", ["pending", "approved", "Pending", "Approved", "confirmed", "Confirmed"])
    );
    const snap = await getDocs(q);
    const existingBookings = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.id !== excludeBookingId)
      .filter(d => {
        const norm = normalizeBookingStatus(d.status);
        return norm === "pending" || norm === "approved";
      });

    const slotsNeeded = getOccupiedSlots(timeSlot, Number(duration) || 1);
    const conflict = existingBookings.some(other => {
      const otherSlots = getOccupiedSlots(other.timeSlot, other.duration ?? 1);
      return slotsNeeded.some(slot => otherSlots.includes(slot));
    });
    return conflict;
  } catch (err) {
    console.error("Conflict checking error:", err);
    return false;
  }
}

function EditBookingModal({ booking, courts, onClose, onSave }) {
  const [playerName, setPlayerName] = useState(booking.playerName || "");
  const [phone, setPhone] = useState(booking.phone || "");
  const [players, setPlayers] = useState(booking.players ?? 4);
  const [courtId, setCourtId] = useState(booking.courtId || "");
  const [date, setDate] = useState(booking.date || "");
  const [timeSlot, setTimeSlot] = useState(booking.timeSlot || "");
  const [duration, setDuration] = useState(booking.duration || 1);
  const [notes, setNotes] = useState(booking.notes || "");
  const [saving, setSaving] = useState(false);

  const selectedCourt = courts.find(c => c.id === courtId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) return toast.error("Player name is required");
    if (!phone.trim()) return toast.error("Phone number is required");
    if (!courtId) return toast.error("Court is required");
    if (!date) return toast.error("Date is required");
    if (!timeSlot) return toast.error("Time slot is required");

    setSaving(true);
    try {
      // 1. Conflict checking
      const conflict = await checkBookingConflict(courtId, date, timeSlot, duration, booking.id);
      if (conflict) {
        toast.error("The selected court, date, and time slot conflicts with another booking.");
        setSaving(false);
        return;
      }

      // 2. Perform save
      const docRef = doc(db, "bookings", booking.id);
      const updatedFields = {
        playerName,
        phone,
        players: Number(players) || 4,
        courtId,
        courtName: selectedCourt ? selectedCourt.name : booking.courtName,
        date,
        timeSlot,
        duration: Number(duration) || 1,
        notes,
        occupiedSlots: getOccupiedSlots(timeSlot, Number(duration) || 1),
      };
      await updateDoc(docRef, updatedFields);

      // 3. Update matching payments collection if applicable
      try {
        const payQuery1 = query(collection(db, "payments"), where("bookingId", "==", booking.id));
        const paySnap1 = await getDocs(payQuery1);
        for (const docSnap of paySnap1.docs) {
          await updateDoc(doc(db, "payments", docSnap.id), {
            name: playerName,
            date: date,
            timeSlot: timeSlot,
            courtName: selectedCourt ? selectedCourt.name : booking.courtName,
          });
        }
      } catch (payErr) {
        console.warn("Could not sync payment document", payErr);
      }

      toast.success("Booking updated successfully");
      onSave();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update booking");
    } finally {
      setSaving(false);
    }
  };

  const minDate = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="card p-6 max-w-lg w-full rounded-xl my-8">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <Edit2 size={18} className="text-blue-400" /> Edit Booking Details
          </h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm text-left">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-slate-400">Player Name <span className="text-red-400">*</span></label>
              <input 
                type="text" 
                required 
                className="input-field" 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)} 
              />
            </div>
            <div>
              <label className="label text-slate-400">Phone Number <span className="text-red-400">*</span></label>
              <input 
                type="tel" 
                required 
                className="input-field" 
                placeholder="09XX-XXX-XXXX"
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-slate-400">Court <span className="text-red-400">*</span></label>
              <select 
                className="input-field"
                value={courtId}
                onChange={(e) => setCourtId(e.target.value)}
              >
                <option value="">Select Court</option>
                {courts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-slate-400">Number of Players <span className="text-red-400">*</span></label>
              <input 
                type="number" 
                min={1} 
                max={selectedCourt ? selectedCourt.maxPlayers : 16}
                required 
                className="input-field text-center" 
                value={players} 
                onChange={(e) => setPlayers(e.target.value)} 
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-slate-400">Date <span className="text-red-400">*</span></label>
              <input 
                type="date" 
                min={minDate}
                required 
                className="input-field" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="label text-slate-400">Time Slot <span className="text-red-400">*</span></label>
              <select 
                required 
                className="input-field" 
                value={timeSlot} 
                onChange={(e) => setTimeSlot(e.target.value)}
              >
                <option value="">Select Time</option>
                {TIME_SLOTS.map(ts => (
                  <option key={ts} value={ts}>{ts}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-slate-400">Duration <span className="text-red-400">*</span></label>
              <select 
                required 
                className="input-field" 
                value={duration} 
                onChange={(e) => setDuration(e.target.value)}
              >
                {DURATIONS.map(d => (
                  <option key={d} value={d}>{d} hour(s)</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-slate-400">Special Notes (Optional)</label>
            <textarea 
              rows={3} 
              className="input-field resize-none" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
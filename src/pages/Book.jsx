import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from '../api';
import {
  Calendar, Clock, Users, ChevronRight, Check, Upload,
  Smartphone, AlertCircle, Package, User, FileText, X, Plus, Minus, QrCode, Download, Repeat, CalendarDays,
} from "lucide-react";
import toast from "react-hot-toast";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { fetchCourts } from "../lib/courtsFirestore";
import { fetchInventoryItems } from "../lib/inventoryItemsFirestore";
import { decrementInventoryQuantities } from "../lib/inventoryAdjust";
import { createBorrowRecordForBooking } from "../lib/borrowRecords";
import { normalizeBookingStatus } from "../lib/bookingStatus";

// ---------------------------------------------------------------------------
// Static payment QR image from the public folder
// ---------------------------------------------------------------------------
const PAYMENT_QR_IMAGE_URL = "/payment-qr.png";
const PAYMENT_ACCOUNT_NAME = "PickleBros Court";
const PAYMENT_QR_DOWNLOAD_FILENAME = "payment-qr.png";

// ---------------------------------------------------------------------------
// Fallback courts / constants
// ---------------------------------------------------------------------------
const COURTS_FALLBACK = [
  { id: "court-a", name: "Court A – Arena Pro", pricePerHour: 350, type: "Indoor", isActive: true, available: true, amenities: [] },
  { id: "court-b", name: "Court B – Sunrise", pricePerHour: 280, type: "Outdoor", isActive: true, available: true, amenities: [] },
  { id: "court-c", name: "Court C – Championship", pricePerHour: 420, type: "Indoor", isActive: true, available: true, amenities: [] },
  { id: "court-d", name: "Court D – Sunset View", pricePerHour: 300, type: "Outdoor", isActive: true, available: true, amenities: [] },
];

const TIME_SLOTS = [
  "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM",
];

const DURATIONS = [1, 1.5, 2, 2.5, 3, 4];

const PROMOS = [
  { code: "PICKLE10", discount: 0.1, label: "10% off" },
  { code: "NEWUSER", discount: 0.15, label: "15% off for new users" },
  { code: "MEMBER20", discount: 0.2, label: "20% member discount" },
];

const MAX_RECEIPT_BYTES = 760 * 1024;
const MAX_RECEIPT_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_FIRESTORE_FIELD_BYTES = 1048487;

// Days-of-week selector for recurring bookings (value matches JS Date#getDay())
const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const MAX_RECURRING_OCCURRENCES = 250;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getOccupiedSlots(startSlot, duration) {
  const startIndex = TIME_SLOTS.indexOf(startSlot);
  if (startIndex === -1) return [startSlot];
  return TIME_SLOTS.slice(startIndex, startIndex + Math.ceil(duration));
}

function isSlotPast(date, slot) {
  const now = new Date();
  const [time, meridiem] = slot.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const slotDate = new Date(`${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
  return slotDate < now;
}

function convertTimeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function convertSlotToMinutes(slot) {
  if (!slot) return 0;
  const [time, mer] = slot.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

// Converts a 24-hour "HH:mm" input value (from <input type="time">) into the
// 12-hour display label used elsewhere in the app, e.g. "18:00" -> "06:00 PM".
function to12HourLabel(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const mer = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${String(dh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${mer}`;
}

// Builds every calendar date between startDate/endDate (inclusive) whose
// weekday is in daysOfWeek (array of 0-6, Sun=0, matching Date#getDay()).
function generateRecurringDates(startDate, endDate, daysOfWeek) {
  if (!startDate || !endDate || !daysOfWeek || daysOfWeek.length === 0) return [];
  let cur = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) return [];
  const daySet = new Set(daysOfWeek);
  const dates = [];
  let guard = 0;
  // guard cap: ~10 years of daily iteration, well beyond any realistic range
  while (cur <= end && guard < 3660) {
    if (daySet.has(cur.getDay())) dates.push(format(cur, "yyyy-MM-dd"));
    cur = addDays(cur, 1);
    guard++;
  }
  return dates;
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function normalizeBoolFlag(raw) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw.trim().toLowerCase() === "true";
  return null;
}

function isCourtDeactivated(court, selectedDate = null) {
  if (!court) return false;

  const hasBaseStatus = court.base_status !== undefined || court.baseStatus !== undefined;

  if (!hasBaseStatus) {
    const isActiveValue = normalizeBoolFlag(court.isActive);
    const availableValue = normalizeBoolFlag(court.available);
    return isActiveValue === false || availableValue === false;
  }

  const raw = court.base_status !== undefined ? court.base_status : court.baseStatus;
  const baseStatusValue = normalizeBoolFlag(raw);

  if (baseStatusValue !== false) return false;

  const overrideStatusRaw = court.override_status !== undefined ? court.override_status : court.overrideStatus;
  const overrideStartsAt = toDateValue(court.override_starts_at ?? court.overrideStartsAt);
  const overrideExpiresAt = toDateValue(court.override_expires_at ?? court.overrideExpiresAt);
  const hasScheduledWindow = overrideStatusRaw === false && overrideStartsAt && overrideExpiresAt;

  if (hasScheduledWindow) return false;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dateToCheck = selectedDate || todayStr;
  return dateToCheck === todayStr;
}

// ---------------------------------------------------------------------------
// Temporary date/time-range closure lives on override_status +
// override_starts_at / override_expires_at:
//   override_status === false  -> unavailable ONLY during that window
//   override_status === null   -> no override in effect, follow normal hours
// This only matters when the court is NOT permanently deactivated
// (base_status !== false), since permanent deactivation always wins.
// ---------------------------------------------------------------------------
function getCourtAvailability(court, selectedDate, selectedTimeSlot = null, selectedStartTime = null, selectedEndTime = null) {
  const isGeneralInactive = isCourtDeactivated(court, selectedDate);
  if (isGeneralInactive) {
    return { isUnavailable: true, reason: "This court is currently inactive." };
  }

  // Check weekly closures (e.g. weekly scheduled closures/maintenance)
  const weeklyClosures = court.weeklyClosures || court.weekly_closures || [];
  if (weeklyClosures.length > 0 && selectedDate) {
    const selectedDow = new Date(`${selectedDate}T00:00:00`).getDay(); // 0 = Sunday, 1 = Monday, etc.
    for (const closure of weeklyClosures) {
      if (Array.isArray(closure.days) && closure.days.includes(selectedDow)) {
        const reasonStr = closure.reason || "Weekly Closure";
        // If this closure is designated for Open Play, we skip it here as it is handled
        // in getOpenPlayScheduleEntry to display "Open Play" yellow styling.
        if (reasonStr.toLowerCase() === "open play") continue;

        const closureStart = closure.startTime || closure.start_time;
        const closureEnd = closure.endTime || closure.end_time;
        const hasTimeRange = Boolean(closureStart && closureEnd);

        if (selectedTimeSlot) {
          if (hasTimeRange) {
            const slotMinutes = convertSlotToMinutes(selectedTimeSlot);
            const startMin = convertTimeToMinutes(closureStart);
            const endMin = convertTimeToMinutes(closureEnd);
            if (slotMinutes >= startMin && slotMinutes < endMin) {
              return { isUnavailable: true, reason: `Unavailable due to scheduled closure: ${reasonStr}.` };
            }
          } else {
            return { isUnavailable: true, reason: `Unavailable due to scheduled closure: ${reasonStr}.` };
          }
        } else if (selectedStartTime && selectedEndTime) {
          if (hasTimeRange) {
            const startMinutes = convertTimeToMinutes(selectedStartTime);
            const endMinutes = convertTimeToMinutes(selectedEndTime);
            const startMin = convertTimeToMinutes(closureStart);
            const endMin = convertTimeToMinutes(closureEnd);
            if (startMinutes < endMin && endMinutes > startMin) {
              return { isUnavailable: true, reason: `Unavailable due to scheduled closure: ${reasonStr}.` };
            }
          } else {
            return { isUnavailable: true, reason: `Unavailable due to scheduled closure: ${reasonStr}.` };
          }
        } else {
          // General court availability check (Step 1 court card selection).
          // If the closure has a specific time range (e.g. 12:00 to 13:00),
          // it only closes that specific time slot, NOT the entire court for the whole day.
          if (!hasTimeRange) {
            return { isUnavailable: true, reason: `Unavailable due to scheduled closure: ${reasonStr}.` };
          }
        }
      }
    }
  }

  // 1. Check multiple deactivation schedules
  const deactivationSchedules = court.deactivationSchedules || court.deactivation_schedules || [];
  if (deactivationSchedules.length > 0 && selectedDate) {
    const selectedDayStart = new Date(`${selectedDate}T00:00:00`);
    const selectedDayEnd = new Date(`${selectedDate}T23:59:59.999`);

    for (const sched of deactivationSchedules) {
      const startsAt = toDateValue(sched.starts_at ?? sched.startsAt);
      const expiresAt = toDateValue(sched.expires_at ?? sched.expiresAt);

      if (startsAt && expiresAt) {
        const overlapsSelectedDate = startsAt <= selectedDayEnd && expiresAt >= selectedDayStart;

        if (overlapsSelectedDate) {
          const reasonStr = sched.reason || "Maintenance";
          if (selectedTimeSlot) {
            const slotMinutes = convertSlotToMinutes(selectedTimeSlot);
            const slotDateTime = new Date(`${selectedDate}T00:00:00`);
            slotDateTime.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);
            if (slotDateTime >= startsAt && slotDateTime <= expiresAt) {
              return { isUnavailable: true, reason: `Unavailable on ${selectedDate} due to scheduled closure: ${reasonStr}.` };
            }
          } else if (selectedStartTime && selectedEndTime) {
            const startMinutes = convertTimeToMinutes(selectedStartTime);
            const endMinutes = convertTimeToMinutes(selectedEndTime);
            if (startMinutes < endMinutes) {
              const customStart = new Date(`${selectedDate}T00:00:00`);
              customStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
              const customEnd = new Date(`${selectedDate}T00:00:00`);
              customEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
              if (customStart < expiresAt && customEnd > startsAt) {
                return { isUnavailable: true, reason: `Unavailable on ${selectedDate} due to scheduled closure: ${reasonStr}.` };
              }
            }
          } else {
            return { isUnavailable: true, reason: `Unavailable on ${selectedDate} due to scheduled closure: ${reasonStr}.` };
          }
        }
      }
    }
  }

  // 2. Legacy override behavior
  const overrideStatusRaw = court.override_status !== undefined ? court.override_status : court.overrideStatus;
  const overrideStartsAt = toDateValue(court.override_starts_at ?? court.overrideStartsAt);
  const overrideExpiresAt = toDateValue(court.override_expires_at ?? court.overrideExpiresAt);

  if (overrideStatusRaw === false && overrideStartsAt && overrideExpiresAt && selectedDate) {
    const selectedDayStart = new Date(`${selectedDate}T00:00:00`);
    const selectedDayEnd = new Date(`${selectedDate}T23:59:59.999`);
    const overlapsSelectedDate = overrideStartsAt <= selectedDayEnd && overrideExpiresAt >= selectedDayStart;

    if (overlapsSelectedDate) {
      if (selectedTimeSlot) {
        const slotMinutes = convertSlotToMinutes(selectedTimeSlot);
        const slotDateTime = new Date(`${selectedDate}T00:00:00`);
        slotDateTime.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);
        if (slotDateTime >= overrideStartsAt && slotDateTime <= overrideExpiresAt) {
          return { isUnavailable: true, reason: `Unavailable on ${selectedDate} during the temporary closure window.` };
        }
      } else if (selectedStartTime && selectedEndTime) {
        const startMinutes = convertTimeToMinutes(selectedStartTime);
        const endMinutes = convertTimeToMinutes(selectedEndTime);
        if (startMinutes < endMinutes) {
          const customStart = new Date(`${selectedDate}T00:00:00`);
          customStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
          const customEnd = new Date(`${selectedDate}T00:00:00`);
          customEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
          if (customStart < overrideExpiresAt && customEnd > overrideStartsAt) {
            return { isUnavailable: true, reason: `Unavailable on ${selectedDate} during the temporary closure window.` };
          }
        }
      } else {
        return { isUnavailable: true, reason: `Unavailable on ${selectedDate} during the temporary closure window.` };
      }
    }
  }

  return { isUnavailable: false, reason: null };
}

// ---------------------------------------------------------------------------
// Open Play — now sourced directly from the court document's own
// `openPlaySchedule` array (no more separate `matches` collection).
//
// Each entry looks like:
//   { id, date: "yyyy-MM-dd", dayOfWeek, startTime: "HH:mm", endTime: "HH:mm",
//     type: "onetime", isActive: true }
//
// Returns the matching schedule entry (or null) so callers can read its
// startTime/endTime for display.
// ---------------------------------------------------------------------------
function getOpenPlayScheduleEntry(court, selectedDate, selectedTimeSlot = null) {
  if (!court) return null;
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  // 1. Check openPlaySchedule if available
  if (Array.isArray(court.openPlaySchedule) && court.openPlaySchedule.length > 0) {
    for (const entry of court.openPlaySchedule) {
      if (entry.isActive === false) continue;
      if (!entry.startTime || !entry.endTime) continue;

      // Does this entry apply to the selected date?
      let appliesToDate = false;
      if (entry.type === "onetime") {
        appliesToDate = entry.date === selectedDate;
      } else if (typeof entry.dayOfWeek === "number") {
        const selectedDow = new Date(`${selectedDate}T00:00:00`).getDay();
        appliesToDate = selectedDow === entry.dayOfWeek;
      } else {
        appliesToDate = entry.date === selectedDate;
      }
      if (!appliesToDate) continue;

      if (selectedTimeSlot) {
        // Checking a specific slot/time (booking grid, custom range) — pure
        // date + start/end comparison, independent of "now".
        const slotMin = convertSlotToMinutes(selectedTimeSlot);
        const startMin = convertTimeToMinutes(entry.startTime);
        const endMin = convertTimeToMinutes(entry.endTime);
        if (slotMin >= startMin && slotMin < endMin) return entry;
        continue;
      }

      // No specific slot — "is this court closed right now" check, used on
      // the Select Court step.
      if (selectedDate === todayStr) {
        const startMin = convertTimeToMinutes(entry.startTime);
        const endMin = convertTimeToMinutes(entry.endTime);
        const nowMin = now.getHours() * 60 + now.getMinutes();
        if (nowMin >= startMin && nowMin < endMin) return entry;
      } else {
        // Future date — only block the court card if open play has no specific time range (all-day open play)
        const hasTimeRange = Boolean(entry.startTime && entry.endTime);
        if (!hasTimeRange) return entry;
      }
    }
  }

  // 2. Check weeklyClosures for "Open Play"
  const weeklyClosures = court.weeklyClosures || court.weekly_closures || [];
  if (weeklyClosures.length > 0 && selectedDate) {
    const selectedDow = new Date(`${selectedDate}T00:00:00`).getDay(); // 0 = Sunday, 1 = Monday, etc.
    for (const closure of weeklyClosures) {
      const reasonStr = closure.reason || "";
      if (reasonStr.toLowerCase() === "open play" && Array.isArray(closure.days)) {
        if (closure.days.includes(selectedDow)) {
          const closureStart = closure.startTime || closure.start_time;
          const closureEnd = closure.endTime || closure.end_time;
          const hasTimeRange = Boolean(closureStart && closureEnd);

          if (selectedTimeSlot) {
            const slotMin = convertSlotToMinutes(selectedTimeSlot);
            const startMin = convertTimeToMinutes(closureStart);
            const endMin = convertTimeToMinutes(closureEnd);
            if (slotMin >= startMin && slotMin < endMin) return closure;
            continue;
          }

          if (selectedDate === todayStr) {
            const startMin = convertTimeToMinutes(closureStart);
            const endMin = convertTimeToMinutes(closureEnd);
            const nowMin = now.getHours() * 60 + now.getMinutes();
            if (nowMin >= startMin && nowMin < endMin) return closure;
          } else {
            if (!hasTimeRange) return closure;
          }
        }
      }
    }
  }

  return null;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function loadImageFromObjectUrl(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the selected image."));
    img.src = objectUrl;
  });
}

async function compressImageToMaxBytes(file, maxBytes) {
  if (file.size <= maxBytes) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const sourceImg = await loadImageFromObjectUrl(objectUrl);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image.");
    let bestBlob = null;
    let scale = 1;
    for (let pass = 0; pass < 6; pass++) {
      const w = Math.max(1, Math.round(sourceImg.naturalWidth * scale));
      const h = Math.max(1, Math.round(sourceImg.naturalHeight * scale));
      canvas.width = w; canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(sourceImg, 0, 0, w, h);
      for (const q of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
        if (!blob) continue;
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        if (blob.size <= maxBytes) {
          const base = (file.name || "receipt").replace(/\.[^/.]+$/, "");
          return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
        }
      }
      scale *= 0.82;
    }
    if (!bestBlob) throw new Error("Could not compress image.");
    throw new Error(`Image still too large (${formatBytes(bestBlob.size)}). Upload a smaller image.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e?.target?.result || ""));
    reader.onerror = () => reject(new Error("Could not encode receipt image."));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Payment QR Modal
// ---------------------------------------------------------------------------
function PaymentModal({ amount, description, onClose, onSuccess, paymentImg, paymentImgUrl, processingImage, onFileChange, inputRef, onRemoveReceipt }) {
  const [refNumber, setRefNumber] = useState("");
  const feeDisplay = `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  const handleDownloadQR = async () => {
    try {
      const res = await fetch(PAYMENT_QR_IMAGE_URL);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = PAYMENT_QR_DOWNLOAD_FILENAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(PAYMENT_QR_IMAGE_URL, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center px-4 py-6">
      <div className="card p-5 max-w-sm w-full rounded-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-white font-semibold text-base">Payment Details</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 -mr-1">
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1.5">
            <p className="text-white text-sm font-semibold">{description}</p>
            <p className="text-slate-400 text-xs">Pay using your preferred banking app, then upload your receipt below.</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-2 mb-3">
              <QrCode size={18} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-slate-400 text-xs leading-relaxed">
                Scan the QR code below using GCash, Maya, BPI, BDO, or any QR-enabled banking app.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-xl inline-block">
                <img src={PAYMENT_QR_IMAGE_URL} alt="Payment QR code" className="w-44 h-44 object-contain" />
              </div>
              <div className="text-center">
                <div className="text-white font-medium text-sm">{PAYMENT_ACCOUNT_NAME}</div>
                <div className="text-green-400 font-bold text-lg">{feeDisplay}</div>
              </div>
              <button type="button" onClick={handleDownloadQR} className="btn-secondary px-4 py-2 text-xs flex items-center gap-2">
                <Download size={14} /> Download QR Code
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-slate-500 text-xs leading-relaxed">
                After paying, upload a screenshot of your receipt. Your booking will remain <strong className="text-yellow-400">pending</strong> until verified.
              </p>
            </div>
            <label className="label">Upload Receipt <span className="text-red-400">*</span></label>
            <div onClick={() => inputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${paymentImgUrl ? "border-green-500 bg-green-500/5" : "border-slate-700 hover:border-slate-500"}`}>
              {paymentImgUrl ? (
                <div>
                  <img src={paymentImgUrl} alt="Receipt" className="max-h-28 mx-auto rounded-lg mb-2 object-contain" />
                  <p className="text-green-400 text-xs font-medium flex items-center justify-center gap-1"><Check size={13} /> Receipt uploaded</p>
                </div>
              ) : (
                <div>
                  <Upload size={20} className="text-slate-600 mx-auto mb-1.5" />
                  <p className="text-slate-400 text-xs">{processingImage ? "Processing..." : "Click to upload payment screenshot"}</p>
                  <p className="text-slate-600 text-[10px] mt-1">PNG/JPG/WEBP. Auto-compressed.</p>
                </div>
              )}
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </div>
            {paymentImgUrl && (
              <button onClick={onRemoveReceipt} className="mt-2 text-red-400 hover:text-red-300 text-xs flex items-center gap-1"><X size={12} /> Remove image</button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="label">Reference Number / Transaction ID <span className="text-red-400">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. 13-digit Reference No."
              className="input-field"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
            />
          </div>

          <button onClick={() => onSuccess(refNumber)} disabled={!paymentImg || processingImage || !refNumber.trim()} className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            <Check size={16} /> Submit Booking
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Book component
// ---------------------------------------------------------------------------
export default function Book() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef();

  const [step, setStep] = useState(1);
  const [bookedSlots, setBookedSlots] = useState({});
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [paymentImg, setPaymentImg] = useState(null);
  const [paymentImgUrl, setPaymentImgUrl] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [bookingIds, setBookingIds] = useState([]);
  const [courtsFromDb, setCourtsFromDb] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [customTime, setCustomTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");
  const [customTimeError, setCustomTimeError] = useState("");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);

  // ── Recurring booking state ───────────────────────────────────────────
  const [bookingMode, setBookingMode] = useState("single"); // "single" | "recurring"
  const [recurrence, setRecurrence] = useState({
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    daysOfWeek: [],   // array of 0-6 (Sun-Sat)
    startTime: "",   // "HH:mm"
    endTime: "",   // "HH:mm"
  });
  const [repeatUnit, setRepeatUnit] = useState("months"); // weeks | months | years
  const [repeatAmount, setRepeatAmount] = useState(1);
  const [recurringOccurrences, setRecurringOccurrences] = useState([]); // [{date,status,reason}]
  const [recurringChecking, setRecurringChecking] = useState(false);

  const [form, setForm] = useState({
    courtIds: searchParams.get("court") ? [searchParams.get("court")] : [],
    date: format(new Date(), "yyyy-MM-dd"),
    timeSlot: "",
    duration: 1,
    equipmentQty: {},
    notes: "",
    playerName: userProfile?.fullName || "",
    phone: userProfile?.phone || "",
    paymentMethod: "manual",
  });

  const courtList = courtsFromDb === null ? COURTS_FALLBACK : courtsFromDb.length > 0 ? courtsFromDb : COURTS_FALLBACK;
  const selectedCourts = courtList.filter((c) => form.courtIds.includes(c.id));

  // Load courts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCourts();
        if (!cancelled) setCourtsFromDb(list);
      } catch (err) {
        console.error("Failed to fetch courts from database:", err);
        toast.error("Failed to load courts: " + err.message);
        if (!cancelled) setCourtsFromDb([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load inventory
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInventoryLoading(true);
      try { const list = await fetchInventoryItems(); if (!cancelled) setInventoryItems(list); }
      catch { if (!cancelled) setInventoryItems([]); }
      finally { if (!cancelled) setInventoryLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync inventory qty limits
  useEffect(() => {
    if (!inventoryItems.length) return;
    const ids = new Set(inventoryItems.map((i) => i.id));
    setForm((f) => {
      const eq = { ...f.equipmentQty };
      for (const id of Object.keys(eq)) {
        if (!ids.has(id)) delete eq[id];
        else {
          const item = inventoryItems.find((i) => i.id === id);
          if (item && eq[id] > item.availableQty) eq[id] = item.availableQty;
        }
      }
      return { ...f, equipmentQty: eq };
    });
  }, [inventoryItems]);

  // Sync court ids after DB load and respect isActive state
  useEffect(() => {
    if (!courtsFromDb || courtsFromDb.length === 0) return;
    const activeCourts = courtsFromDb.filter((c) => !isCourtDeactivated(c, form.date));
    const activeIds = new Set(activeCourts.map((c) => c.id));
    setForm((f) => {
      const stillValid = f.courtIds.filter((id) => activeIds.has(id));
      const isUnchanged = stillValid.length === f.courtIds.length && stillValid.every((val, i) => val === f.courtIds[i]);
      if (isUnchanged) return f;
      return { ...f, courtIds: stillValid, timeSlot: "" };
    });
  }, [courtsFromDb, form.date]);

  // Booked slots listener (single-booking mode)
  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!form.courtIds.length) { setBookedSlots({}); return; }
    
    let cancelled = false;
    
    const fetchSlots = async () => {
      try {
        const courtIdsStr = form.courtIds.slice(0, 10).join(',');
        const response = await api.get(`/bookings/slots?courtIds=${courtIdsStr}&date=${form.date}`);
        if (cancelled) return;
        
        const slotsMap = {};
        response.data.forEach((data) => {
          const normStatus = normalizeBookingStatus(data.status);
          if (normStatus === "pending" || normStatus === "approved") {
            const occupied = getOccupiedSlots(data.time_slot, data.duration ?? 1);
            occupied.forEach((s) => {
              if (slotsMap[s] !== "approved") {
                slotsMap[s] = normStatus;
              }
            });
          }
        });
        
        console.log("Booked slots fetched from API:", slotsMap);
        setBookedSlots(slotsMap);
      } catch (error) {
        console.error("Booked slots listener error:", error);
      }
    };
    
    fetchSlots();
    const interval = setInterval(fetchSlots, 10000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [form.courtIds, form.date, navigate, user]);

  // Sync player name and phone from profile
  useEffect(() => {
    if (userProfile) {
      setForm((f) => ({
        ...f,
        playerName: f.playerName || userProfile.fullName || "",
        phone: f.phone || userProfile.phone || "",
      }));
    }
  }, [userProfile]);

  // Revoke object URL on unmount
  useEffect(() => () => { if (paymentImgUrl) URL.revokeObjectURL(paymentImgUrl); }, [paymentImgUrl]);

  // ── Recurring: derived duration from start/end time ──────────────────
  const recurringDuration = useMemo(() => {
    if (!recurrence.startTime || !recurrence.endTime) return 0;
    const diff = convertTimeToMinutes(recurrence.endTime) - convertTimeToMinutes(recurrence.startTime);
    return diff > 0 ? diff / 60 : 0;
  }, [recurrence.startTime, recurrence.endTime]);

  // ── Recurring: candidate dates from the range + days-of-week ─────────
  const candidateDates = useMemo(
    () => generateRecurringDates(recurrence.startDate, recurrence.endDate, recurrence.daysOfWeek),
    [recurrence.startDate, recurrence.endDate, JSON.stringify(recurrence.daysOfWeek)]
  );

  // ── Recurring: check each candidate date against court hours, Open Play,
  // and existing bookings (single Firestore range query, grouped client-side) ─
  useEffect(() => {
    if (bookingMode !== "recurring") { setRecurringOccurrences([]); return; }
    if (!recurrence.startTime || !recurrence.endTime || recurringDuration <= 0) { setRecurringOccurrences([]); return; }
    if (selectedCourts.length === 0 || candidateDates.length === 0) { setRecurringOccurrences([]); return; }
    if (candidateDates.length > MAX_RECURRING_OCCURRENCES) {
      toast.error(`That range produces ${candidateDates.length} sessions — please narrow it to ${MAX_RECURRING_OCCURRENCES} or fewer.`);
      setRecurringOccurrences([]);
      return;
    }

    setRecurringChecking(true);
    const startMin = convertTimeToMinutes(recurrence.startTime);
    const endMin = convertTimeToMinutes(recurrence.endTime);
    const slotLabel = to12HourLabel(recurrence.startTime);
    const courtIds = selectedCourts.map((c) => c.id);

    const q = query(
      collection(db, "bookings"),
      where("date", ">=", recurrence.startDate),
      where("date", "<=", recurrence.endDate)
    );

    const unsub = onSnapshot(q, (snap) => {
      const byDate = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        // Client-side filtering for court ids and active statuses to avoid composite index requirements
        if (courtIds.includes(data.courtId)) {
          const statusLower = (data.status || "").toLowerCase();
          if (statusLower === "pending" || statusLower === "approved") {
            (byDate[data.date] ||= []).push({ timeSlot: data.timeSlot, duration: data.duration ?? 1 });
          }
        }
      });

      const results = candidateDates.map((date) => {
        for (const c of selectedCourts) {
          if (isCourtDeactivated(c, date)) {
            return { date, status: "closed", reason: `${c.name} is inactive.` };
          }
          const availability = getCourtAvailability(c, date, null, recurrence.startTime, recurrence.endTime);
          if (availability.isUnavailable) {
            return { date, status: "closed", reason: `${c.name}: ${availability.reason}` };
          }
          if (getOpenPlayScheduleEntry(c, date, slotLabel)) {
            return { date, status: "openplay", reason: `${c.name} has Open Play at this time.` };
          }
        }
        const existing = byDate[date] || [];
        const hasConflict = existing.some((b) => {
          const bStart = convertSlotToMinutes(b.timeSlot);
          const bEnd = bStart + (Number(b.duration) || 1) * 60;
          return startMin < bEnd && bStart < endMin;
        });
        if (hasConflict) return { date, status: "booked", reason: "Already booked on one of the selected courts." };
        return { date, status: "available", reason: null };
      });

      setRecurringOccurrences(results);
      setRecurringChecking(false);
    }, (err) => {
      console.error(err);
      toast.error("Could not check availability for the recurring schedule.");
      setRecurringOccurrences([]);
      setRecurringChecking(false);
    });

    return () => unsub();
  }, [bookingMode, candidateDates, recurrence.startDate, recurrence.endDate, recurrence.startTime, recurrence.endTime, recurringDuration, JSON.stringify(form.courtIds), courtsFromDb]);

  const recurringAvailableDates = useMemo(
    () => recurringOccurrences.filter((o) => o.status === "available"),
    [recurringOccurrences]
  );

  // Effective duration/occurrence-count used for pricing, depending on mode
  const effectiveDuration = bookingMode === "recurring" ? recurringDuration : form.duration;
  const occurrenceCount = bookingMode === "recurring" ? recurringAvailableDates.length : 1;

  // Derived totals
  const equipmentLines = useMemo(() =>
    inventoryItems.map((item) => {
      const qty = form.equipmentQty[item.id] ?? 0;
      if (qty <= 0) return null;
      const rentPrice = Number(item.pricePerHour) || 0;
      const unitPrice = rentPrice * effectiveDuration;
      return { ...item, qty, lineTotal: unitPrice * qty, unitPrice };
    }).filter(Boolean),
    [inventoryItems, form.equipmentQty, effectiveDuration]
  );
  const equipmentTotal = useMemo(() => equipmentLines.reduce((s, l) => s + l.lineTotal, 0), [equipmentLines]);
  const courtTotal = selectedCourts.reduce((s, c) => s + (c.pricePerHour ?? 0) * effectiveDuration, 0)
    * (bookingMode === "recurring" ? occurrenceCount : 1);
  const subtotal = courtTotal + equipmentTotal;
  const discount = appliedPromo ? subtotal * appliedPromo.discount : 0;
  const total = subtotal - discount;

  // Equipment qty helpers
  const setEquipmentQty = (item, nextQty) => {
    const max = Math.max(0, item.availableQty);
    if (max <= 0) { toast.error("This item is out of stock"); return; }
    const n = Math.max(0, Math.min(max, Math.floor(Number(nextQty)) || 0));
    setForm((f) => {
      const eq = { ...f.equipmentQty };
      if (n <= 0) delete eq[item.id]; else eq[item.id] = n;
      return { ...f, equipmentQty: eq };
    });
  };
  const bumpQty = (item, delta) => setEquipmentQty(item, (form.equipmentQty[item.id] ?? 0) + delta);

  const applyPromo = () => {
    const promo = PROMOS.find((p) => p.code === promoInput.toUpperCase());
    if (promo) { setAppliedPromo(promo); toast.success(`Promo applied: ${promo.label}`); }
    else toast.error("Invalid promo code");
  };

  // ── Recurring helpers ──────────────────────────────────────────────────
  const toggleDayOfWeek = (value) => {
    setRecurrence((r) => {
      const has = r.daysOfWeek.includes(value);
      const daysOfWeek = has ? r.daysOfWeek.filter((d) => d !== value) : [...r.daysOfWeek, value].sort();
      return { ...r, daysOfWeek };
    });
  };

  const applyRepeatDuration = () => {
    const amount = Math.max(1, Math.floor(Number(repeatAmount)) || 1);
    if (!recurrence.startDate) { toast.error("Please pick a start date first."); return; }
    const start = new Date(`${recurrence.startDate}T00:00:00`);
    let end;
    if (repeatUnit === "weeks") end = addWeeks(start, amount);
    else if (repeatUnit === "months") end = addMonths(start, amount);
    else end = addYears(start, amount);
    end = addDays(end, -1); // inclusive end date
    setRecurrence((r) => ({ ...r, endDate: format(end, "yyyy-MM-dd") }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) { toast.error("Please upload an image file."); e.target.value = ""; return; }
    if (file.size > MAX_RECEIPT_SOURCE_BYTES) { toast.error(`File too large (max ${formatBytes(MAX_RECEIPT_SOURCE_BYTES)}).`); e.target.value = ""; return; }
    setProcessingImage(true);
    const tid = "receipt-img";
    try {
      toast.loading("Processing receipt image...", { id: tid });
      const processed = await compressImageToMaxBytes(file, MAX_RECEIPT_BYTES);
      const nextUrl = URL.createObjectURL(processed);
      setPaymentImg(processed);
      setPaymentImgUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return nextUrl; });
      toast.success(`Receipt uploaded (${formatBytes(processed.size)}).`, { id: tid });
    } catch (err) {
      toast.error(err?.message || "Could not process image.", { id: tid });
    } finally {
      setProcessingImage(false);
      e.target.value = "";
    }
  };

  // Called after QR Ph payment confirmed (auto or manual)
  const handleQRPaymentSuccess = async (paymentRef) => {
    await submitBooking(paymentRef);
  };

  const submitBooking = async (paymentRef = "") => {
    if (selectedCourts.length === 0) return toast.error("Please select at least one court");
    if (!form.playerName) return toast.error("Player name is required");
    if (!form.phone) return toast.error("Phone number is required");
    if (bookingMode === "recurring") {
      if (recurringAvailableDates.length === 0) return toast.error("No available sessions in your recurring schedule");
    } else if (!form.timeSlot) {
      return toast.error("Please select a time slot");
    }
    if (total > 0 && !paymentImg) {
      return toast.error("Payment receipt screenshot is required.");
    }

    setSubmitting(true);
    try {
      let imageUrl = "";
      if (paymentImg) {
        imageUrl = await fileToDataUrl(paymentImg);
        const encoded = new TextEncoder().encode(imageUrl).length;
        if (encoded > MAX_FIRESTORE_FIELD_BYTES) throw new Error(`Receipt too large (${formatBytes(encoded)}). Upload a smaller image.`);
      }

      const equipmentQtyClean = Object.fromEntries(Object.entries(form.equipmentQty).filter(([, q]) => Number(q) > 0));
      const groupId = `${user.uid}-${Date.now()}`;
      const recurringId = bookingMode === "recurring" ? `recur-${groupId}` : null;
      const newBookingIds = [];

      const skippedOccurrences = bookingMode === "recurring"
        ? recurringOccurrences.filter((o) => o.status !== "available")
        : [];

      let notesWithSkipped = form.notes;
      if (bookingMode === "recurring" && skippedOccurrences.length > 0) {
        const skippedDetails = skippedOccurrences.map(o => `${o.date} (${o.reason || o.status})`).join(", ");
        const skipNotice = `[Skipped conflicting dates: ${skippedDetails}]`;
        notesWithSkipped = form.notes ? `${form.notes}\n\n${skipNotice}` : skipNotice;
      }

      // In recurring mode, one booking doc per available occurrence date per
      // selected court. All share the same groupId (and recurringId) so they
      // can be looked up/managed together later.
      const occurrences = bookingMode === "recurring"
        ? recurringAvailableDates.map((o) => ({
          date: o.date,
          timeSlot: to12HourLabel(recurrence.startTime),
          duration: recurringDuration,
        }))
        : [{ date: form.date, timeSlot: form.timeSlot, duration: form.duration }];

      const payload = {
        bookingMode,
        recurringId,
        groupId,
        occurrences,
        selectedCourts,
        equipmentLines,
        notes: notesWithSkipped,
        playerName: form.playerName,
        phone: form.phone || "",
        totalAmount: total,
        promoCode: appliedPromo?.code || null,
        paymentRef: paymentRef || "",
        paymentImgUrl: imageUrl || "",
      };

      const response = await api.post('/bookings/bulk', payload);
      newBookingIds.push(...response.data.bookingIds);

      setBookingId(newBookingIds[0]);
      setBookingIds(newBookingIds);
      setStep(4);
      toast.success(
        bookingMode === "recurring"
          ? `${occurrences.length} recurring session${occurrences.length !== 1 ? "s" : ""} submitted!`
          : (paymentRef ? "Booking confirmed with payment!" : "Booking submitted!")
      );
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
      setShowQRModal(false);
    }
  };

  // Step 3 "Generate QR" button → open modal
  const handleSubmit = () => {
    if (selectedCourts.length === 0) return toast.error("Please select at least one court");
    if (!form.playerName) return toast.error("Player name is required");
    if (!form.phone) return toast.error("Phone number is required");
    if (bookingMode === "recurring") {
      if (recurringAvailableDates.length === 0) return toast.error("No available sessions in your recurring schedule");
    } else if (!form.timeSlot) {
      return toast.error("Please select a time slot");
    }
    setShowQRModal(true);
  };

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");
  const recurringMaxDate = format(addYears(new Date(), 3), "yyyy-MM-dd");

  if (!user) return <div className="min-h-screen hero-bg flex items-center justify-center"><div className="text-white">Loading...</div></div>;

  // ── Step 4: success screen ──────────────────────────────────────────────
  if (step === 4) {
    const skipped = bookingMode === "recurring" ? recurringOccurrences.filter((o) => o.status !== "available") : [];
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center px-4 pt-20">
        <div className="max-w-md w-full text-center">
          <div className="card p-10">
            <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6 glow-green">
              <Check size={36} className="text-green-400" />
            </div>
            <h2 className="font-display text-3xl tracking-wider text-white mb-2">BOOKING SUBMITTED!</h2>
            <p className="text-slate-400 text-sm mb-6">
              Your booking is <strong className="text-yellow-400">pending approval</strong>. We'll notify you once confirmed.
            </p>
            {skipped.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left flex items-start gap-2 mb-5">
                <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="w-full">
                  <div className="text-amber-400 font-semibold text-xs mb-1">Skipped conflicting dates:</div>
                  <div className="text-[10px] text-slate-400 max-h-24 overflow-y-auto space-y-0.5">
                    {skipped.map(o => (
                      <div key={o.date} className="flex justify-between">
                        <span>{format(new Date(`${o.date}T00:00:00`), "EEE, MMM d")}</span>
                        <span className="text-amber-500/80">{o.reason || o.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-slate-800 rounded-xl p-4 text-left space-y-2 mb-6">
              {[
                ["Courts", selectedCourts.map((c) => c.name).join(", ")],
                ...(bookingMode === "recurring"
                  ? [
                    ["Date Range", `${recurrence.startDate} → ${recurrence.endDate}`],
                    ["Days", recurrence.daysOfWeek.map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label).join(", ")],
                    ["Time", `${to12HourLabel(recurrence.startTime)} – ${to12HourLabel(recurrence.endTime)}`],
                    ["Sessions", `${bookingIds.length / Math.max(selectedCourts.length, 1)} bookings`],
                  ]
                  : [
                    ["Date", form.date],
                    ["Time", form.timeSlot],
                  ]),
                ["Total", `₱${total.toFixed(2)}`],
                ["Booking ID", `${bookingId?.slice(0, 12)}...`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className={label === "Total" ? "text-green-400 font-semibold" : label === "Booking ID" ? "text-white text-xs font-mono" : "text-white"}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate("/bookings")} className="btn-primary flex-1 text-sm py-3">View My Bookings</button>
              <button onClick={() => { setStep(1); setBookingId(null); }} className="btn-secondary flex-1 text-sm py-3">Book Another</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen court-pattern pt-20 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 pt-4">
          <h1 className="font-display text-4xl tracking-wider text-white">BOOK A <span className="gradient-text">COURT</span></h1>
          <p className="text-slate-500 mt-1 text-sm">Complete all steps to confirm your reservation</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step > s ? "bg-green-500 text-slate-950" :
                step === s ? "bg-green-500/20 border-2 border-green-500 text-green-400" :
                  "bg-slate-800 text-slate-600"
                }`}>
                {step > s ? <Check size={16} /> : s}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${step >= s ? "text-white" : "text-slate-600"}`}>
                {s === 1 ? "Court & Schedule" : s === 2 ? "Add-ons" : "Payment"}
              </span>
              {s < 3 && <ChevronRight size={16} className="text-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* Policy Notices */}
        <div className="mb-6 space-y-3">
          <div className="card p-4 border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
              <strong className="text-amber-400">Booking Policy:</strong> All payments are <strong>non-refundable</strong> once submitted — please double-check your court(s), date, and time before paying.
            </div>
          </div>
          <div className="card p-4 border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
            <Users size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
              <strong className="text-amber-400">Open Play Policy:</strong> Open Play sessions may only be organized and scheduled by <strong>PickleBros Court management</strong>. Unauthorized personnel are not permitted to organize, host, or advertise Open Play matches on any court.
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* ── Step 1 ── */}
            {step === 1 && (
              <>
                {/* Court selection */}
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-1 flex items-center gap-2"><Calendar size={18} className="text-green-400" /> Select Court(s)</h3>
                  <p className="text-slate-500 text-sm mb-4">Tap to select or deselect — you can book multiple courts for the same date, time, and duration.</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {courtList.map((c) => {
                      const openPlayEntry = getOpenPlayScheduleEntry(c, form.date);
                      const openPlay = !!openPlayEntry;
                      const availability = getCourtAvailability(c, form.date);
                      const isCourtInactive = isCourtDeactivated(c, form.date);
                      const isUnavailable = availability.isUnavailable || openPlay || isCourtInactive;
                      const isSelected = form.courtIds.includes(c.id);
                      return (
                        <button key={c.id} type="button" disabled={isUnavailable}
                          onClick={() => {
                            if (isCourtInactive) { toast.error(availability.reason || `${c.name} is currently not available for booking.`); return; }
                            if (availability.isUnavailable) { toast.error(availability.reason || `${c.name} is currently not available for booking.`); return; }
                            if (openPlay) { toast.error(`${c.name} is currently in Open Play and cannot be booked.`); return; }
                            setForm((f) => {
                              const nextIds = f.courtIds.includes(c.id)
                                ? f.courtIds.filter((id) => id !== c.id)
                                : [...f.courtIds, c.id];
                              return { ...f, courtIds: nextIds, timeSlot: "" };
                            });
                          }}
                          className={`p-4 rounded-xl border text-left transition-all ${isUnavailable ? "border-yellow-500/40 bg-yellow-500/5 cursor-not-allowed opacity-80"
                            : isSelected ? "border-green-500 bg-green-500/10 cursor-pointer"
                              : "border-slate-700 bg-slate-800 hover:border-slate-600 cursor-pointer"
                            }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-medium text-sm">{c.name}</span>
                            {isUnavailable ? <span className="text-yellow-400 text-xs font-semibold">{openPlay ? "🏓 Open Play" : "Unavailable"}</span>
                              : isSelected && <Check size={14} className="text-green-400" />}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.type === "Indoor" ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"}`}>{c.type}</span>
                          {isUnavailable ? (
                            <div className="mt-2">
                              <div className="text-yellow-400 text-xs font-medium">Not available for booking</div>
                              <div className="text-slate-500 text-xs mt-0.5">
                                {openPlay ? (
                                  <>Open Play: {openPlayEntry.startTime || "N/A"} – {openPlayEntry.endTime || "N/A"}</>
                                ) : (
                                  availability.reason || "This court is currently unavailable for the selected date."
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-green-400 font-semibold mt-2">₱{c.pricePerHour}<span className="text-slate-500 text-xs font-normal">/hr</span></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Player info */}
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><User size={18} className="text-green-400" /> Player Information</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Player Name <span className="text-red-400">*</span></label>
                      <input type="text" required className="input-field" placeholder="Full name"
                        value={form.playerName} onChange={(e) => setForm({ ...form, playerName: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Phone Number <span className="text-red-400">*</span></label>
                      <input type="tel" required className="input-field" placeholder="09XX-XXX-XXXX"
                        value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      <p className="text-slate-400 text-xs mt-1">Please put an active phone number so that we can call you to confirm your booking.</p>
                    </div>
                  </div>
                </div>

                {/* Date & time */}
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Clock size={18} className="text-green-400" /> Date & Time</h3>

                  <>
                    <div className="grid sm:grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="label">Date</label>
                        <input type="date" className="input-field" min={minDate} max={maxDate}
                          value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, timeSlot: "" })} />
                      </div>
                      <div>
                        <label className="label">Duration</label>
                        <div className="flex gap-2 items-center">
                          <select className="input-field" value={isCustomDuration ? "custom" : form.duration}
                            onChange={(e) => {
                              if (e.target.value === "custom") { setIsCustomDuration(true); setCustomDurationInput(""); }
                              else { setIsCustomDuration(false); setCustomDurationInput(""); setForm({ ...form, duration: Number(e.target.value) }); }
                            }}>
                            {DURATIONS.map((d) => <option key={d} value={d}>{d} {d === 1 ? "hour" : "hours"}</option>)}
                            <option value="custom">Custom...</option>
                          </select>
                          {isCustomDuration && (
                            <div className="flex items-center gap-1">
                              <input type="number" min={0.5} max={24} step={0.5} autoFocus placeholder="e.g. 5"
                                className="input-field w-24 text-center" value={customDurationInput}
                                onChange={(e) => {
                                  const raw = e.target.value; setCustomDurationInput(raw);
                                  const val = parseFloat(raw);
                                  if (!isNaN(val) && val >= 0.5 && val <= 24) setForm({ ...form, duration: val });
                                }} />
                              <span className="text-slate-400 text-sm whitespace-nowrap">hrs</span>
                            </div>
                          )}
                        </div>
                        {isCustomDuration && (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-slate-500 text-xs">
                              {customDurationInput && parseFloat(customDurationInput) >= 0.5 ? `✓ ${parseFloat(customDurationInput)} hours set` : "Enter hours (0.5–24)"}
                            </span>
                            <button type="button" onClick={() => { setIsCustomDuration(false); setCustomDurationInput(""); setForm({ ...form, duration: 1 }); }}
                              className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"><X size={10} /> Reset</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <label className="label">Available Time Slots{selectedCourts.length > 1 ? ` (must be free on all ${selectedCourts.length} selected courts)` : ""}</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {TIME_SLOTS.map((slot) => {
                        const isOpenPlay = selectedCourts.some((c) => !!getOpenPlayScheduleEntry(c, form.date, slot));
                        const blockedByAvailability = selectedCourts
                          .map((c) => getCourtAvailability(c, form.date, slot))
                          .find((a) => a.isUnavailable);
                        const availability = blockedByAvailability || { isUnavailable: false, reason: null };
                        const isBooked = bookedSlots[slot] === "approved";
                        const isReserved = bookedSlots[slot] === "pending";
                        const isPast = isSlotPast(form.date, slot);
                        const disabled = isBooked || isReserved || isPast || isOpenPlay || availability.isUnavailable || selectedCourts.length === 0;
                        return (
                          <button key={slot} disabled={disabled} onClick={() => setForm({ ...form, timeSlot: slot })}
                            className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${isOpenPlay ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400/50 cursor-not-allowed"
                              : isBooked ? "bg-red-500/10 border border-red-500/20 text-red-400/50 cursor-not-allowed"
                                : isReserved ? "bg-purple-500/10 border border-purple-500/20 text-purple-400/50 cursor-not-allowed"
                                  : isPast ? "bg-slate-800/50 border border-slate-700/50 text-slate-600 cursor-not-allowed"
                                    : availability.isUnavailable ? "bg-amber-500/10 border border-amber-500/20 text-amber-400/60 cursor-not-allowed"
                                      : selectedCourts.length === 0 ? "bg-slate-800/40 border border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                                        : form.timeSlot === slot ? "bg-green-500 text-slate-950 glow-green"
                                          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 cursor-pointer"
                              }`}>
                            {slot}
                            {isOpenPlay && <div className="text-[10px] mt-0.5 font-semibold">Open Play</div>}
                            {!isOpenPlay && isBooked && <div className="text-[10px] mt-0.5">Booked</div>}
                            {!isOpenPlay && isReserved && <div className="text-[10px] mt-0.5">Reserved</div>}
                            {!isOpenPlay && !isBooked && !isReserved && isPast && <div className="text-[10px] mt-0.5">Unavailable</div>}
                            {!isOpenPlay && !isBooked && !isReserved && !isPast && availability.isUnavailable && <div className="text-[10px] mt-0.5 font-medium">{availability.reason || "Closed"}</div>}
                          </button>
                        );
                      })}
                    </div>

                  </>
                </div>

                {/* Notes */}
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><FileText size={18} className="text-green-400" /> Special Notes (Optional)</h3>
                  <textarea rows={3} className="input-field resize-none" placeholder="Any special requests, skill level, purpose of booking..."
                    value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </>
            )}

            {/* ── Step 2: Equipment ── */}
            {step === 2 && (
              <div className="card p-6">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2"><Package size={18} className="text-green-400" /> Equipment Rental Add-ons</h3>
                <p className="text-slate-500 text-sm mb-5">
                  Set quantity per item — each unit is priced ₱/hr × your session ({effectiveDuration || 0} hr).
                  {bookingMode === "recurring" && <span className="block mt-1 text-slate-600">Equipment is billed once for the whole recurring booking, not per session.</span>}
                </p>
                {inventoryLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-800/80 shimmer" />)}</div>
                ) : inventoryItems.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center border border-dashed border-slate-700 rounded-xl">No add-ons in inventory yet.</p>
                ) : (
                  <div className="space-y-5">
                    {(() => {
                      const items = inventoryItems.filter((item) => {
                        const t = (item.type || "rental").toLowerCase();
                        return t === "rent" || t === "rental";
                      });
                      if (items.length === 0) return null;
                      return (
                        <div key="rent">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="text-white font-medium text-sm">For Rent</h4>
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">{items.length} item{items.length > 1 ? "s" : ""}</span>
                          </div>
                          <div className="space-y-3">
                            {items.map((item) => {
                              const qty = form.equipmentQty[item.id] ?? 0;
                              const out = item.availableQty <= 0;
                              const rentPrice = Number(item.pricePerHour) || 0;
                              const unit = rentPrice * effectiveDuration;
                              const priceText = `₱${rentPrice} per hour`;
                              return (
                                <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all ${out ? "border-slate-800 bg-slate-900/50 opacity-60" : qty > 0 ? "border-green-500/50 bg-green-500/5" : "border-slate-700 bg-slate-800"}`}>
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <Package size={22} className="text-green-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                      <div className="text-white font-medium flex flex-wrap items-center gap-2">
                                        <span className="truncate">{item.name}</span>
                                        {item.category && <span className="text-[10px] uppercase tracking-wide text-slate-500 px-2 py-0.5 rounded bg-slate-800 shrink-0">{item.category}</span>}
                                      </div>
                                      <div className="text-slate-500 text-sm mt-0.5">{priceText}</div>
                                      {item.notes?.trim() && <p className="text-slate-600 text-xs mt-1 line-clamp-2">{item.notes}</p>}
                                      <div className="text-slate-600 text-xs mt-1">Available: {item.availableQty}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                    <div className="flex items-center gap-1">
                                      <button type="button" disabled={out || qty <= 0} onClick={() => bumpQty(item, -1)}
                                        className="w-9 h-9 rounded-lg border border-slate-600 flex items-center justify-center text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"><Minus size={16} /></button>
                                      <input type="number" min={0} max={item.availableQty} disabled={out} value={qty || ""}
                                        onChange={(e) => { const v = e.target.value; if (v === "") setEquipmentQty(item, 0); else setEquipmentQty(item, v); }}
                                        className="w-14 text-center input-field py-2 text-sm font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                                      <button type="button" disabled={out || qty >= item.availableQty} onClick={() => bumpQty(item, 1)}
                                        className="w-9 h-9 rounded-lg border border-slate-600 flex items-center justify-center text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"><Plus size={16} /></button>
                                    </div>
                                    <div className="text-right min-w-[4.5rem]">
                                      <div className="text-[10px] text-slate-600 uppercase">Subtotal</div>
                                      <div className="text-green-400 font-semibold text-sm">₱{unit * qty}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div className="mt-6 border-t border-slate-800 pt-5">
                  <label className="label">Promo Code</label>
                  <div className="flex gap-2">
                    <input type="text" className="input-field flex-1" placeholder="Enter code (e.g. PICKLE10)"
                      value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} />
                    <button onClick={applyPromo} className="btn-secondary px-4 py-2 text-sm whitespace-nowrap">Apply</button>
                  </div>
                  {appliedPromo && <div className="flex items-center gap-2 mt-2 text-green-400 text-sm"><Check size={14} /> {appliedPromo.label} applied!</div>}
                  <p className="text-slate-600 text-xs mt-2">Try: PICKLE10, NEWUSER, MEMBER20</p>
                </div>
              </div>
            )}

            {/* ── Step 3: Payment ── */}
            {step === 3 && (
              <div className="card p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Smartphone size={18} className="text-green-400" /> Payment</h3>

                <div className="mb-6">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <QrCode size={20} className="text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-white font-medium text-sm">Payment QR</p>
                        <p className="text-slate-400 text-xs mt-1">Use the QR code in the next step to pay, then upload your receipt for verification.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 mb-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-white font-medium mb-1">How it works</p>
                      <ol className="text-slate-400 space-y-1 list-decimal list-inside">
                        <li>Open the payment QR popup</li>
                        <li>Scan the QR code with your payment app</li>
                        <li>Upload your payment receipt</li>
                        <li>Submit your booking for review</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex gap-3">
              {step > 1 && <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1 py-3">← Back</button>}
              {step < 3 ? (
                <button onClick={() => {
                  if (step === 1 && selectedCourts.length === 0) return toast.error("Please select at least one court");
                  if (step === 1 && !form.playerName) return toast.error("Player name is required");
                  if (step === 1 && !form.phone) return toast.error("Phone number is required");
                  if (step === 1 && bookingMode === "single") {
                    const openPlayCourt = selectedCourts.find((c) => getOpenPlayScheduleEntry(c, form.date));
                    if (openPlayCourt) return toast.error(`${openPlayCourt.name} is in Open Play on ${form.date}.`);
                    if (!form.timeSlot) return toast.error("Please select a time slot");
                  }
                  if (step === 1 && bookingMode === "recurring") {
                    if (!recurrence.startDate || !recurrence.endDate) return toast.error("Please set a start and end date");
                    if (recurrence.daysOfWeek.length === 0) return toast.error("Please select at least one day of the week");
                    if (!recurrence.startTime || !recurrence.endTime || recurringDuration <= 0) return toast.error("Please set a valid start/end time");
                    if (recurringAvailableDates.length === 0) return toast.error("No available sessions found for this schedule");
                  }
                  setStep(step + 1);
                }} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting}
                  className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...
                    </span>
                  ) : (
                    <><QrCode size={16} /> View Payment QR</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Sidebar summary */}
          <div className="space-y-4">
            <div className="card p-5 sticky top-24">
              <h3 className="text-white font-semibold mb-4 text-sm">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-slate-500 text-xs mb-1">Court{selectedCourts.length !== 1 ? "s" : ""} ({selectedCourts.length})</div>
                  {selectedCourts.length === 0 ? (
                    <div className="text-slate-500 text-sm">Not selected</div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedCourts.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2">
                          <span className="text-white text-sm font-medium truncate">{c.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${c.type === "Indoor" ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"}`}>{c.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {bookingMode === "single" ? (
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Date & Time</div>
                    <div className="text-white">{form.date}</div>
                    <div className="text-green-400">{form.timeSlot || "Not selected"}</div>
                    <div className="text-slate-400 text-xs">{form.duration} {form.duration === 1 ? "hour" : "hours"}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-slate-500 text-xs mb-1 flex items-center gap-1"><Repeat size={11} /> Recurring Schedule</div>
                    <div className="text-white text-xs">{recurrence.startDate || "—"} → {recurrence.endDate || "—"}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {recurrence.daysOfWeek.length > 0
                        ? recurrence.daysOfWeek.map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label).join(", ")
                        : "No days selected"}
                    </div>
                    <div className="text-green-400 text-xs mt-0.5">
                      {recurrence.startTime && recurrence.endTime ? `${to12HourLabel(recurrence.startTime)} – ${to12HourLabel(recurrence.endTime)}` : "No time set"}
                    </div>
                    <div className="text-slate-400 text-xs mt-1">{occurrenceCount} available session{occurrenceCount !== 1 ? "s" : ""}</div>
                  </div>
                )}
                {form.playerName && <div><div className="text-slate-500 text-xs mb-1">Player Name</div><div className="text-white">{form.playerName}</div></div>}
                {equipmentLines.length > 0 && (
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Equipment</div>
                    {equipmentLines.map((e) => (
                      <div key={e.id} className="flex justify-between text-slate-300 text-xs gap-2">
                        <span className="truncate">{e.name}<span className="text-slate-500"> ×{e.qty}</span></span>
                        <span className="shrink-0">₱{e.lineTotal}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-800 mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Court{selectedCourts.length !== 1 ? "s" : ""} ({selectedCourts.length} × {effectiveDuration || 0}hr{bookingMode === "recurring" ? ` × ${occurrenceCount} session${occurrenceCount !== 1 ? "s" : ""}` : ""})</span>
                  <span>₱{courtTotal}</span>
                </div>
                {equipmentTotal > 0 && <div className="flex justify-between text-slate-400"><span>Equipment</span><span>₱{equipmentTotal}</span></div>}
                {discount > 0 && <div className="flex justify-between text-green-400"><span>Promo ({appliedPromo?.code})</span><span>-₱{discount.toFixed(2)}</span></div>}
                <div className="flex justify-between text-white font-semibold text-base pt-2 border-t border-slate-800">
                  <span>Total</span><span className="text-green-400">₱{total.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-blue-400 text-xs">💡 Scan the payment QR, then upload your receipt to complete the booking.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Ph Payment Modal */}
      {showQRModal && (
        <PaymentModal
          amount={total}
          description={
            bookingMode === "recurring"
              ? `Recurring Booking – ${selectedCourts.map((c) => c.name).join(", ")} · ${occurrenceCount} session${occurrenceCount !== 1 ? "s" : ""}`
              : `Court Booking – ${selectedCourts.map((c) => c.name).join(", ")} · ${form.date} ${form.timeSlot}`
          }
          onClose={() => setShowQRModal(false)}
          onSuccess={handleQRPaymentSuccess}
          paymentImg={paymentImg}
          paymentImgUrl={paymentImgUrl}
          processingImage={processingImage}
          onFileChange={handleFileChange}
          inputRef={fileInputRef}
          onRemoveReceipt={() => { setPaymentImg(null); setPaymentImgUrl(""); }}
        />
      )}
    </div>
  );
}
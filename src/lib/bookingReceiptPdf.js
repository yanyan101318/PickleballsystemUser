import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import { normalizeBookingStatus } from "./bookingStatus";

/** Template palette — deep forest green + neutrals */
const FOREST = [49, 27, 146];      // Deep Purple 900
const FOREST_MID = [94, 53, 177];  // Deep Purple 700
const MINT_BOX = [237, 231, 246];  // Deep Purple 50
const GRAY_BG = [243, 244, 246];
const GRAY_BORDER = [209, 213, 219]; 
const GRAY_LABEL = [100, 116, 139];
const BLACK = [17, 24, 39];
const WHITE = [255, 255, 255];

const HELP_PHONE = "+63 912 345 6789";
const HELP_EMAIL = "support@picklezone.com";
const HELP_WEB = "www.picklezone.com";

/** Path to your logo in the public folder. jsPDF needs actual pixel data
 *  (not just a URL) to embed an image, so we fetch it and convert it to a
 *  data URL before drawing. */
const LOGO_URL = "/logo.jpg";

/** Core PDF fonts lack U+20B1 (peso); use ASCII "PHP" to avoid wrong glyphs (e.g. +/-). */
function fmtMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const num = Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `PHP ${num}`;
}

function firestoreToDate(ts) {
  if (ts == null) return null;
  try {
    const d = typeof ts.toDate === "function" ? ts.toDate() : ts;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function statusKey(status) {
  return normalizeBookingStatus(status);
}

function statusDisplay(status) {
  const k = statusKey(status);
  if (k === "approved") return "Confirmed";
  if (k === "cancelled") return "Cancelled";
  return "Pending";
}

function statusBadgeLabel(status) {
  const k = statusKey(status);
  if (k === "approved") return "CONFIRMED";
  if (k === "cancelled") return "CANCELLED";
  return "PENDING";
}

function sumEquipmentDetails(booking) {
  const details = booking.equipmentDetails;
  if (!Array.isArray(details) || details.length === 0) return 0;
  return details.reduce((s, d) => s + (Number(d.lineTotal) || 0), 0);
}

function formatDateWithWeekday(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return `${dateStr} (${format(d, "EEEE")})`;
  } catch {
    return String(dateStr);
  }
}

function receiptNoText(id) {
  if (!id) return "—";
  const s = String(id);
  return s.length > 22 ? `${s.slice(0, 22)}…` : s;
}

function fmtPaymentMethod(method) {
  if (method == null || method === "") return "—";
  const s = String(method);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Generates a random 6-digit numeric confirmation code, e.g. "482913". */
export function generateConfirmationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Fetches an image (from /public or any same-origin path) and converts it
 *  to a base64 data URL so jsPDF can embed it. Returns null on failure so
 *  callers can gracefully fall back instead of breaking receipt generation. */
async function loadImageAsDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Filled trapezoid: top edge shorter on the right */
function fillTrapezoid(doc, x, y, w, h, slant, rgb) {
  doc.setFillColor(...rgb);
  doc.lines(
    [
      [w - slant, 0],
      [slant, h],
      [-w, 0],
      [0, -h],
    ],
    x,
    y,
    [1, 1],
    "F",
    true,
  );
}

/** Vector fallback mark, used only if the logo image can't be loaded. */
function drawPaddleMark(doc, cx, cy, r) {
  doc.setFillColor(...FOREST);
  doc.circle(cx, cy, r, "F");
  doc.setFillColor(...WHITE);
  doc.roundedRect(cx - 2.1, cy - 2.8, 4.2, 3.2, 0.35, 0.35, "F");
  doc.setFillColor(...FOREST_MID);
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      doc.circle(cx - 1.2 + i * 1.2, cy - 1.9 + j * 1.15, 0.22, "F");
    }
  }
  doc.setFillColor(...WHITE);
  doc.rect(cx - 0.35, cy + 0.6, 0.7, 2.4, "F");
  doc.circle(cx + 1.9, cy + 2.5, 0.55, "F");
}

/** Draws the brand logo at the given top-left corner and box size (mm).
 *  Falls back to the vector paddle mark if the image couldn't be loaded. */
function drawLogo(doc, logoDataUrl, x, y, size) {
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, x, y, size, size);
      return;
    } catch {
      // fall through to vector mark
    }
  }
  drawPaddleMark(doc, x + size / 2, y + size / 2, size / 2);
}

function drawSmallIconCircle(doc, cx, cy, rgb = FOREST) {
  doc.setFillColor(...rgb);
  doc.circle(cx, cy, 1.5, "F");
}

/** Small receipt outline, fixed position — does not overlap ID text */
function drawReceiptIconSmall(doc, left, top) {
  const w = 7.5;
  const h = 10;
  doc.setDrawColor(...WHITE);
  doc.setLineWidth(0.28);
  doc.roundedRect(left, top, w, h, 0.35, 0.35, "S");
  doc.line(left + 1.2, top + 2.8, left + w - 1.2, top + 2.8);
  doc.line(left + 1.2, top + 4.2, left + w - 1.2, top + 4.2);
  doc.line(left + 1.2, top + 5.6, left + w - 2, top + 5.6);
}

function drawCalendarClockIcon(doc, cx, cy) {
  doc.setFillColor(...FOREST);
  doc.circle(cx, cy, 2.8, "F");
  doc.setDrawColor(...WHITE);
  doc.setLineWidth(0.22);
  doc.rect(cx - 1.6, cy - 1.7, 3.2, 2.5, "S");
  doc.line(cx - 1.6, cy - 1, cx + 1.6, cy - 1);
  doc.line(cx, cy - 0.35, cx, cy + 0.85);
  doc.line(cx, cy + 0.15, cx + 0.75, cy - 0.35);
}

function drawWatermarkPaddles(doc, x, y, w, h) {
  doc.setDrawColor(195, 215, 205);
  doc.setLineWidth(0.12);
  const mx = x + w * 0.5;
  const my = y + h * 0.45;
  doc.line(mx - 8, my + 5, mx + 8, my - 5);
  doc.line(mx - 8, my - 5, mx + 8, my + 5);
  doc.setFillColor(210, 228, 218);
  doc.roundedRect(mx - 6, my - 4, 4, 3.2, 0.25, 0.25, "F");
  doc.roundedRect(mx + 1.5, my - 0.5, 4, 3.2, 0.25, 0.25, "F");
  doc.circle(mx - 0.3, my + 3.2, 0.75, "F");
}

/** Plain centered logo mark for the footer (no seal circle), sized to
 *  match the header logo so both appear the same size. */
function drawFooterLogo(doc, logoDataUrl, cx, topY, size) {
  drawLogo(doc, logoDataUrl, cx - size / 2, topY, size);
}

function drawDottedLine(doc, x1, x2, y) {
  doc.setDrawColor(...GRAY_BORDER);
  doc.setLineWidth(0.18);
  for (let x = x1; x < x2; x += 1.8) {
    doc.line(x, y, Math.min(x + 0.9, x2), y);
  }
}

function drawSectionTab(doc, margin, y, contentW, title, rgb = FOREST) {
  const h = 6;
  const slant = 2.5;
  fillTrapezoid(doc, margin, y, contentW, h, slant, rgb);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(title, margin + 3.5, y + 4.2);
  return y + h + 1.5;
}

/** Prominent confirmation-code banner the customer shows to the front desk. */
function drawConfirmationCode(doc, margin, y, contentW, code) {
  const h = 17;
  doc.setFillColor(...FOREST);
  doc.roundedRect(margin, y, contentW, h, 2.2, 2.2, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(
    "CONFIRMATION CODE — SHOW THIS AT THE FRONT DESK",
    margin + contentW / 2,
    y + 5,
    { align: "center" },
  );

  const displayCode = code ? String(code) : "——————";
  const spaced = displayCode.split("").join("  ");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(spaced, margin + contentW / 2, y + 13.5, { align: "center" });

  return y + h + 4;
}

/**
 * Single-page receipt (A4). Long notes / many line items are truncated to fit.
 * Loads the brand logo asynchronously, so this function is async — callers
 * must `await` it (or use `.then()`).
 *
 * @param {object} booking - booking.confirmationCode should be a 6-digit
 *   string; generate one with `generateConfirmationCode()` and persist it
 *   on the booking doc before calling this, so the code stays stable across
 *   repeat downloads.
 * @param {object | null} payment
 */
export async function saveBookingReceiptPdf(booking, payment = null) {
  const logoDataUrl = await loadImageAsDataUrl(LOGO_URL);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  const barH = 8;
  const contentMaxY = pageH - barH - 3;
  const issuedStr = format(new Date(), "MMM d, yyyy h:mm a");
  const created = firestoreToDate(booking.createdAt);

  let y = 10;

  /* ——— Header ——— */
  // Logo anchor point (margin, y) is unchanged from before — only the size
  // grows, so the logo still starts at the same top-left position.
  const logoSize = 28;
  drawLogo(doc, logoDataUrl, margin, y, logoSize);

  // Brand name is centered on the page and vertically centered against
  // the (now taller) logo.
  const headerCenterY = y + logoSize / 2;
  doc.setTextColor(...FOREST);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("PickleBros Court", pageW / 2, headerCenterY - 1, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_LABEL);
  doc.text("Play • Train • Enjoy", pageW / 2, headerCenterY + 5.5, { align: "center" });

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BOOKING RECEIPT", pageW - margin, y + 6.5, { align: "right" });

  const badge = statusBadgeLabel(booking.status);
  const sk = statusKey(booking.status);
  const badgeRgb =
    sk === "cancelled" ? [185, 40, 40] : sk === "pending" ? [180, 95, 6] : FOREST;
  doc.setFillColor(...badgeRgb);
  const badgeW = doc.getTextWidth(badge) + 7;
  const badgeH = 5.5;
  const badgeX = pageW - margin - badgeW;
  const badgeY = y + 8.5;
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.text(badge, badgeX + badgeW / 2, badgeY + 3.8, { align: "center" });

  y += Math.max(20, logoSize + 4);
  doc.setDrawColor(...FOREST);
  doc.setLineWidth(0.45);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  /* ——— Receipt no. + Issued (icon left, text column — no overlap) ——— */
  const metaH = 22;
  doc.setFillColor(...GRAY_BG);
  doc.rect(margin, y, contentW, metaH, "F");

  const greenW = contentW * 0.5;
  const slantMeta = 3.5;
  fillTrapezoid(doc, margin, y, greenW, metaH, slantMeta, FOREST);

  const iconLeft = margin + 4;
  const iconTop = y + 6;
  drawReceiptIconSmall(doc, iconLeft, iconTop);

  const textX = margin + 14;
  const textW = margin + greenW - slantMeta - textX - 2;
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("RECEIPT NO.", textX, y + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const rno = receiptNoText(booking.id);
  doc.text(rno, textX, y + 12, { maxWidth: Math.max(28, textW) });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("Thank you for choosing PickleBros Court.", textX, y + metaH - 3);

  const issuedBlockX = margin + greenW + 5;
  drawCalendarClockIcon(doc, issuedBlockX + 3.2, y + metaH * 0.42);

  doc.setTextColor(...GRAY_LABEL);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("ISSUED ON", issuedBlockX + 9, y + 6);
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(issuedStr, issuedBlockX + 9, y + 11.5, {
    maxWidth: contentW - greenW - 16,
  });

  y += metaH + 4;

  /* ——— Confirmation code banner ——— */
  y = drawConfirmationCode(doc, margin, y, contentW, booking.confirmationCode);

  /* ——— Booking details card ——— */
  const colGap = 3;
  const colW = (contentW - colGap) / 2;
  const col1x = margin + 4;
  const col2x = margin + colW + colGap + 4;
  const rowH = 10.5;
  const innerRows = 4;
  const cardPad = 4;
  const cardH = innerRows * rowH + cardPad * 2;

  doc.setDrawColor(...GRAY_BORDER);
  doc.setLineWidth(0.3);
  doc.setFillColor(...WHITE);
  doc.roundedRect(margin, y, contentW, cardH, 2.5, 2.5, "FD");

  function fieldBlock(baseX, rowIndex, label, value) {
    const yy = y + cardPad + rowIndex * rowH;
    drawSmallIconCircle(doc, baseX + 1.4, yy + 3, FOREST);
    doc.setTextColor(...GRAY_LABEL);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text(label, baseX + 4.5, yy + 1.8);
    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const vlines = doc.splitTextToSize(String(value ?? "—"), colW - 7);
    doc.text(vlines, baseX + 4.5, yy + 5.5);
  }

  fieldBlock(col1x, 0, "COURT", booking.courtName || "—");
  fieldBlock(col2x, 0, "PLAYERS", String(booking.players ?? "—"));
  fieldBlock(col1x, 1, "DATE", formatDateWithWeekday(booking.date));
  fieldBlock(col2x, 1, "CUSTOMER", booking.playerName || "—");
  fieldBlock(col1x, 2, "TIME", booking.timeSlot || "—");
  fieldBlock(col2x, 2, "STATUS", statusDisplay(booking.status));
  fieldBlock(col1x, 3, "DURATION", `${booking.duration ?? "—"} hour(s)`);
  fieldBlock(
    col2x,
    3,
    "BOOKED ON",
    created ? format(created, "MMM d, yyyy h:mm a") : "—",
  );

  for (let i = 1; i < innerRows; i += 1) {
    const ly = y + cardPad + i * rowH - 0.5;
    doc.setDrawColor(...GRAY_BORDER);
    doc.setLineWidth(0.12);
    doc.line(margin + 2.5, ly, pageW - margin - 2.5, ly);
  }

  y += cardH + 4;

  /* ——— Line items (cap rows for one page) ——— */
  const details = Array.isArray(booking.equipmentDetails) ? booking.equipmentDetails : [];
  const equipmentSum = sumEquipmentDetails(booking);
  const maxDetailRows = 5;
  const detailRows = details.slice(0, maxDetailRows);
  const hiddenCount = details.length - detailRows.length;

  y = drawSectionTab(doc, margin, y, contentW, "LINE ITEMS", FOREST);

  const tableLeft = margin;
  const tableW = contentW;
  const colDesc = tableLeft + 3;
  const colQty = tableLeft + tableW * 0.62;
  const colAmt = tableLeft + tableW - 3;

  doc.setFillColor(...FOREST);
  doc.rect(tableLeft, y, tableW, 6, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DESCRIPTION", colDesc, y + 4.2);
  doc.text("QTY", colQty, y + 4.2);
  doc.text("AMOUNT", colAmt, y + 4.2, { align: "right" });
  y += 6;

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  if (detailRows.length > 0) {
    for (const d of detailRows) {
      const name = d.name || d.id || "Item";
      const qty = d.qty != null && d.qty > 0 ? String(d.qty) : "—";
      const lineTotal = Number(d.lineTotal) || 0;
      const nameLines = doc.splitTextToSize(name, tableW - 48);
      const blockH = Math.max(5.5, nameLines.length * 3.8 + 2);
      doc.setFillColor(255, 255, 255);
      doc.rect(tableLeft, y - 0.5, tableW, blockH + 0.5, "F");
      doc.text(nameLines, colDesc, y + 3.5);
      doc.text(qty, colQty, y + 3.5);
      doc.text(fmtMoney(lineTotal), colAmt, y + 3.5, { align: "right" });
      y += blockH;
      doc.setDrawColor(...GRAY_BORDER);
      doc.line(tableLeft, y, tableLeft + tableW, y);
    }
    if (hiddenCount > 0) {
      doc.setFontSize(7);
      doc.setTextColor(...GRAY_LABEL);
      doc.text(`+ ${hiddenCount} more item(s) — subtotal includes all.`, colDesc, y + 4);
      y += 5;
    }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.rect(tableLeft, y - 0.5, tableW, 7, "F");
    doc.setTextColor(...GRAY_LABEL);
    doc.setFontSize(7.5);
    doc.text("No equipment add-ons for this booking.", colDesc, y + 4);
    y += 7;
  }

  doc.setDrawColor(...GRAY_BORDER);
  doc.line(tableLeft, y, tableLeft + tableW, y);
  y += 1.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.text("Equipment Subtotal", colDesc, y + 4);
  doc.text(fmtMoney(equipmentSum), colAmt, y + 4, { align: "right" });
  y += 7;

  /* ——— Payment summary ——— */
  y = drawSectionTab(doc, margin, y, contentW, "PAYMENT SUMMARY", FOREST);

  const amount = payment != null ? Number(payment.amount) || 0 : 0;
  const discount = payment != null ? Number(payment.discount) || 0 : 0;
  const hasPayment = payment != null && (payment.amount != null || payment.discount != null);
  const subtotal = hasPayment ? amount + discount : null;
  const courtPortion =
    hasPayment && subtotal != null ? Math.max(0, subtotal - equipmentSum) : null;

  const payBoxH = 30;
  const splitX = tableLeft + tableW * 0.55;
  const moneyRight = splitX - 4;
  const labelLeft = colDesc;
  const labelMaxW = moneyRight - labelLeft - 22;

  doc.setFillColor(...WHITE);
  doc.rect(tableLeft, y, tableW, payBoxH, "F");
  doc.setDrawColor(...GRAY_BORDER);
  doc.setLineWidth(0.22);
  doc.rect(tableLeft, y, tableW, payBoxH, "S");
  doc.line(splitX, y + 1.5, splitX, y + payBoxH - 1.5);

  let py = y + 5.5;
  const lineStep = 5.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);

  function payMoneyLine(bullet, label, moneyStr) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BLACK);
    const prefix = bullet ? `${bullet} ` : "";
    doc.text(`${prefix}${label}`, labelLeft, py, { maxWidth: labelMaxW });
    doc.text(moneyStr, moneyRight, py, { align: "right" });
    py += lineStep;
  }

  if (hasPayment && subtotal != null && courtPortion != null) {
    payMoneyLine("*", "Court rental", fmtMoney(courtPortion));
    payMoneyLine("*", "Equipment", fmtMoney(equipmentSum));
    py += 1;
    drawDottedLine(doc, labelLeft, moneyRight, py);
    py += 3.5;
    payMoneyLine("", "Subtotal", fmtMoney(subtotal));
    if (discount > 0) {
      doc.setTextColor(...GRAY_LABEL);
      doc.text("Discount", labelLeft, py);
      doc.setTextColor(...BLACK);
      const dStr = Number(discount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.text(`- PHP ${dStr}`, moneyRight, py, { align: "right" });
      py += lineStep;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...FOREST);
    doc.text("Total Paid", labelLeft, py);
    doc.text(fmtMoney(amount), moneyRight, py, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BLACK);
  } else {
    doc.setTextColor(...GRAY_LABEL);
    doc.setFontSize(7);
    const msg = doc.splitTextToSize(
      "Totals show when payment is linked. Equipment subtotal is above.",
      labelMaxW + 8,
    );
    doc.text(msg, labelLeft, py);
    py += msg.length * 3.6 + 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...FOREST);
    doc.text("Equipment Subtotal", labelLeft, py);
    doc.text(fmtMoney(equipmentSum), moneyRight, py, { align: "right" });
    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "normal");
  }

  const thankW = tableW * 0.4 - 3;
  const thankX = splitX + 2.5;
  const thankY = y + 3;
  doc.setFillColor(...MINT_BOX);
  doc.roundedRect(thankX, thankY, thankW, payBoxH - 6, 1.8, 1.8, "F");
  drawWatermarkPaddles(doc, thankX, thankY, thankW, payBoxH - 6);

  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...FOREST);
  doc.text("Thank you!", thankX + thankW / 2, thankY + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...BLACK);
  const thanksBody = doc.splitTextToSize(
    "We appreciate your booking and look forward to seeing you on the court.",
    thankW - 3,
  );
  doc.text(thanksBody, thankX + thankW / 2, thankY + 13, { align: "center" });

  y += payBoxH + 3;

  if (booking.promoCode && y < contentMaxY - 28) {
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(`Promo: ${booking.promoCode}`, margin, y);
    y += 4;
  }

  if (booking.notes && y < contentMaxY - 28) {
    doc.setDrawColor(...GRAY_BORDER);
    doc.line(margin, y, pageW - margin, y);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...BLACK);
    doc.text("NOTES", margin, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY_LABEL);
    const nl = doc.splitTextToSize(String(booking.notes), contentW);
    const maxNoteLines = 2;
    doc.text(nl.slice(0, maxNoteLines), margin, y);
    y += Math.min(nl.length, maxNoteLines) * 3.4 + 2;
  }

  /* ——— Footer (keep above bottom bar) ——— */
  // Footer logo matches the header logo size (28mm). Reserve enough room
  // above the official bar so it doesn't get clipped.
  const footerLogoSize = logoSize;
  const footerRowH = 17;
  const footerBlockH = Math.max(footerRowH, footerLogoSize);

  y = Math.min(y + 2, contentMaxY - footerBlockH - 4);
  doc.setDrawColor(...GRAY_BORDER);
  doc.setLineWidth(0.18);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  const footMid = pageW / 2;
  doc.setFillColor(...GRAY_BG);
  doc.roundedRect(margin, y - 1.5, 4.5, 4.5, 0.4, 0.4, "F");
  doc.setDrawColor(...FOREST);
  doc.setLineWidth(0.18);
  doc.roundedRect(margin + 0.5, y - 1, 3.5, 2.1, 0.15, 0.15, "S");
  doc.line(margin + 1, y + 0.3, margin + 3.5, y + 0.3);

  doc.setTextColor(...GRAY_LABEL);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("PAYMENT METHOD", margin + 6, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.text(fmtPaymentMethod(hasPayment ? payment.method : null), margin + 6, y + 4);

  const footLogoTopY = y + (footerBlockH - footerLogoSize) / 2;
  drawFooterLogo(doc, logoDataUrl, footMid, footLogoTopY, footerLogoSize);

  const helpX = pageW - margin - 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...FOREST);
  doc.text("NEED HELP?", helpX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...BLACK);
  doc.text(HELP_PHONE, helpX, y + 4.5, { align: "right" });
  doc.text(HELP_EMAIL, helpX, y + 8.5, { align: "right" });
  doc.text(HELP_WEB, helpX, y + 12.5, { align: "right" });

  /* ——— Official bar ——— */
  doc.setFillColor(...FOREST);
  doc.rect(0, pageH - barH, pageW, barH, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    "This is an official receipt. Please keep this receipt for your records.",
    pageW / 2,
    pageH - barH / 2 + 2.2,
    { align: "center" },
  );

  doc.save(`receipt-${booking.id.slice(0, 8)}.pdf`);
}
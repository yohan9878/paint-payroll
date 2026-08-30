import { jsPDF } from "jspdf";

export interface PayslipData {
  companyName?: string;
  employeeName: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  dailyRate: number;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  nightShiftDays?: number;
  nightShiftAmount?: number;
  totalAmount: number;
  sitesWorked?: string;
}

function niceDate(s: string): string {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function money(n: number): string {
  return `Rs ${n.toLocaleString()}`;
}

// jsPDF needs an already-loaded image (not just a URL) to embed it. We load
// /logo.jpg once and reuse it across every slip page — cached so a "download
// all" run doesn't re-fetch it per employee.
let cachedLogo: HTMLImageElement | null | undefined;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

async function getLogoImage(): Promise<HTMLImageElement | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    cachedLogo = await loadImage("/logo.jpg");
  } catch {
    // No logo available (e.g. not uploaded yet) — slips still generate fine without it.
    cachedLogo = null;
  }
  return cachedLogo;
}

// Draws one payslip. If an existing doc is passed, draws on a new page of it
// (used for "download all" multi-page PDFs); otherwise creates a fresh doc.
export function buildPayslipDoc(
  data: PayslipData,
  existingDoc?: jsPDF,
  logoImg?: HTMLImageElement | null
): jsPDF {
  const isNewDoc = !existingDoc;
  const pdf = existingDoc ?? new jsPDF({ unit: "pt", format: "a5" });
  if (!isNewDoc) pdf.addPage();

  const pageWidth = pdf.internal.pageSize.getWidth();
  const marginX = 40;
  const rightX = pageWidth - marginX;
  let y = 50;

  const logoSize = 54;
  let textX = marginX;

  
  if (logoImg) {
    try {
      pdf.addImage(logoImg, "JPEG", marginX, y - logoSize + 20, logoSize, logoSize);
      textX = marginX + logoSize + 12;
    } catch {
      // If the image can't be embedded for any reason, just fall back to text-only header.
      textX = marginX;
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(data.companyName ?? "Doctor Paint", textX, 35);

  y += 5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.setTextColor(110);
  pdf.text("Weekly Payroll Slip", textX, y);
  pdf.setTextColor(0);

  y += 26;
  pdf.setDrawColor(210);
  pdf.line(marginX, y, rightX, y);

  y += 26;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(data.employeeName, marginX, y);

  y += 16;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Pay period: ${niceDate(data.weekStart)} - ${niceDate(data.weekEnd)}`, marginX, y);

  if (data.sitesWorked) {
    y += 14;
    pdf.text(`Sites worked: ${data.sitesWorked}`, marginX, y);
  }

  y += 24;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Description", marginX, y);
  pdf.text("Rate", marginX + 190, y);
  pdf.text("Amount", rightX, y, { align: "right" });

  y += 8;
  pdf.setDrawColor(210);
  pdf.line(marginX, y, rightX, y);

  pdf.setFont("helvetica", "normal");
  const rows: [string, string, string][] = [
    [
      `Full days (${data.fullDays})`,
      money(data.dailyRate),
      money(data.fullDays * data.dailyRate),
    ],
    [
      `Half days (${data.halfDays})`,
      money(data.dailyRate / 2),
      money(data.halfDays * (data.dailyRate / 2)),
    ],
    [`Absent days (${data.absentDays})`, "-", money(0)],
  ];

  if (data.nightShiftDays && data.nightShiftDays > 0) {
    rows.push([
      `Night shifts (${data.nightShiftDays})`,
      money(data.dailyRate / 2),
      money(data.nightShiftAmount ?? data.nightShiftDays * (data.dailyRate / 2)),
    ]);
  }

  rows.forEach(([label, rate, amount]) => {
    y += 22;
    pdf.text(label, marginX, y);
    pdf.text(rate, marginX + 190, y);
    pdf.text(amount, rightX, y, { align: "right" });
  });

  y += 14;
  pdf.setDrawColor(180);
  pdf.line(marginX, y, rightX, y);

  y += 28;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Total pay", marginX, y);
  pdf.text(money(data.totalAmount), rightX, y, { align: "right" });

  y += 40;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(140);
  pdf.text(`Generated ${new Date().toLocaleString()}`, marginX, y);
  pdf.setTextColor(0);

  return pdf;
}

export async function downloadPayslip(data: PayslipData) {
  const logoImg = await getLogoImage();
  const pdf = buildPayslipDoc(data, undefined, logoImg);
  const safeName = data.employeeName.replace(/\s+/g, "_");
  pdf.save(`payslip_${safeName}_${data.weekStart}_to_${data.weekEnd}.pdf`);
}

export async function downloadAllPayslips(list: PayslipData[]) {
  if (list.length === 0) return;
  const logoImg = await getLogoImage();
  let pdf: jsPDF | undefined;
  list.forEach((data) => {
    pdf = buildPayslipDoc(data, pdf, logoImg);
  });
  pdf!.save(`payslips_${list[0].weekStart}_to_${list[0].weekEnd}.pdf`);
}

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

// Draws one payslip. If an existing doc is passed, draws on a new page of it
// (used for "download all" multi-page PDFs); otherwise creates a fresh doc.
export function buildPayslipDoc(data: PayslipData, existingDoc?: jsPDF): jsPDF {
  const isNewDoc = !existingDoc;
  const pdf = existingDoc ?? new jsPDF({ unit: "pt", format: "a5" });
  if (!isNewDoc) pdf.addPage();

  const pageWidth = pdf.internal.pageSize.getWidth();
  const marginX = 40;
  const rightX = pageWidth - marginX;
  let y = 50;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(data.companyName ?? "Payroll Slip", marginX, y);

  y += 20;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(110);
  pdf.text("Weekly Payroll Slip", marginX, y);
  pdf.setTextColor(0);

  y += 18;
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

export function downloadPayslip(data: PayslipData) {
  const pdf = buildPayslipDoc(data);
  const safeName = data.employeeName.replace(/\s+/g, "_");
  pdf.save(`payslip_${safeName}_${data.weekStart}_to_${data.weekEnd}.pdf`);
}

export function downloadAllPayslips(list: PayslipData[]) {
  if (list.length === 0) return;
  let pdf: jsPDF | undefined;
  list.forEach((data) => {
    pdf = buildPayslipDoc(data, pdf);
  });
  pdf!.save(`payslips_${list[0].weekStart}_to_${list[0].weekEnd}.pdf`);
}

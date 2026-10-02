import { jsPDF } from "jspdf";
import type { BaguioSale } from "../../../../types/channel-sale";

export type BaguioDocumentKind = "delivery-order" | "delivery-receipt";

const pageWidth = 241.3;
const pageHeight = 279.4;
const margin = 10;
const contentWidth = pageWidth - margin * 2;
const itemsPerPage = 10;
const money = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const createdAt = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface BaguioPrintForm {
  title: string;
  number: string;
  paper: "9.5 x 11 in continuous";
  fields: Array<{ label: string; value: string }>;
  items: Array<{ quantity: string; description: string; unitPrice: string; amount: string }>;
  total: string;
  notes: string;
  preparedBy: string;
  secondSigner: string;
  secondSignerLabel: string;
  digitalSignature: NonNullable<BaguioSale["deliveryReceipt"]["proof"]>["signature"] | null;
  signedAt: string;
}

export function buildBaguioPrintForm(sale: BaguioSale, kind: BaguioDocumentKind): BaguioPrintForm {
  const isDeliveryOrder = kind === "delivery-order";
  return {
    title: isDeliveryOrder ? "DELIVERY ORDER FORM" : "DELIVERY RECEIPT",
    number: isDeliveryOrder ? sale.deliveryOrder.number : sale.deliveryReceipt.number,
    paper: "9.5 x 11 in continuous",
    fields: isDeliveryOrder ? [
      { label: "Transfer reference", value: sale.referenceNumber },
      { label: "Date created", value: createdAt.format(new Date(sale.createdAt)) },
      { label: "Source inventory", value: "Factory" },
      { label: "Destination inventory", value: sale.van.name },
    ] : [
      { label: "Order reference", value: sale.referenceNumber },
      { label: "Date created", value: createdAt.format(new Date(sale.createdAt)) },
      { label: "Customer", value: sale.clientName },
      { label: "Phone", value: sale.clientPhone || "-" },
      { label: "Delivery address", value: sale.clientAddress },
      { label: "Fulfilled from", value: sale.van.name },
    ],
    items: sale.items.map((item) => ({
      quantity: String(item.quantity),
      description: `${item.productTitle} - ${item.variantLabel}`,
      unitPrice: isDeliveryOrder ? "" : `PHP ${money.format(item.unitPrice)}`,
      amount: isDeliveryOrder ? "" : `PHP ${money.format(item.lineTotal)}`,
    })),
    total: isDeliveryOrder ? "" : `PHP ${money.format(sale.total)}`,
    notes: sale.deliveryNotes,
    preparedBy: sale.deliveryOrder.preparedByName,
    secondSigner: isDeliveryOrder ? "" : sale.clientName,
    secondSignerLabel: isDeliveryOrder ? "Approved by" : "Received by",
    digitalSignature: isDeliveryOrder ? null : sale.deliveryReceipt.proof?.signature ?? null,
    signedAt: isDeliveryOrder || !sale.deliveryReceipt.proof
      ? ""
      : createdAt.format(new Date(sale.deliveryReceipt.proof.signedAt)),
  };
}

export function createBaguioDocumentPdf(sale: BaguioSale, kind: BaguioDocumentKind, logoData?: Uint8Array): Blob {
  const form = buildBaguioPrintForm(sale, kind);
  const pages = chunk(form.items, itemsPerPage);
  const document = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageWidth, pageHeight],
    putOnlyUsedFonts: true,
    compress: true,
  });
  document.setProperties({
    title: `${form.title} ${form.number}`,
    subject: `Continuous form for ${sale.referenceNumber}`,
    author: "Romana Peanut Brittle",
  });
  pages.forEach((items, index) => {
    if (index) document.addPage([pageWidth, pageHeight], "portrait");
    drawPage(document, form, items, index + 1, pages.length, index === pages.length - 1, logoData);
  });
  return document.output("blob");
}

export function getBaguioDocumentFilename(sale: BaguioSale, kind: BaguioDocumentKind): string {
  const number = kind === "delivery-order" ? sale.deliveryOrder.number : sale.deliveryReceipt.number;
  return `${number.replace(/[^a-z0-9_-]/gi, "-")}.pdf`;
}

function drawPage(document: jsPDF, form: BaguioPrintForm, items: BaguioPrintForm["items"], page: number, pageCount: number, isLastPage: boolean, logoData?: Uint8Array): void {
  document.setTextColor(0);
  document.setDrawColor(0);
  document.setLineWidth(0.35);
  document.rect(margin, 10, contentWidth, 27);
  if (logoData) document.addImage(logoData, "PNG", margin + 4, 13, 31, 18.8);
  document.setFont("helvetica", "bold");
  document.setFontSize(8);
  document.text("FACTORY SALES AND DELIVERY", margin + 39, 25);
  document.setFontSize(12);
  document.text(form.title, pageWidth - margin - 5, 19, { align: "right" });
  document.setFontSize(8);
  document.text(`FORM NO. ${safeText(form.number)}`, pageWidth - margin - 5, 25, { align: "right" });
  document.text(`PAGE ${page} OF ${pageCount}`, pageWidth - margin - 5, 31, { align: "right" });

  drawFields(document, form.fields);
  drawItems(document, form, items);
  drawFooter(document, form, isLastPage);
}

function drawFields(document: jsPDF, fields: BaguioPrintForm["fields"]): void {
  const columns = 2;
  const columnWidth = contentWidth / columns;
  const rowCount = Math.ceil(fields.length / columns);
  const rowHeight = 15;
  fields.forEach((field, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * columnWidth;
    const y = 41 + row * rowHeight;
    document.rect(x, y, columnWidth, rowHeight);
    document.setFont("courier", "normal");
    document.setFontSize(6.5);
    document.text(field.label.toUpperCase(), x + 3, y + 4);
    document.setFont("courier", "bold");
    document.setFontSize(8.5);
    document.text(wrap(document, field.value, columnWidth - 6), x + 3, y + 9, { lineHeightFactor: 1.05 });
  });
  const unusedCellCount = rowCount * columns - fields.length;
  if (unusedCellCount) document.rect(margin + columnWidth, 41 + (rowCount - 1) * rowHeight, columnWidth, rowHeight);
}

function drawItems(document: jsPDF, form: BaguioPrintForm, items: BaguioPrintForm["items"]): void {
  const isDeliveryOrder = form.title === "DELIVERY ORDER FORM";
  const top = 92;
  const widths = isDeliveryOrder ? [28, contentWidth - 28] : [22, 105, 45, contentWidth - 172];
  const headings = isDeliveryOrder ? ["QTY", "PRODUCT / VARIANT"] : ["QTY", "PRODUCT / VARIANT", "UNIT PRICE", "AMOUNT"];
  let x = margin;
  document.setFont("courier", "bold");
  document.setFontSize(7.5);
  headings.forEach((heading, index) => {
    document.rect(x, top, widths[index], 9);
    document.text(heading, x + (index ? 3 : widths[index] / 2), top + 5.7, { align: index ? "left" : "center" });
    x += widths[index];
  });
  items.forEach((item, rowIndex) => {
    const y = top + 9 + rowIndex * 11;
    const values = isDeliveryOrder
      ? [item.quantity, item.description]
      : [item.quantity, item.description, item.unitPrice, item.amount];
    let cellX = margin;
    values.forEach((value, index) => {
      document.rect(cellX, y, widths[index], 11);
      document.setFont("courier", index === 1 ? "bold" : "normal");
      document.setFontSize(index === 1 ? 8 : 7.5);
      const alignment = index === 0 ? "center" : index > 1 ? "right" : "left";
      const textX = alignment === "right" ? cellX + widths[index] - 3 : alignment === "center" ? cellX + widths[index] / 2 : cellX + 3;
      document.text(index === 1 ? wrap(document, value, widths[index] - 6) : safeText(value), textX, y + 4.7, { align: alignment, lineHeightFactor: 1.05 });
      cellX += widths[index];
    });
  });
  for (let rowIndex = items.length; rowIndex < itemsPerPage; rowIndex += 1) {
    const y = top + 9 + rowIndex * 11;
    let cellX = margin;
    widths.forEach((width) => {
      document.rect(cellX, y, width, 11);
      cellX += width;
    });
  }
}

function drawFooter(document: jsPDF, form: BaguioPrintForm, isLastPage: boolean): void {
  const notesTop = 214;
  document.rect(margin, notesTop, form.total ? 155 : contentWidth, 25);
  document.setFont("courier", "normal");
  document.setFontSize(6.5);
  document.text("DELIVERY / TRANSFER NOTES", margin + 3, notesTop + 4);
  document.setFontSize(8);
  if (isLastPage) document.text(wrap(document, form.notes || "-", form.total ? 149 : contentWidth - 6), margin + 3, notesTop + 9, { lineHeightFactor: 1.1 });
  if (form.total) {
    document.rect(margin + 155, notesTop, contentWidth - 155, 25);
    document.setFont("courier", "bold");
    document.setFontSize(8);
    document.text("TOTAL AMOUNT", pageWidth - margin - 3, notesTop + 7, { align: "right" });
    document.setFontSize(12);
    document.text(isLastPage ? form.total : "CONTINUED", pageWidth - margin - 3, notesTop + 17, { align: "right" });
  }
  drawSignature(document, margin + 3, 260, 64, isLastPage ? form.preparedBy : "", "Prepared by");
  if (isLastPage && form.digitalSignature) {
    drawDigitalSignature(document, margin + 78, 241, 64, 16, form.digitalSignature);
  }
  drawSignature(document, margin + 78, 260, 64, isLastPage && !form.digitalSignature ? form.secondSigner : "", form.secondSignerLabel);
  drawSignature(document, margin + 153, 260, contentWidth - 156, isLastPage ? form.signedAt : "", "Date / time");
  document.setFont("courier", "normal");
  document.setFontSize(6.5);
  document.text("PRINT AT 100% SCALE - 9.5 x 11 IN CONTINUOUS PAPER - DO NOT FIT TO PAGE", pageWidth / 2, 274, { align: "center" });
}

function drawDigitalSignature(
  document: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  strokes: Array<Array<{ x: number; y: number }>>,
): void {
  document.setLineWidth(0.6);
  strokes.forEach((stroke) => {
    for (let index = 1; index < stroke.length; index += 1) {
      const start = stroke[index - 1];
      const end = stroke[index];
      document.line(x + start.x * width, y + start.y * height, x + end.x * width, y + end.y * height);
    }
  });
  document.setLineWidth(0.35);
}

function drawSignature(document: jsPDF, x: number, y: number, width: number, name: string, label: string): void {
  document.setFont("courier", "bold");
  document.setFontSize(8);
  document.text(safeText(name), x + width / 2, y - 3, { align: "center", maxWidth: width });
  document.line(x, y, x + width, y);
  document.setFont("courier", "normal");
  document.setFontSize(6.5);
  document.text(label, x + width / 2, y + 4, { align: "center" });
}

function wrap(document: jsPDF, value: string, width: number): string[] {
  return document.splitTextToSize(safeText(value), width) as string[];
}

function safeText(value: string): string {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, "\"").replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?").trim();
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks.length ? chunks : [[]];
}

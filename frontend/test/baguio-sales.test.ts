import assert from "node:assert/strict";
import test from "node:test";
import { readBaguioSalesSubview, readSelectedBaguioDispatchId, readSelectedBaguioSaleId } from "../src/app/(dashboard)/baguio-sales/_lib/routing.ts";
import { matchesBaguioDispatchSearch } from "../src/app/(dashboard)/baguio-sales/_lib/dispatch-search.ts";
import { getExpectedDispatchReference } from "../src/app/(dashboard)/baguio-sales/_lib/dispatch-reference.ts";
import { buildBaguioDispatchLoadSheetHtml } from "../src/app/(dashboard)/baguio-sales/_lib/print-document.ts";
import { buildBaguioPrintForm, createBaguioDocumentPdf, getBaguioDocumentFilename } from "../src/app/(dashboard)/baguio-sales/_lib/continuous-form-pdf.ts";
import { matchesBaguioOrderSearch } from "../src/app/(dashboard)/baguio-sales/_lib/order-search.ts";
import { getBaguioSaleProgressStage, getBaguioSaleStatusLabel } from "../src/app/(dashboard)/baguio-sales/_lib/workflow.ts";
import type { BaguioDispatch } from "../src/types/channel-sale.ts";

test("reads a Baguio sale id from its detail URL", () => {
  assert.equal(readSelectedBaguioSaleId("#baguio-sales/sale-123"), "sale-123");
  assert.equal(readSelectedBaguioSaleId("#baguio-sales"), null);
  assert.equal(readSelectedBaguioSaleId("#baguio-sales/sale-123/extra"), null);
});

test("distinguishes dispatch detail URLs from order detail URLs", () => {
  assert.equal(readSelectedBaguioSaleId("#baguio-sales/dispatches"), null);
  assert.equal(readSelectedBaguioDispatchId("#baguio-sales/dispatches/dispatch-123"), "dispatch-123");
});

test("routes Baguio Sales sidebar actions without treating them as order ids", () => {
  assert.equal(readBaguioSalesSubview("#baguio-sales/new-order"), "new-order");
  assert.equal(readBaguioSalesSubview("#baguio-sales/new-dispatch"), "new-dispatch");
  assert.equal(readBaguioSalesSubview("#baguio-sales/drivers"), null);
  assert.equal(readBaguioSalesSubview("#baguio-sales/new-driver"), null);
  assert.equal(readSelectedBaguioSaleId("#baguio-sales/new-driver"), null);
});

test("presents the initial database state as an order that has been created", () => {
  assert.equal(getBaguioSaleStatusLabel("draft"), "Order created");
});

test("groups detailed Baguio statuses into four progress stages", () => {
  assert.equal(getBaguioSaleProgressStage("draft"), 0);
  assert.equal(getBaguioSaleProgressStage("approved"), 0);
  assert.equal(getBaguioSaleProgressStage("loaded"), 1);
  assert.equal(getBaguioSaleProgressStage("in_transit"), 2);
  assert.equal(getBaguioSaleProgressStage("delivered"), 2);
  assert.equal(getBaguioSaleProgressStage("successful"), 3);
  assert.equal(getBaguioSaleProgressStage("cancelled"), -1);
});

test("searches Baguio orders across customer, document, product, and status details", () => {
  const order = makeOrder("order-1", "BAG-001", "Josef & Sons", "Session Road", 2);

  assert.equal(matchesBaguioOrderSearch(order, "bag-001"), true);
  assert.equal(matchesBaguioOrderSearch(order, "JOSEF"), true);
  assert.equal(matchesBaguioOrderSearch(order, "DO-order-1"), true);
  assert.equal(matchesBaguioOrderSearch(order, "peanut brittle"), true);
  assert.equal(matchesBaguioOrderSearch(order, "in transit"), true);
  assert.equal(matchesBaguioOrderSearch(order, "no matching order"), false);
});

test("builds a driver load sheet with destinations and consolidated quantities", () => {
  const dispatch = {
    id: "dispatch-1", referenceNumber: "DSP-001", status: "in_transit", vanLocationId: "van-1",
    van: { id: "van-1", code: "VAN-1", name: "Baguio Van", type: "vehicle" }, notes: "Follow the numbered route.",
    createdAt: "2026-09-29T00:00:00Z", departedAt: "2026-09-29T01:00:00Z", driver: null, originalAllocation: [],
    orders: [makeOrder("order-1", "BAG-001", "Josef & Sons", "Session Road", 2), makeOrder("order-2", "BAG-002", "North Shop", "Magsaysay Avenue", 3)],
  } satisfies BaguioDispatch;

  const html = buildBaguioDispatchLoadSheetHtml(dispatch);

  assert.match(html, /Driver Load Sheet/);
  assert.match(html, /class="stop-number">1/);
  assert.match(html, /Session Road/);
  assert.match(html, /Magsaysay Avenue/);
  assert.match(html, /<b>5×<\/b> Peanut Brittle/);
  assert.match(html, /Josef &amp; Sons/);
  assert.match(html, /size:A4 landscape/);
  assert.doesNotMatch(html, /<b>Status:<\/b>/);
});

test("searches dispatches across inventory, status, and assigned order details", () => {
  const dispatch = {
    id: "dispatch-1", referenceNumber: "DSP-001", status: "in_transit", vanLocationId: "van-1",
    van: { id: "van-1", code: "VAN-1", name: "Baguio Van", type: "vehicle" }, notes: "Morning route",
    createdAt: "2026-09-29T00:00:00Z", departedAt: null, driver: null, originalAllocation: [],
    orders: [makeOrder("order-1", "BAG-001", "Josef & Sons", "Session Road", 2)],
  } satisfies BaguioDispatch;

  assert.equal(matchesBaguioDispatchSearch(dispatch, "dsp-001"), true);
  assert.equal(matchesBaguioDispatchSearch(dispatch, "baguio van"), true);
  assert.equal(matchesBaguioDispatchSearch(dispatch, "in transit"), true);
  assert.equal(matchesBaguioDispatchSearch(dispatch, "Josef"), true);
  assert.equal(matchesBaguioDispatchSearch(dispatch, "peanut brittle"), true);
  assert.equal(matchesBaguioDispatchSearch(dispatch, "not found"), false);
});

test("shows the expected next dispatch reference", () => {
  const dispatch = {
    id: "dispatch-1", referenceNumber: "DSP-000041", status: "preparing", vanLocationId: "van-1",
    van: { id: "van-1", code: "VAN-1", name: "Baguio Van", type: "vehicle" }, notes: "",
    createdAt: "2026-09-29T00:00:00Z", departedAt: null, driver: null, originalAllocation: [], orders: [],
  } satisfies BaguioDispatch;

  assert.equal(getExpectedDispatchReference([]), "DSP-000001");
  assert.equal(getExpectedDispatchReference([{ ...dispatch, referenceNumber: "legacy" }, dispatch]), "DSP-000042");
});

test("builds a continuous delivery order form as an internal inventory transfer", () => {
  const form = buildBaguioPrintForm(makeOrder("order-1", "BAG-001", "Josef & Sons", "Session Road", 2), "delivery-order");

  assert.equal(form.title, "DELIVERY ORDER FORM");
  assert.equal(form.paper, "9.5 x 11 in continuous");
  assert.deepEqual(form.fields.map((field) => field.label), ["Transfer reference", "Date created", "Source inventory", "Destination inventory"]);
  assert.equal(form.fields.at(-1)?.value, "Baguio Van");
  assert.equal(form.total, "");
  assert.equal(form.secondSigner, "");
  assert.equal(form.items[0]?.quantity, "2");
});

test("creates a continuous-paper delivery receipt PDF with totals and signers", async () => {
  const order = makeOrder("order-1", "BAG-001", "Josef & Sons", "Session Road", 2);
  const form = buildBaguioPrintForm(order, "delivery-receipt");
  const pdf = createBaguioDocumentPdf(order, "delivery-receipt");
  const header = Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString("ascii");

  assert.equal(form.total, "PHP 200.00");
  assert.equal(form.preparedBy, "Admin");
  assert.equal(form.secondSigner, "Josef & Sons");
  assert.equal(form.secondSignerLabel, "Received by");
  assert.equal(pdf.type, "application/pdf");
  assert.equal(header, "%PDF-");
  assert.ok(pdf.size > 1_000);
  assert.equal(getBaguioDocumentFilename(order, "delivery-receipt"), "DR-order-1.pdf");
});

test("continues long delivery forms onto additional continuous sheets", async () => {
  const order = makeOrder("order-1", "BAG-001", "Josef & Sons", "Session Road", 2);
  order.items = Array.from({ length: 11 }, (_, index) => ({
    ...order.items[0],
    productVariantId: `variant-${index}`,
    productTitle: `Peanut Brittle ${index + 1}`,
  }));
  const pdf = createBaguioDocumentPdf(order, "delivery-order");
  const contents = Buffer.from(await pdf.arrayBuffer()).toString("latin1");

  assert.equal(contents.match(/\/Type \/Page\b/g)?.length, 2);
});

function makeOrder(id: string, referenceNumber: string, clientName: string, clientAddress: string, quantity: number) {
  return {
    id, referenceNumber, clientName, clientAddress, clientPhone: "09170000000", customerId: `customer-${id}`,
    status: "in_transit" as const, dispatchId: "dispatch-1", addedAfterDeparture: false, revisionCount: 0,
    van: { id: "van-1", code: "VAN-1", name: "Baguio Van", type: "vehicle" as const }, total: quantity * 100,
    createdAt: "2026-09-29T00:00:00Z", deliveryNotes: "Call on arrival.",
    deliveryOrder: { number: `DO-${id}`, status: "dispatched" as const, preparedByName: "Admin" },
    deliveryReceipt: { number: `DR-${id}`, status: "issued" as const, clientAcknowledgedAt: null },
    items: [{ productVariantId: "variant-1", productTitle: "Peanut Brittle", variantLabel: "Regular", quantity, unitPrice: 100, lineTotal: quantity * 100 }],
  };
}

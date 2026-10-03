import { MapPin, PenLine } from "lucide-react";
import type { BaguioSale } from "../../../../types/channel-sale";
import { fitSignatureToPreview, signaturePreviewSize } from "../_lib/signature-preview";

const signedDate = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const paymentModeLabels = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
} as const;
export function DriverDeliveryProofCard({
  proof,
}: {
  proof: BaguioSale["deliveryReceipt"]["proof"];
}) {
  if (!proof) {
    return (
      <section className="rounded-md border border-[var(--line)] bg-white p-5" aria-labelledby="client-signature-title">
        <div className="flex items-center gap-3">
          <PenLine className="size-4 text-[var(--muted)]" />
          <h3 className="m-0 text-sm" id="client-signature-title">Client signature</h3>
        </div>
        <p className="mb-0 mt-3 text-sm text-[var(--muted)]">No digital delivery signature has been recorded for this order.</p>
      </section>
    );
  }
  const previewSignature = fitSignatureToPreview(proof.signature);
  const coordinates = `${proof.latitude.toFixed(6)}, ${proof.longitude.toFixed(6)}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${proof.latitude},${proof.longitude}`;
  return (
    <section className="overflow-hidden rounded-md border border-[var(--line)]" aria-labelledby="client-signature-title">
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--paper)] px-4 py-3 sm:px-5">
        <PenLine className="size-4 text-[var(--red)]" />
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-sm" id="client-signature-title">Client signature</h3>
          <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">Signed {signedDate.format(new Date(proof.signedAt))}</p>
        </div>
        <span className="rounded-full bg-[#d8ebdf] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#286443]">Digital proof received</span>
      </header>
      <div className="bg-white p-4 sm:p-5">
        <div className="flex justify-center rounded bg-[var(--paper)] p-3 sm:p-4">
          <div className="aspect-[384/190] w-full overflow-hidden rounded border border-[var(--line)] bg-white shadow-sm">
            <svg
              className="block h-full! w-full! flex-none! text-[#241d16]"
              role="img"
              aria-label="Client's delivery signature"
              viewBox={`0 0 ${signaturePreviewSize.width} ${signaturePreviewSize.height}`}
            >
              {previewSignature.map((stroke, index) => (
                <path
                  d={stroke.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x * signaturePreviewSize.width} ${point.y * signaturePreviewSize.height}`).join(" ")}
                  fill="none"
                  key={index}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </div>
        </div>
        <div className="mt-3 grid gap-3 border-t border-dashed border-[var(--line)] pt-3 text-xs text-[var(--muted)] sm:grid-cols-2">
          <div>
            <strong className="block text-[var(--ink)]">Amount collected</strong>
            <span className="mt-0.5 block">{proof.collectedAmount === null ? "Not recorded" : peso.format(proof.collectedAmount)}</span>
          </div>
          <div>
            <strong className="block text-[var(--ink)]">Mode of payment</strong>
            <span className="mt-0.5 block">{proof.paymentMode ? paymentModeLabels[proof.paymentMode] : "Not recorded"}</span>
          </div>
        </div>
        <a
          className="mt-3 flex items-center gap-3 border-t border-dashed border-[var(--line)] pt-3 text-xs text-[var(--muted)] no-underline hover:text-[var(--red)] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--red)]"
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open delivery location ${coordinates} in Google Maps`}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f7e5e5] text-[var(--red)]">
            <MapPin className="size-4" />
          </span>
          <span>
            <strong className="block text-[var(--ink)]">View delivery pin in Google Maps</strong>
            <span className="mt-0.5 block">{coordinates} · accuracy ±{Math.round(proof.accuracy)} m</span>
          </span>
        </a>
      </div>
    </section>
  );
}

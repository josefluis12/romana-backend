import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import type { BaguioSale } from "../../../../types/channel-sale";
import type { BaguioDocumentKind } from "../_lib/continuous-form-pdf";

export function BaguioDocumentPreview({ sale, kind, onClose }: {
  sale: BaguioSale;
  kind: BaguioDocumentKind;
  onClose: () => void;
}) {
  const pdfUrl = useBaguioDocumentPdfUrl(sale, kind);
  const title = kind === "delivery-order" ? "Delivery order" : "Delivery receipt";
  const documentNumber = kind === "delivery-order" ? sale.deliveryOrder.number : sale.deliveryReceipt.number;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 grid bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="baguio-document-preview-title">
      <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-[#343434] shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 bg-[#242424] px-4 py-3 text-white">
          <div>
            <h2 className="m-0 text-sm" id="baguio-document-preview-title">{title} PDF</h2>
            <p className="m-0 mt-0.5 text-xs text-white/65">Print at 100% scale on 9.5 × 11 inch continuous paper.</p>
          </div>
          <div className="flex items-center gap-2">
            {pdfUrl && (
              <a className="flex h-9 items-center gap-2 rounded border border-white/25 px-3 text-xs font-bold text-white no-underline hover:bg-white/10" href={pdfUrl} download={`${documentNumber.replace(/[^a-z0-9_-]/gi, "-")}.pdf`}>
                <Download className="size-4" />Download
              </a>
            )}
            <button className="grid size-9 place-items-center rounded border border-white/25 bg-transparent text-white hover:bg-white/10" type="button" onClick={onClose} aria-label="Close PDF preview" title="Close">
              <X className="size-4" />
            </button>
          </div>
        </header>
        {pdfUrl
          ? <iframe className="min-h-0 flex-1 border-0 bg-[#525659]" src={pdfUrl} title={`${title} PDF preview`} />
          : <div className="grid flex-1 place-items-center text-sm text-white" role="status">Preparing PDF…</div>}
      </section>
    </div>
  );
}

export function BaguioDocumentInlinePreview({ sale, kind }: { sale: BaguioSale; kind: BaguioDocumentKind }) {
  const pdfUrl = useBaguioDocumentPdfUrl(sale, kind);
  const title = kind === "delivery-order" ? "Delivery order form" : "Delivery receipt";
  return pdfUrl
    ? <iframe className="h-[480px] w-full border-0 bg-[#525659] sm:h-[620px]" src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} title={`${title} PDF preview`} />
    : <div className="grid h-[480px] place-items-center bg-[#525659] text-sm text-white sm:h-[620px]" role="status">Preparing {title.toLowerCase()} preview…</div>;
}

function useBaguioDocumentPdfUrl(sale: BaguioSale, kind: BaguioDocumentKind): string {
  const [pdfUrl, setPdfUrl] = useState("");
  useEffect(() => {
    let active = true;
    let url = "";
    void Promise.all([
      import("../_lib/continuous-form-pdf"),
      fetch("/logo.png")
        .then(async (response) => response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined)
        .catch(() => undefined),
    ]).then(([{ createBaguioDocumentPdf }, logoData]) => {
      if (!active) return;
      url = URL.createObjectURL(createBaguioDocumentPdf(sale, kind, logoData));
      setPdfUrl(url);
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [kind, sale]);
  return pdfUrl;
}

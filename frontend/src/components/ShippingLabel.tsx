import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import QRCode from "qrcode";
import type { Order } from "../types/order";

interface ShippingLabelProps {
  order: Order;
  onClose: () => void;
}

export function ShippingLabel({ order, onClose }: ShippingLabelProps) {
  const [qrCode, setQrCode] = useState("");
  const [qrError, setQrError] = useState("");
  const address = formatAddress(order);
  const orderUrl = createOrderUrl(order.id);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(orderUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((dataUrl) => {
      if (active) setQrCode(dataUrl);
    }).catch(() => {
      if (active) setQrError("The QR code could not be generated.");
    });
    return () => {
      active = false;
    };
  }, [orderUrl]);

  return (
    <div className="shipping-label-backdrop" role="dialog" aria-modal="true" aria-labelledby="shipping-label-title">
      <div className="shipping-label-dialog">
        <header className="shipping-label-toolbar">
          <div>
            <strong id="shipping-label-title">Shipping label preview</strong>
            <small>Print at 100% scale on a 4 × 6 inch label.</small>
          </div>
          <div>
            <button type="button" onClick={() => window.print()} disabled={!qrCode}>
              <Printer />Print label
            </button>
            <button type="button" onClick={onClose} aria-label="Close shipping label" title="Close">
              <X />
            </button>
          </div>
        </header>
        <section className="shipping-label">
          <header>
            <strong>ROMANA</strong>
            <span>SHIP TO</span>
          </header>
          <div className="shipping-label-recipient">
            <strong>{order.customer.firstName} {order.customer.lastName}</strong>
            <p>{address}</p>
            <span>{order.customer.phone}</span>
          </div>
          <div className="shipping-label-order">
            <div>
              <small>ORDER</small>
              <strong>#{order.referenceNumber.slice(0, 8).toUpperCase()}</strong>
              <small>{order.items.reduce((total, item) => total + item.quantity, 0)} PACKAGE ITEM(S)</small>
              {order.shipment && <small>{order.shipment.carrier} · {order.shipment.trackingNumber}</small>}
            </div>
            <div className="shipping-label-qr">
              {qrCode && <img src={qrCode} alt={`QR code for order ${order.referenceNumber}`} />}
              {!qrCode && !qrError && <span role="status">Generating QR…</span>}
              {qrError && <span role="alert">{qrError}</span>}
            </div>
          </div>
          <footer>
            <span>Scan to open the order</span>
            <small>Authentication is required to view order details.</small>
          </footer>
        </section>
      </div>
    </div>
  );
}

function createOrderUrl(orderId: string): string {
  const url = new URL(window.location.href);
  url.hash = `orders/${orderId}`;
  return url.toString();
}

function formatAddress(order: Order): string {
  const address = order.shippingAddress;
  return [
    address.street,
    address.barangay,
    address.district,
    address.locality,
    address.province,
    address.region,
    address.postalCode,
    address.country,
  ].filter(Boolean).join(", ");
}

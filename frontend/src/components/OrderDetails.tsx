import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, ClipboardList, Copy, Printer, Truck } from "lucide-react";
import type { Order, OrderStatus, ShipmentInput } from "../types/order";
import { ShipOrderDialog } from "./ShipOrderDialog";
import { ShippingLabel } from "./ShippingLabel";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const date = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });
const trackingSteps: Array<{ status: OrderStatus; label: string }> = [
  { status: "paid", label: "Payment received" },
  { status: "processing", label: "Preparing order" },
  { status: "shipped", label: "Shipped" },
  { status: "completed", label: "Delivered" },
];

interface OrderDetailsProps {
  order: Order;
  error: string;
  startingPreparation: boolean;
  shippingOrder: boolean;
  onStartPreparation: (order: Order) => Promise<boolean>;
  onShipOrder: (order: Order, shipment: ShipmentInput) => Promise<boolean>;
}

export function OrderDetails({ order, error, startingPreparation, shippingOrder, onStartPreparation, onShipOrder }: OrderDetailsProps) {
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [showShipDialog, setShowShipDialog] = useState(false);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [trackingCopyFailed, setTrackingCopyFailed] = useState(false);
  const address = order.shippingAddress;
  const area = [address.street, address.barangay, address.district, address.locality, address.province, address.region, address.postalCode]
    .filter(Boolean)
    .join(", ");

  async function handleStartPreparation() {
    if (await onStartPreparation(order)) setPrintOrder(order);
  }

  async function copyTrackingNumber() {
    if (!order.shipment) return;
    try {
      await navigator.clipboard.writeText(order.shipment.trackingNumber);
      setTrackingCopied(true);
      setTrackingCopyFailed(false);
    } catch {
      setTrackingCopyFailed(true);
    }
  }

  return (
    <section className="order-detail">
      <a className="order-back-link" href="#orders"><ArrowLeft />Back to orders</a>
      <header className="order-detail-heading">
        <div>
          <p className="eyebrow">Order #{shortReference(order)}</p>
          <h2>{order.customer.firstName} {order.customer.lastName}</h2>
          <time>Paid {date.format(new Date(order.paidAt))}</time>
        </div>
        <div className="order-detail-actions">
          <span className={`order-status order-status-${order.status}`}>{statusLabel(order.status)}</span>
          {order.status === "paid" && (
            <button className="primary-button order-action-button" type="button" disabled={startingPreparation} onClick={() => void handleStartPreparation()}>
              {startingPreparation ? "Starting…" : "Start preparing order"}<ChevronRight />
            </button>
          )}
          {order.status === "processing" && (
            <button className="primary-button order-action-button" type="button" onClick={() => setShowShipDialog(true)}>
              <Truck />Mark as shipped
            </button>
          )}
          {(order.status === "processing" || order.status === "shipped") && (
            <button className="secondary-button order-label-button" type="button" onClick={() => setPrintOrder(order)} aria-label="Print shipping label" title="Print shipping label">
              <Printer />
              <span>Print shipping label</span>
            </button>
          )}
        </div>
      </header>
      {error && <div className="alert" role="alert">{error}</div>}
      <OrderProgress status={order.status} />
      <div className="order-detail-grid">
        <section>
          <h3>Customer and delivery</h3>
          <div className="order-customer">
            <strong>{order.customer.firstName} {order.customer.lastName}</strong>
            <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a>
            <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>
            <p>{area}, Philippines</p>
            {order.deliveryNotes && <small>Delivery note: {order.deliveryNotes}</small>}
          </div>
        </section>
        <section>
          <h3>Order items</h3>
          <div className="order-items">
            {order.items.map((item) => (
              <div key={`${item.productSlug}-${item.variantLabel}`}>
                <span>{item.productTitle}<small>{item.variantLabel} × {item.quantity}</small></span>
                <strong>{peso.format(item.lineTotal)}</strong>
              </div>
            ))}
            <div className="order-total-row"><span>Total paid</span><strong>{peso.format(order.total)}</strong></div>
          </div>
        </section>
      </div>
      {order.shipment && (
        <section className="shipment-details">
          <header><Truck /><h3>Shipment</h3></header>
          <dl>
            <div><dt>Carrier</dt><dd>{order.shipment.carrier}</dd></div>
            <div>
              <dt>Tracking number</dt>
              <dd>{order.shipment.trackingNumber}</dd>
              <button type="button" onClick={() => void copyTrackingNumber()}><Copy />{trackingCopyFailed ? "Copy failed" : trackingCopied ? "Copied" : "Copy"}</button>
            </div>
            {order.shipment.dispatchedAt && <div><dt>Dispatched</dt><dd>{date.format(new Date(order.shipment.dispatchedAt))}</dd></div>}
          </dl>
          {order.shipment.dispatchNote && <p>{order.shipment.dispatchNote}</p>}
        </section>
      )}
      <OrderActivityLog order={order} />
      {printOrder && <ShippingLabel order={printOrder} onClose={() => setPrintOrder(null)} />}
      {showShipDialog && (
        <ShipOrderDialog
          error={error}
          submitting={shippingOrder}
          onClose={() => setShowShipDialog(false)}
          onSubmit={(shipment) => onShipOrder(order, shipment)}
        />
      )}
    </section>
  );
}

function OrderActivityLog({ order }: { order: Order }) {
  return (
    <section className="order-activity">
      <header><ClipboardList /><h3>Activity log</h3></header>
      <ol>
        {order.activity.map((event, index) => (
          <li key={`${event.status}-${event.createdAt}-${index}`}>
            <span />
            <div>
              <strong>{activityLabel(event.status)}</strong>
              {event.shipment && <small>{event.shipment.carrier} · {event.shipment.trackingNumber}</small>}
              <time>{date.format(new Date(event.createdAt))} · {event.actorEmail ?? "System"}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function OrderProgress({ status }: { status: OrderStatus }) {
  const activeIndex = trackingSteps.findIndex((step) => step.status === status);
  const interrupted = status === "cancelled" || status === "refunded";
  return (
    <section className="order-progress" aria-label="Order progress">
      <div className="order-progress-heading">
        <h3>Order progress</h3>
        <p>This tracker advances through order actions and cannot be adjusted freely.</p>
      </div>
      {interrupted && <p className="order-progress-notice">Tracking stopped because this order was {status}.</p>}
      <ol>
        {trackingSteps.map((step, index) => {
          const state = interrupted
            ? (index === 0 ? "complete" : "pending")
            : (index < activeIndex ? "complete" : index === activeIndex ? "current" : "pending");
          return (
            <li className={state} key={step.status} aria-current={state === "current" ? "step" : undefined}>
              <span>{state === "complete" ? <Check /> : index + 1}</span><strong>{step.label}</strong>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function shortReference(order: Order): string {
  return order.referenceNumber.slice(0, 8).toUpperCase();
}

function statusLabel(status: OrderStatus): string {
  return status === "completed" ? "Delivered" : status[0].toUpperCase() + status.slice(1);
}

function activityLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    paid: "Payment received",
    processing: "Order preparation started",
    shipped: "Order shipped",
    completed: "Order delivered",
    cancelled: "Order cancelled",
    refunded: "Order refunded",
  };
  return labels[status];
}

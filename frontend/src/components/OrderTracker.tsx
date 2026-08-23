import { useEffect, useState } from "react";
import {
  ChevronRight,
  PackageOpen,
  RefreshCw,
} from "lucide-react";
import { listOrders, reconcileOrders, shipOrder, startPreparingOrder } from "../services/orders";
import type { Order, OrderStatus, ShipmentInput } from "../types/order";
import { OrderDetails } from "./OrderDetails";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const date = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });

export function OrderTracker({ csrfToken }: { csrfToken: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState(readSelectedOrderId);
  const [loading, setLoading] = useState(true);
  const [startingPreparation, setStartingPreparation] = useState(false);
  const [shippingOrder, setShippingOrder] = useState(false);
  const [error, setError] = useState("");

  async function load(syncPayments = false) {
    setLoading(true);
    setError("");
    try {
      if (syncPayments) await reconcileOrders(csrfToken);
      setOrders(await listOrders());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function startPreparation(order: Order) {
    setStartingPreparation(true);
    setError("");
    try {
      await startPreparingOrder(order.id, csrfToken);
      setOrders(await listOrders());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start preparing the order.");
      return false;
    } finally {
      setStartingPreparation(false);
    }
  }

  async function ship(order: Order, shipment: ShipmentInput) {
    setShippingOrder(true);
    setError("");
    try {
      await shipOrder(order.id, shipment, csrfToken);
      setOrders(await listOrders());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark the order as shipped.");
      return false;
    } finally {
      setShippingOrder(false);
    }
  }

  useEffect(() => {
    function syncSelectedOrder() {
      setSelectedId(readSelectedOrderId());
    }
    window.addEventListener("hashchange", syncSelectedOrder);
    return () => window.removeEventListener("hashchange", syncSelectedOrder);
  }, []);

  if (loading) {
    return <div className="catalog-status" role="status">Loading orders…</div>;
  }

  const selectedOrder = orders.find((order) => order.id === selectedId);
  if (selectedOrder) {
    return (
      <OrderDetails
        order={selectedOrder}
        error={error}
        startingPreparation={startingPreparation}
        shippingOrder={shippingOrder}
        onStartPreparation={startPreparation}
        onShipOrder={ship}
      />
    );
  }

  return (
    <section className="orders-section">
      <div className="orders-toolbar">
        <p>{orders.length} paid order{orders.length === 1 ? "" : "s"}</p>
        <button className="secondary-button" type="button" onClick={() => void load(true)} title="Check pending sessions with Maya">
          <RefreshCw />
          <span>Sync payments</span>
        </button>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      {!orders.length ? (
        <div className="empty-state orders-empty">
          <PackageOpen />
          <h2>No paid orders yet</h2>
          <p>Verified Maya payments will appear here automatically.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => <OrderSummary key={order.id} order={order} />)}
        </div>
      )}
    </section>
  );
}

function OrderSummary({ order }: { order: Order }) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  return (
    <article className="order-summary">
      <div>
        <span className="order-reference">#{shortReference(order)}</span>
        <time>{date.format(new Date(order.paidAt))}</time>
      </div>
      <div>
        <strong>{order.customer.firstName} {order.customer.lastName}</strong>
        <small>{itemCount} item{itemCount === 1 ? "" : "s"}</small>
      </div>
      <strong>{peso.format(order.total)}</strong>
      <span className={`order-status order-status-${order.status}`}>{statusLabel(order.status)}</span>
      <a className="order-view-link" href={`#orders/${order.id}`}>
        View order
        <ChevronRight />
      </a>
    </article>
  );
}

function readSelectedOrderId(): string | null {
  return window.location.hash.match(/^#orders\/([^/]+)$/)?.[1] ?? null;
}

function shortReference(order: Order): string {
  return order.referenceNumber.slice(0, 8).toUpperCase();
}

function statusLabel(status: OrderStatus): string {
  return status === "completed" ? "Delivered" : status[0].toUpperCase() + status.slice(1);
}

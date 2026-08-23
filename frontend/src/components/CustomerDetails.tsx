import { ArrowLeft, Mail, MapPin, Phone, ShoppingBag } from "lucide-react";
import type { Order, OrderStatus } from "../types/order";
import type { CustomerSummary } from "./customer-analytics";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});
const date = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface CustomerDetailsProps {
  customer: CustomerSummary;
  orders: Order[];
  loading: boolean;
  error: string;
}

export function CustomerDetails({ customer, orders, loading, error }: CustomerDetailsProps) {
  const sortedOrders = [...orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const contacts = contactHistory(sortedOrders);
  const addresses = addressHistory(sortedOrders);
  return (
    <section className="customer-detail">
      <a className="customer-back-link" href="#customers"><ArrowLeft />Back to customers</a>
      <header className="customer-detail-heading">
        <div>
          <p className="eyebrow">Customer profile</p>
          <h2>{customer.name}</h2>
          <span>{customer.orderCount > 1 ? "Returning customer" : "New customer"}</span>
        </div>
        <dl>
          <div><dt>Total orders</dt><dd>{customer.orderCount}</dd></div>
          <div><dt>Lifetime spend</dt><dd>{peso.format(customer.totalSpent)}</dd></div>
        </dl>
      </header>
      <section className="customer-contact-card">
        <h3>Contact and latest delivery location</h3>
        <div>
          <a href={`tel:${customer.phone}`}><Phone />{customer.phone}</a>
          <a href={`mailto:${customer.email}`}><Mail />{customer.email}</a>
          <span><MapPin />{customer.location}</span>
        </div>
        <p>The normalized mobile number identifies this customer across checkouts.</p>
      </section>
      {!loading && !error && (
        <section className="customer-used-details">
          <header><h3>Checkout details used</h3><p>Historical information entered on orders under {customer.phone}</p></header>
          <div className="customer-used-grid">
            <div>
              <h4>Names and emails</h4>
              {contacts.map((contact) => (
                <article key={contact.key}>
                  <strong>{contact.name}</strong>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  <small>Last used {date.format(new Date(contact.lastUsedAt))}</small>
                </article>
              ))}
            </div>
            <div>
              <h4>Delivery addresses</h4>
              {addresses.map((address) => (
                <article key={address.key}>
                  <strong>{address.label}</strong>
                  <small>Last used {date.format(new Date(address.lastUsedAt))}</small>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="customer-order-history">
        <header><ShoppingBag /><div><h3>Order history</h3><p>All {orders.length} orders associated with this mobile number</p></div></header>
        {loading ? <div className="customer-history-status" role="status">Loading complete order history…</div> : error ? <div className="alert" role="alert">{error}</div> : <div className="customer-orders-table-wrap">
          <table className="customer-orders-table">
            <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Ship to</th><th>Status</th><th>Total</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{sortedOrders.map((order) => <CustomerOrderRow key={order.id} order={order} />)}</tbody>
          </table>
        </div>}
      </section>
    </section>
  );
}

function CustomerOrderRow({ order }: { order: Order }) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  return (
    <tr>
      <td><strong>#{order.referenceNumber.slice(0, 8).toUpperCase()}</strong></td>
      <td>{date.format(new Date(order.paidAt))}</td>
      <td>{itemCount}</td>
      <td>{order.shippingAddress.locality}, {order.shippingAddress.region}</td>
      <td><span className={`order-status order-status-${order.status}`}>{statusLabel(order.status)}</span></td>
      <td><strong>{peso.format(order.total)}</strong></td>
      <td><a className="customer-view-link" href={`#orders/${order.id}`}>View order</a></td>
    </tr>
  );
}

function statusLabel(status: OrderStatus): string {
  return status === "completed" ? "Delivered" : status[0].toUpperCase() + status.slice(1);
}

function contactHistory(orders: Order[]) {
  const contacts = new Map<string, { key: string; name: string; email: string; lastUsedAt: string }>();
  for (const order of orders) {
    const name = `${order.customer.firstName} ${order.customer.lastName}`.trim();
    const key = `${name.toLowerCase()}\u0000${order.customer.email.toLowerCase()}`;
    if (!contacts.has(key)) contacts.set(key, { key, name, email: order.customer.email, lastUsedAt: order.createdAt });
  }
  return [...contacts.values()];
}

function addressHistory(orders: Order[]) {
  const addresses = new Map<string, { key: string; label: string; lastUsedAt: string }>();
  for (const order of orders) {
    const address = order.shippingAddress;
    const parts = [address.street, address.barangay, address.district, address.locality, address.province, address.region, address.postalCode].filter(Boolean);
    const label = parts.join(", ");
    const key = label.toLowerCase();
    if (!addresses.has(key)) addresses.set(key, { key, label, lastUsedAt: order.createdAt });
  }
  return [...addresses.values()];
}

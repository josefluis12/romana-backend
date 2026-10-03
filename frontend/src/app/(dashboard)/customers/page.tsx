import { useEffect, useState } from "react";
import { CustomerAnalytics } from "../../../components/CustomerAnalytics";
import { createBaguioClient, createCustomerAddress, listBaguioClients, listOnlineCustomers } from "../../../services/channel-sales";
import type { BaguioClient, BaguioClientInput, CustomerAddressInput } from "../../../types/channel-sale";
import { CustomerDirectory } from "./_components/CustomerDirectory";

export function CustomersPage({ csrfToken }: { csrfToken: string }) {
  const [tab, setTab] = useState<"overview" | "online" | "baguio">("overview");
  const [baguioCustomers, setBaguioCustomers] = useState<BaguioClient[]>([]);
  const [onlineCustomers, setOnlineCustomers] = useState<BaguioClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listBaguioClients(), listOnlineCustomers()])
      .then(([baguio, online]) => {
        setBaguioCustomers(baguio);
        setOnlineCustomers(online);
      })
      .catch((cause: unknown) => setError(messageFor(cause)))
      .finally(() => setLoading(false));
  }, []);

  async function register(input: BaguioClientInput) {
    setSubmitting(true);
    setError("");
    try {
      const customer = await createBaguioClient(input, csrfToken);
      setBaguioCustomers((current) => [...current, customer].sort((left, right) => left.name.localeCompare(right.name)));
    } catch (cause) {
      setError(messageFor(cause));
      throw cause;
    } finally {
      setSubmitting(false);
    }
  }

  async function addAddress(customerId: string, input: CustomerAddressInput) {
    setSubmitting(true);
    setError("");
    try {
      const address = await createCustomerAddress(customerId, input, csrfToken);
      setBaguioCustomers((current) => current.map((customer) => customer.id === customerId
        ? { ...customer, addresses: [...customer.addresses, address] }
        : customer));
    } catch (cause) {
      setError(messageFor(cause));
      throw cause;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-9">
      <div className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-5">
        <button
          className={tab === "overview" ? "primary-button compact-button" : "secondary-button"}
          type="button"
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={tab === "online" ? "primary-button compact-button" : "secondary-button"}
          type="button"
          onClick={() => setTab("online")}
        >
          Online customers
        </button>
        <button
          className={tab === "baguio" ? "primary-button compact-button" : "secondary-button"}
          type="button"
          onClick={() => setTab("baguio")}
        >
          Baguio customers
        </button>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      {tab === "overview" && <CustomerAnalytics />}
      {tab !== "overview" && loading && <div className="catalog-status" role="status">Loading customers…</div>}
      {tab === "online" && !loading && <CustomerDirectory customers={onlineCustomers} channelLabel="Online" />}
      {tab === "baguio" && !loading && (
        <CustomerDirectory
          customers={baguioCustomers}
          channelLabel="Baguio"
          submitting={submitting}
          onRegister={register}
          onAddAddress={addAddress}
        />
      )}
    </section>
  );
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : "The customer directory is unavailable.";
}

import { useState, type FormEvent } from "react";
import { Plus, UserRound } from "lucide-react";
import type { BaguioClient, BaguioClientInput, CustomerAddressInput } from "../../../../types/channel-sale";
import { emptyPhilippineAddress, PhilippineAddressFields } from "./PhilippineAddressFields";
import { CustomerCard } from "./CustomerCard";

interface Props {
  customers: BaguioClient[];
  channelLabel: string;
  submitting?: boolean;
  onRegister?: (input: BaguioClientInput) => Promise<void>;
  onAddAddress?: (customerId: string, input: CustomerAddressInput) => Promise<void>;
}

export function CustomerDirectory({ customers, channelLabel, submitting = false, onRegister, onAddAddress }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState(emptyPhilippineAddress);
  const [addressCustomerId, setAddressCustomerId] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!onRegister) return;
      await onRegister({ name, contactPerson, phone, email, address });
    } catch {
      return;
    }
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddress(emptyPhilippineAddress);
    setShowForm(false);
  }

  return <section className="mt-6">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5"><p className="m-0 text-sm text-[var(--muted)]">{customers.length} {channelLabel.toLowerCase()} customer{customers.length === 1 ? "" : "s"}</p>{onRegister && <button className="primary-button compact-button" type="button" onClick={() => setShowForm(true)}><Plus /> Register customer</button>}</div>
    {showForm && onRegister && <form className="mt-5 border border-[var(--line)] bg-white p-5 sm:p-7" onSubmit={(event) => void submit(event)}>
      <div className="flex items-center justify-between"><h2 className="m-0 font-serif text-2xl">Register Baguio customer</h2><button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field label="Customer or business name"><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Contact person"><input maxLength={120} value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} /></Field>
        <Field label="Phone"><input required maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Field label="Email"><input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <PhilippineAddressFields value={address} onChange={setAddress} />
      </div>
      <div className="mt-6 flex justify-end"><button className="primary-button compact-button" type="submit" disabled={submitting}>{submitting ? "Registering…" : "Register customer"}</button></div>
    </form>}
    {!customers.length ? (
      <div className="empty-state">
        <UserRound />
        <h2>No {channelLabel.toLowerCase()} customers</h2>
        <p>{onRegister ? `Register the first ${channelLabel.toLowerCase()} customer here.` : "Website customers appear here after checkout."}</p>
      </div>
    ) : (
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            addingAddress={addressCustomerId === customer.id}
            submitting={submitting}
            onStartAddress={onAddAddress ? () => setAddressCustomerId(customer.id) : undefined}
            onCancelAddress={() => setAddressCustomerId("")}
            onAddAddress={onAddAddress ? async (input) => {
              await onAddAddress(customer.id, input);
              setAddressCustomerId("");
            } : undefined}
          />
        ))}
      </div>
    )}
  </section>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`grid gap-2 text-sm font-bold text-[#4b4944] ${wide ? "md:col-span-2" : ""}`}>{label}<span className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded [&>input]:border [&>input]:border-[#cbc7bd] [&>input]:px-3 [&>textarea]:w-full [&>textarea]:rounded [&>textarea]:border [&>textarea]:border-[#cbc7bd] [&>textarea]:p-3">{children}</span></label>;
}

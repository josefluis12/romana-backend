import { useState, type FormEvent } from "react";
import { Plus, UserRound } from "lucide-react";
import type { BaguioClient, BaguioClientInput } from "../../../../types/channel-sale";
import { emptyPhilippineAddress, PhilippineAddressFields } from "./PhilippineAddressFields";

interface Props {
  customers: BaguioClient[];
  channelLabel: string;
  submitting?: boolean;
  onRegister?: (input: BaguioClientInput) => Promise<void>;
}

export function CustomerDirectory({ customers, channelLabel, submitting = false, onRegister }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState(emptyPhilippineAddress);

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
    {!customers.length ? <div className="empty-state"><UserRound /><h2>No {channelLabel.toLowerCase()} customers</h2><p>{onRegister ? `Register the first ${channelLabel.toLowerCase()} customer here.` : "Website customers appear here after checkout."}</p></div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{customers.map((customer) => <article className="border border-[var(--line)] bg-white p-5" key={customer.id}><div className="flex items-start justify-between gap-3"><div><small className="text-[var(--red)]">{customer.referenceNumber}</small><h3 className="mb-1 mt-1 text-lg">{customer.name}</h3></div><span className="rounded-full bg-[#edf5ed] px-2 py-1 text-xs font-bold text-[#356338]">{customer.isActive ? "Active" : "Inactive"}</span></div>{customer.contactPerson && <p className="mb-0 mt-3 text-sm"><strong>Contact:</strong> {customer.contactPerson}</p>}<p className="mb-0 mt-1 text-sm">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</p>{customer.address && <p className="mb-0 mt-3 text-sm text-[var(--muted)]">{customer.address}</p>}</article>)}</div>}
  </section>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`grid gap-2 text-sm font-bold text-[#4b4944] ${wide ? "md:col-span-2" : ""}`}>{label}<span className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded [&>input]:border [&>input]:border-[#cbc7bd] [&>input]:px-3 [&>textarea]:w-full [&>textarea]:rounded [&>textarea]:border [&>textarea]:border-[#cbc7bd] [&>textarea]:p-3">{children}</span></label>;
}

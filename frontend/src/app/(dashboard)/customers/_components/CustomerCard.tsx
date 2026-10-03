import { Plus } from "lucide-react";
import type { BaguioClient, CustomerAddressInput } from "../../../../types/channel-sale";
import { CustomerAddressForm } from "./CustomerAddressForm";

interface Props {
  customer: BaguioClient;
  addingAddress: boolean;
  submitting: boolean;
  onStartAddress?: () => void;
  onCancelAddress: () => void;
  onAddAddress?: (input: CustomerAddressInput) => Promise<void>;
}

export function CustomerCard({ customer, addingAddress, submitting, onStartAddress, onCancelAddress, onAddAddress }: Props) {
  return (
    <article className="border border-[var(--line)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <small className="text-[var(--red)]">{customer.referenceNumber}</small>
          <h3 className="mb-1 mt-1 text-lg">{customer.name}</h3>
        </div>
        <span className="rounded-full bg-[#edf5ed] px-2 py-1 text-xs font-bold text-[#356338]">
          {customer.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      {customer.contactPerson && <p className="mb-0 mt-3 text-sm"><strong>Contact:</strong> {customer.contactPerson}</p>}
      <p className="mb-0 mt-1 text-sm">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</p>
      <div className="mt-3 grid gap-2">
        {customer.addresses.map((address) => (
          <p className="m-0 text-sm text-[var(--muted)]" key={address.id}>
            <strong className="text-[#4b4944]">{address.label}{address.isDefault ? " (Default)" : ""}:</strong> {address.formattedAddress}
          </p>
        ))}
      </div>
      {onAddAddress && !addingAddress && (
        <button className="secondary-button mt-4" type="button" onClick={onStartAddress}>
          <Plus /> Add address
        </button>
      )}
      {onAddAddress && addingAddress && (
        <CustomerAddressForm
          customerName={customer.name}
          submitting={submitting}
          onCancel={onCancelAddress}
          onSubmit={onAddAddress}
        />
      )}
    </article>
  );
}

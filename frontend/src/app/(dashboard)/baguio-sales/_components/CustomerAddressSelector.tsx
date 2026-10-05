import { Check, MapPin } from "lucide-react";
import type { CustomerAddress } from "../../../../types/channel-sale";
import { getCustomerAddressOptions } from "../_lib/customer-address-options";

interface Props {
  addresses: CustomerAddress[];
  value: string;
  onChange: (addressId: string) => void;
}

export function CustomerAddressSelector({ addresses, value, onChange }: Props) {
  const options = getCustomerAddressOptions(addresses);

  return (
    <fieldset className="grid gap-2 md:col-span-2">
      <legend className="mb-2 text-sm font-bold text-[#4b4944]">Delivery address</legend>
      {options.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((address) => {
            const selected = address.id === value;
            return (
              <label
                className={`flex cursor-pointer gap-3 rounded border p-4 transition-colors focus-within:ring-2 focus-within:ring-[var(--red)] focus-within:ring-offset-2 ${selected ? "border-[var(--red)] bg-[#fff8f8]" : "border-[#cbc7bd] bg-white hover:border-[#99958d]"}`}
                key={address.id}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="customer-address"
                  required
                  checked={selected}
                  value={address.id}
                  onChange={() => onChange(address.id)}
                />
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${selected ? "border-[var(--red)] bg-[var(--red)] text-white" : "border-[#99958d] text-transparent"}`} aria-hidden="true">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-bold text-[#34322e]">
                    <MapPin className="size-4 shrink-0 text-[var(--red)]" aria-hidden="true" />
                    {address.label}
                    {address.isDefault && <span className="text-xs font-semibold text-[var(--muted)]">Default</span>}
                  </span>
                  <span className="mt-1 block text-sm font-normal leading-5 text-[var(--muted)]">{address.formattedAddress}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="m-0 rounded border border-dashed border-[#cbc7bd] p-4 text-sm font-normal text-[var(--muted)]">No saved addresses for this customer.</p>
      )}
    </fieldset>
  );
}

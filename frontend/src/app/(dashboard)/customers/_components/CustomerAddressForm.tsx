import { useState, type FormEvent } from "react";
import type { CustomerAddressInput } from "../../../../types/channel-sale";
import { emptyPhilippineAddress, PhilippineAddressFields } from "./PhilippineAddressFields";

interface Props {
  customerName: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: CustomerAddressInput) => Promise<void>;
}

export function CustomerAddressForm({ customerName, submitting, onCancel, onSubmit }: Props) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState(emptyPhilippineAddress);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ label, address });
  }

  return (
    <form className="mt-4 border-t border-[var(--line)] pt-4" onSubmit={(event) => void submit(event)}>
      <h4 className="m-0 font-serif text-lg">Add address for {customerName}</h4>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-[#4b4944] md:col-span-2">
          Address label
          <input className="h-11 rounded border border-[#cbc7bd] px-3" required maxLength={80} placeholder="e.g. Main office or Warehouse" value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <PhilippineAddressFields value={address} onChange={setAddress} />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button compact-button" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save address"}</button>
      </div>
    </form>
  );
}

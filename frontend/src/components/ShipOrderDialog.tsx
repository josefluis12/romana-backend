import { FormEvent, useState } from "react";
import { Truck, X } from "lucide-react";
import type { ShipmentInput } from "../types/order";

interface ShipOrderDialogProps {
  error: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (shipment: ShipmentInput) => Promise<boolean>;
}

export function ShipOrderDialog({ error, submitting, onClose, onSubmit }: ShipOrderDialogProps) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [dispatchNote, setDispatchNote] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const shipped = await onSubmit({
      carrier: carrier.trim(),
      trackingNumber: trackingNumber.trim(),
      dispatchNote: dispatchNote.trim(),
    });
    if (shipped) onClose();
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="ship-order-title">
      <form className="ship-order-dialog" onSubmit={(event) => void handleSubmit(event)}>
        <header>
          <div><small>Dispatch</small><h2 id="ship-order-title">Mark order as shipped</h2></div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close shipping form" title="Close"><X /></button>
        </header>
        <p>Enter the courier details printed on the package before confirming dispatch.</p>
        {error && <div className="alert" role="alert">{error}</div>}
        <label>
          Carrier or courier
          <input value={carrier} onChange={(event) => setCarrier(event.target.value)} minLength={2} maxLength={100} required autoFocus placeholder="Example: LBC Express" />
        </label>
        <label>
          Tracking number
          <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} minLength={2} maxLength={100} required autoComplete="off" placeholder="Enter the courier tracking number" />
        </label>
        <label>
          Dispatch note <small>Optional</small>
          <textarea value={dispatchNote} onChange={(event) => setDispatchNote(event.target.value)} maxLength={500} rows={3} placeholder="Pickup, handoff, or package notes" />
        </label>
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="primary-button compact-button" type="submit" disabled={submitting}>
            <Truck />{submitting ? "Marking shipped…" : "Confirm shipment"}
          </button>
        </div>
      </form>
    </div>
  );
}

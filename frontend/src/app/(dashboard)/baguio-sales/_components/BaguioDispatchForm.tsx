import { useState, type FormEvent } from "react";
import type { BaguioDispatchInput, DispatchDriver, InventoryLocation } from "../../../../types/channel-sale";

export function BaguioDispatchForm({ expectedReference, vehicles, drivers, submitting, onCancel, onSubmit }: {
  expectedReference: string;
  vehicles: InventoryLocation[]; drivers: DispatchDriver[]; submitting: boolean; onCancel: () => void;
  onSubmit: (input: BaguioDispatchInput) => Promise<void>;
}) {
  const [vanLocationId, setVanLocationId] = useState(vehicles[0]?.id || "");
  const [driverUserId, setDriverUserId] = useState(drivers[0]?.userId || "");
  const [notes, setNotes] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); void onSubmit({ vanLocationId, driverUserId, notes }); }
  return (
    <form className="mt-6 border border-[var(--line)] bg-white p-5 sm:p-8" onSubmit={submit}>
      <div className="flex flex-wrap justify-between gap-4 border-b border-[var(--line)] pb-5"><div><p className="m-0 text-xs font-bold uppercase text-[var(--red)]">New dispatch</p><h2 className="mt-1 font-serif text-2xl">Prepare a Baguio dispatch</h2><p className="mb-0 mt-2 text-sm text-[var(--muted)]">Expected dispatch ID: <strong className="text-[var(--ink)]">{expectedReference}</strong></p></div><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button></div>
      <label className="mt-6 grid gap-2 text-sm font-bold">Van<select className="h-11 rounded border border-[#cbc7bd] bg-white px-3" required value={vanLocationId} onChange={(event) => setVanLocationId(event.target.value)}><option value="">Choose a van</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.name}</option>)}</select></label>
      <label className="mt-5 grid gap-2 text-sm font-bold">Assigned driver<select className="h-11 rounded border border-[#cbc7bd] bg-white px-3" required value={driverUserId} onChange={(event) => setDriverUserId(event.target.value)}><option value="">Choose a driver account</option>{drivers.map((driver) => <option value={driver.userId} key={driver.userId}>{driver.name} · {driver.email}</option>)}</select></label>
      <label className="mt-5 grid gap-2 text-sm font-bold">Dispatch notes<textarea className="rounded border border-[#cbc7bd] p-3" rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {!drivers.length && <p className="mt-5 text-sm font-bold text-[var(--red)]">Create a driver account before preparing a dispatch.</p>}
      <div className="mt-7 flex justify-end"><button className="primary-button compact-button" disabled={submitting || !vanLocationId || !driverUserId}>{submitting ? "Creating…" : "Create dispatch"}</button></div>
    </form>
  );
}

import { useState, type FormEvent } from "react";
import type { DispatchDriverInput } from "../../../../types/channel-sale";

export function BaguioDriverForm({ submitting, onCancel, onSubmit }: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: DispatchDriverInput) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("demo.driver@romana.ph");
  const [temporaryPassword, setTemporaryPassword] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSubmit({ firstName, middleName, lastName, email, temporaryPassword });
  }

  return (
    <form className="mt-6 border border-[var(--line)] bg-white p-5 sm:p-8" onSubmit={submit}>
      <div className="flex flex-wrap justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div><p className="m-0 text-xs font-bold uppercase text-[var(--red)]">Driver account</p><h2 className="mt-1 font-serif text-2xl">Create a dispatch driver</h2></div>
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <p className="mt-5 text-sm text-[var(--muted)]">This account is restricted to dispatches assigned to it and cannot sign in to the admin portal.</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold">First name<input className="h-11 rounded border border-[#cbc7bd] px-3" required maxLength={100} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-bold"><span>Middle name <span className="font-normal text-[var(--muted)]">(optional)</span></span><input className="h-11 rounded border border-[#cbc7bd] px-3" maxLength={100} autoComplete="additional-name" value={middleName} onChange={(event) => setMiddleName(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-bold">Last name<input className="h-11 rounded border border-[#cbc7bd] px-3" required maxLength={100} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">Email<input className="h-11 rounded border border-[#cbc7bd] px-3" required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-bold">Temporary password<input className="h-11 rounded border border-[#cbc7bd] px-3" required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /><small className="font-normal text-[var(--muted)]">Use at least 12 characters and share it securely with the driver.</small></label>
      </div>
      <div className="mt-7 flex justify-end"><button className="primary-button compact-button" disabled={submitting}>{submitting ? "Creating…" : "Create driver account"}</button></div>
    </form>
  );
}

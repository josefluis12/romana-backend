import { useState, type FormEvent, type ReactNode } from "react";
import type { CreateSystemUserInput, SystemUserRole } from "../../../../types/system-user";

export function SystemUserForm({ submitting, onCancel, onSubmit }: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateSystemUserInput) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SystemUserRole>("dispatch_driver");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [validationError, setValidationError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      setValidationError("The password confirmation does not match.");
      return;
    }
    setValidationError("");
    void onSubmit({ firstName, middleName, lastName, email, role, password, passwordConfirmation });
  }

  return (
    <form className="mt-6 border border-[var(--line)] bg-white p-5 sm:p-8" onSubmit={submit}>
      <div className="flex flex-wrap justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div><p className="m-0 text-xs font-bold uppercase text-[var(--red)]">System access</p><h2 className="mt-1 font-serif text-2xl">Add a user</h2></div>
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <p className="mt-5 text-sm text-[var(--muted)]">Administrators can use this portal. Dispatch drivers can only access dispatches assigned to them.</p>
      {validationError && <div className="alert" role="alert">{validationError}</div>}
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Field label="First name"><input className={inputClass} required maxLength={100} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></Field>
        <Field label="Middle name (optional)"><input className={inputClass} maxLength={100} autoComplete="additional-name" value={middleName} onChange={(event) => setMiddleName(event.target.value)} /></Field>
        <Field label="Last name"><input className={inputClass} required maxLength={100} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></Field>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Email"><input className={inputClass} required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label="Role"><select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as SystemUserRole)}><option value="administrator">Administrator</option><option value="dispatch_driver">Dispatch driver</option></select></Field>
        <Field label="Password"><input className={inputClass} required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><small className="font-normal text-[var(--muted)]">Use at least 12 characters.</small></Field>
        <Field label="Confirm password"><input className={inputClass} required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></Field>
      </div>
      <div className="mt-7 flex justify-end"><button className="primary-button compact-button" disabled={submitting}>{submitting ? "Creating…" : "Create user"}</button></div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold"><span>{label}</span>{children}</label>;
}

const inputClass = "h-11 rounded border border-[#cbc7bd] bg-white px-3";

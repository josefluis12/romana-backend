import { useEffect, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { createSystemUser, listSystemUsers } from "../../../services/system-users";
import type { CreateSystemUserInput, SystemUser, SystemUserRole } from "../../../types/system-user";
import { SystemUserForm } from "./_components/SystemUserForm";

export function SystemUsersPage({ csrfToken }: { csrfToken: string }) {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listSystemUsers()
      .then(setUsers)
      .catch((cause: unknown) => setError(messageFor(cause)))
      .finally(() => setLoading(false));
  }, []);

  async function create(input: CreateSystemUserInput) {
    setSubmitting(true);
    setError("");
    try {
      const user = await createSystemUser(input, csrfToken);
      setUsers((current) => [...current, user].sort((left, right) => left.name.localeCompare(right.name)));
      setShowForm(false);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="catalog-status" role="status">Loading system users…</div>;
  if (showForm) return <><ErrorMessage value={error} /><SystemUserForm submitting={submitting} onCancel={() => setShowForm(false)} onSubmit={create} /></>;

  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        <p className="m-0 text-sm text-[var(--muted)]">Manage the people who can access Romana systems and their assigned role.</p>
        <button className="primary-button compact-button" type="button" onClick={() => setShowForm(true)}><UserPlus />Add user</button>
      </div>
      <ErrorMessage value={error} />
      {!users.length ? (
        <div className="empty-state"><Users /><h2>No managed users yet</h2><p>Add an administrator or dispatch driver to get started.</p></div>
      ) : (
        <div className="mt-6 overflow-hidden border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-5 py-3 text-xs font-bold uppercase text-[var(--muted)]">{users.length} user{users.length === 1 ? "" : "s"}</div>
          <div className="divide-y divide-[var(--line)]">
            {users.map((user) => <UserRow user={user} key={user.userId} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function UserRow({ user }: { user: SystemUser }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0"><strong className="block">{user.name}</strong><span className="mt-1 block truncate text-sm text-[var(--muted)]">{user.email}</span></div>
      <span className="rounded-full bg-[#f7e5e5] px-3 py-2 text-xs font-bold uppercase text-[var(--red)]">{roleLabel(user.role)}</span>
    </article>
  );
}

function roleLabel(role: SystemUserRole): string {
  return role === "administrator" ? "Administrator" : "Dispatch driver";
}

function ErrorMessage({ value }: { value: string }) { return value ? <div className="alert" role="alert">{value}</div> : null; }
function messageFor(cause: unknown): string { return cause instanceof Error ? cause.message : "System users are unavailable."; }

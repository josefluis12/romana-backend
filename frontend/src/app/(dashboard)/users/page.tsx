import { useEffect, useState } from "react";
import { Eye, UserPlus, Users } from "lucide-react";
import { createSystemUser, getSystemUserProfile, listSystemUsers } from "../../../services/system-users";
import type { CreateSystemUserInput, SystemUser, SystemUserProfile, SystemUserRole } from "../../../types/system-user";
import { SystemUserForm } from "./_components/SystemUserForm";
import { SystemUserProfileDialog } from "./_components/SystemUserProfileDialog";

export function SystemUsersPage({ csrfToken }: { csrfToken: string }) {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [profile, setProfile] = useState<SystemUserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

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

  async function viewProfile(user: SystemUser) {
    setSelectedUser(user);
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    try {
      setProfile(await getSystemUserProfile(user.userId));
    } catch (cause) {
      setProfileError(messageFor(cause));
    } finally {
      setProfileLoading(false);
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
            {users.map((user) => <UserRow user={user} key={user.userId} onView={() => void viewProfile(user)} />)}
          </div>
        </div>
      )}
      {selectedUser ? <SystemUserProfileDialog summary={selectedUser} profile={profile} loading={profileLoading} error={profileError} onClose={() => setSelectedUser(null)} /> : null}
    </section>
  );
}

function UserRow({ user, onView }: { user: SystemUser; onView: () => void }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0"><strong className="block">{user.name}</strong><span className="mt-1 block truncate text-sm text-[var(--muted)]">{user.email}</span></div>
      <div className="flex items-center gap-3"><span className="rounded-full bg-[#f7e5e5] px-3 py-2 text-xs font-bold uppercase text-[var(--red)]">{roleLabel(user.role)}</span><button className="flex h-10 items-center gap-2 rounded border border-[#cbc7bd] bg-white px-3 text-xs font-bold text-[#4b4944] hover:border-[#9b978f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--red)]" type="button" onClick={onView}><Eye className="size-4" />View profile</button></div>
    </article>
  );
}

function roleLabel(role: SystemUserRole): string {
  return role === "administrator" ? "Administrator" : "Dispatch driver";
}

function ErrorMessage({ value }: { value: string }) { return value ? <div className="alert" role="alert">{value}</div> : null; }
function messageFor(cause: unknown): string { return cause instanceof Error ? cause.message : "System users are unavailable."; }

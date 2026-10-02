import { useEffect, useState } from "react";
import { Clock3, History, Mail, ShieldCheck, UserRound, X } from "lucide-react";
import type { SystemUser, SystemUserLog, SystemUserProfile, SystemUserRole } from "../../../../types/system-user";

type ProfileTab = "profile" | "logs";

interface SystemUserProfileDialogProps {
  summary: SystemUser;
  profile: SystemUserProfile | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}

export function SystemUserProfileDialog(props: SystemUserProfileDialogProps) {
  const { summary, profile, loading, error, onClose } = props;
  const [tab, setTab] = useState<ProfileTab>("profile");

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full max-w-2xl border border-[var(--line)] bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="system-user-profile-title">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f7e5e5] font-serif text-xl text-[var(--red)]">{summary.name.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0"><p className="m-0 text-xs font-bold uppercase text-[var(--red)]">System user</p><h2 className="mt-1 truncate font-serif text-2xl" id="system-user-profile-title">{summary.name}</h2></div>
          </div>
          <button className="grid size-10 shrink-0 place-items-center rounded border border-[var(--line)] bg-white hover:bg-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--red)]" type="button" onClick={onClose} aria-label="Close user profile" title="Close"><X className="size-5" /></button>
        </header>
        <div className="flex border-b border-[var(--line)] px-5 sm:px-6" role="tablist" aria-label="User details">
          <TabButton active={tab === "profile"} icon={<UserRound />} label="Profile" onClick={() => setTab("profile")} />
          <TabButton active={tab === "logs"} icon={<History />} label={`Logs${profile ? ` (${profile.logs.length})` : ""}`} onClick={() => setTab("logs")} />
        </div>
        <div className="max-h-[65vh] min-h-72 overflow-y-auto p-5 sm:p-6">
          {loading ? <div className="grid min-h-56 place-items-center text-sm text-[var(--muted)]" role="status">Loading user profile…</div> : null}
          {!loading && error ? <div className="alert" role="alert">{error}</div> : null}
          {!loading && profile && tab === "profile" ? <ProfileDetails profile={profile} /> : null}
          {!loading && profile && tab === "logs" ? <ActivityLogs logs={profile.logs} /> : null}
        </div>
      </section>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-bold ${active ? "border-[var(--red)] text-[var(--red)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`} type="button" role="tab" aria-selected={active} onClick={onClick}><span className="[&>svg]:size-4">{icon}</span>{label}</button>;
}

function ProfileDetails({ profile }: { profile: SystemUserProfile }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <Detail icon={<UserRound />} label="Full name" value={profile.name} />
    <Detail icon={<ShieldCheck />} label="Role" value={roleLabel(profile.role)} />
    <Detail icon={<Mail />} label="Email address" value={profile.email} />
    <Detail icon={<Clock3 />} label="Account created" value={formatDate(profile.createdAt)} />
    <Detail icon={<Clock3 />} label="Last sign-in" value={profile.lastSignInAt ? formatDate(profile.lastSignInAt) : "No sign-in recorded"} />
    <Detail icon={<UserRound />} label="User ID" value={profile.userId} compact />
  </div>;
}

function Detail({ icon, label, value, compact = false }: { icon: React.ReactNode; label: string; value: string; compact?: boolean }) {
  return <div className="min-w-0 border border-[var(--line)] bg-[var(--paper)] p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--muted)]"><span className="text-[var(--red)] [&>svg]:size-4">{icon}</span>{label}</div><p className={`mb-0 mt-2 break-words ${compact ? "font-mono text-xs" : "text-sm font-bold"}`}>{value}</p></div>;
}

function ActivityLogs({ logs }: { logs: SystemUserLog[] }) {
  if (!logs.length) return <div className="grid min-h-56 place-items-center text-center"><div><History className="mx-auto size-8 text-[var(--muted)]" /><h3 className="mt-3 text-base">No activity recorded</h3><p className="mt-1 text-sm text-[var(--muted)]">Actions performed by this user will appear here.</p></div></div>;
  return <ol className="m-0 grid list-none gap-0 p-0">{logs.map((log) => <li className="grid grid-cols-[12px_1fr] gap-3" key={`${log.category}-${log.id}`}><span className="mt-1.5 size-2.5 rounded-full border-2 border-[var(--red)] bg-white" /><div className="border-b border-[var(--line)] pb-4 [&:not(:first-child)]:pt-0"><strong className="block text-sm">{logLabel(log)}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{sourceLabel(log)} · {log.referenceNumber}</span><time className="mt-1 block text-xs text-[var(--muted)]" dateTime={log.createdAt}>{formatDate(log.createdAt)}</time></div></li>)}</ol>;
}

function logLabel(log: SystemUserLog): string {
  const action = log.action.replaceAll("_", " ");
  return `${action.slice(0, 1).toUpperCase()}${action.slice(1)}`;
}

function sourceLabel(log: SystemUserLog): string {
  return log.category === "online_order" ? "Online order" : "Baguio sale";
}

function roleLabel(role: SystemUserRole): string {
  return role === "administrator" ? "Administrator" : "Dispatch driver";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

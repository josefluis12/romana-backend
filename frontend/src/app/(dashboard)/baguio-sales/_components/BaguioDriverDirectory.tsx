import { UserPlus, Users } from "lucide-react";
import type { DispatchDriver } from "../../../../types/channel-sale";

export function BaguioDriverDirectory({ drivers }: { drivers: DispatchDriver[] }) {
  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div><p className="m-0 text-xs font-bold uppercase text-[var(--red)]">Baguio Sales</p><h2 className="mb-0 mt-1 font-serif text-3xl">Drivers</h2></div>
        <a className="primary-button compact-button no-underline" href="#baguio-sales/new-driver"><UserPlus />New driver</a>
      </div>
      {!drivers.length ? (
        <div className="empty-state"><Users /><h2>No driver accounts yet</h2><p>Create a driver account before preparing a dispatch.</p></div>
      ) : (
        <div className="mt-6 overflow-hidden border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-5 py-3 text-xs font-bold uppercase text-[var(--muted)]">{drivers.length} driver{drivers.length === 1 ? "" : "s"}</div>
          <div className="divide-y divide-[var(--line)]">
            {drivers.map((driver) => (
              <article className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={driver.userId}>
                <div className="min-w-0"><strong className="block">{driver.name}</strong><span className="mt-1 block truncate text-sm text-[var(--muted)]">{driver.email}</span></div>
                <span className="rounded-full bg-[#f7e5e5] px-3 py-2 text-xs font-bold uppercase text-[var(--red)]">Dispatch driver</span>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

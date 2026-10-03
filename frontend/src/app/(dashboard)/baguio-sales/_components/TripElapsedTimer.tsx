import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { formatTripElapsed } from "../_lib/trip-elapsed";

const departureDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });

export function TripElapsedTimer({ departedAt }: { departedAt: string | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!departedAt) return <span className="text-xs font-bold text-[var(--muted)]">Departure time unavailable</span>;
  const started = new Date(departedAt);
  if (Number.isNaN(started.getTime())) {
    return <span className="text-xs font-bold text-[var(--muted)]">Departure time unavailable</span>;
  }

  return (
    <div className="flex w-full items-center gap-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800 sm:w-auto" role="timer" aria-label={`Trip running for ${formatTripElapsed(departedAt, now)}`}>
      <Clock3 className="size-4 shrink-0" aria-hidden="true" />
      <span className="grid leading-tight">
        <strong className="font-mono text-sm tabular-nums">{formatTripElapsed(departedAt, now)}</strong>
        <small className="text-[10px]">Started {departureDate.format(started)}</small>
      </span>
    </div>
  );
}

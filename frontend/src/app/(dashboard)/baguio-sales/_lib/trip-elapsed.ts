export function formatTripElapsed(departedAt: string, now: number): string {
  const departureTime = new Date(departedAt).getTime();
  if (!Number.isFinite(departureTime)) return "--:--:--";
  const elapsedSeconds = Math.max(0, Math.floor((now - departureTime) / 1_000));
  const hours = Math.floor(elapsedSeconds / 3_600);
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60);
  const seconds = elapsedSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

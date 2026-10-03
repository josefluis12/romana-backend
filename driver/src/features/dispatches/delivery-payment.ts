export function parseCollectedAmount(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return amount > 0 && amount <= 1_000_000_000 ? amount : null;
}

import type { BaguioDispatch } from "../../../../types/channel-sale";

const dispatchReferencePattern = /^DSP-(\d+)$/;

export function getExpectedDispatchReference(dispatches: BaguioDispatch[]): string {
  const highestSequence = dispatches.reduce((highest, dispatch) => {
    const match = dispatchReferencePattern.exec(dispatch.referenceNumber);
    if (!match) return highest;
    const sequence = Number(match[1]);
    return Number.isSafeInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);

  return `DSP-${String(highestSequence + 1).padStart(6, "0")}`;
}

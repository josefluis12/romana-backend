import type { SignaturePoint } from "../../types/dispatch";

export function getCompleteSignatureStrokes(strokes: SignaturePoint[][]): SignaturePoint[][] {
  return strokes.filter((stroke) => stroke.length >= 2);
}

export interface SignaturePoint {
  x: number;
  y: number;
}

export const signaturePreviewSize = {
  width: 384,
  height: 190,
} as const;

const inset = 0.08;

export function fitSignatureToPreview(strokes: SignaturePoint[][]): SignaturePoint[][] {
  const points = strokes.flat();
  if (!points.length) return strokes;

  const bounds = getSignatureBounds(points);
  const drawingWidth = bounds.width * signaturePreviewSize.width;
  const drawingHeight = bounds.height * signaturePreviewSize.height;
  const availableWidth = signaturePreviewSize.width * (1 - inset * 2);
  const availableHeight = signaturePreviewSize.height * (1 - inset * 2);
  const scale = getFitScale(drawingWidth, drawingHeight, availableWidth, availableHeight);

  return strokes.map((stroke) => stroke.map((point) => ({
    x: centerCoordinate(
      point.x * signaturePreviewSize.width,
      bounds.centerX * signaturePreviewSize.width,
      signaturePreviewSize.width,
      scale,
    ),
    y: centerCoordinate(
      point.y * signaturePreviewSize.height,
      bounds.centerY * signaturePreviewSize.height,
      signaturePreviewSize.height,
      scale,
    ),
  })));
}

function getSignatureBounds(points: SignaturePoint[]) {
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  return {
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function getFitScale(drawingWidth: number, drawingHeight: number, availableWidth: number, availableHeight: number): number {
  const widthScale = drawingWidth > 0 ? availableWidth / drawingWidth : Number.POSITIVE_INFINITY;
  const heightScale = drawingHeight > 0 ? availableHeight / drawingHeight : Number.POSITIVE_INFINITY;
  const scale = Math.min(widthScale, heightScale);
  return Number.isFinite(scale) ? scale : 1;
}

function centerCoordinate(value: number, sourceCenter: number, previewLength: number, scale: number): number {
  const centered = ((value - sourceCenter) * scale + previewLength / 2) / previewLength;
  return Number(centered.toFixed(6));
}

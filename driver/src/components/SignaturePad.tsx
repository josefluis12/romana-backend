import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { SignaturePoint } from "../types/dispatch";
import { colors, fonts } from "../styles/theme";

interface SignaturePadProps {
  strokes: SignaturePoint[][];
  onChange(strokes: SignaturePoint[][]): void;
  onSigningChange?(isSigning: boolean): void;
}

const PAD_HEIGHT = 190;
const MAX_POINTS = 400;

export function SignaturePad({ strokes, onChange, onSigningChange }: SignaturePadProps) {
  const [width, setWidth] = useState(1);
  const strokesRef = useRef(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const appendPoint = (x: number, y: number) => {
    const current = strokesRef.current;
    const totalPoints = current.reduce((count, stroke) => count + stroke.length, 0);
    if (totalPoints >= MAX_POINTS) return;
    const point = normalizePoint(x, y, width);
    const lastStroke = current[current.length - 1];
    const previous = lastStroke?.[lastStroke.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.006) return;
    const next = [...current.slice(0, -1), [...(lastStroke ?? []), point]];
    strokesRef.current = next;
    onChange(next);
  };

  const startStroke = (event: GestureResponderEvent) => {
    onSigningChange?.(true);
    const pointCount = strokesRef.current.reduce((count, stroke) => count + stroke.length, 0);
    if (pointCount >= MAX_POINTS || strokesRef.current.length >= 20) return;
    const point = normalizePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, width);
    const next = [...strokesRef.current, [point]];
    strokesRef.current = next;
    onChange(next);
  };

  const finishStroke = () => {
    onSigningChange?.(false);
    const current = strokesRef.current;
    if ((current[current.length - 1]?.length ?? 0) >= 2) return;
    const next = current.slice(0, -1);
    strokesRef.current = next;
    onChange(next);
  };

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width || 1);

  return (
    <View
      onLayout={handleLayout}
      onMoveShouldSetResponderCapture={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={startStroke}
      onResponderMove={(event) => appendPoint(event.nativeEvent.locationX, event.nativeEvent.locationY)}
      onResponderRelease={finishStroke}
      onResponderTerminate={finishStroke}
      onStartShouldSetResponderCapture={() => true}
      onStartShouldSetResponder={() => true}
      style={styles.pad}
    >
      {strokes.length === 0 && <Text style={styles.hint}>Sign inside this box</Text>}
      <Svg height={PAD_HEIGHT} style={styles.canvas} width="100%" viewBox={`0 0 ${width} ${PAD_HEIGHT}`}>
        {strokes.map((stroke, index) => (
          <Path
            d={stroke.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x * width} ${point.y * PAD_HEIGHT}`).join(" ")}
            fill="none"
            key={index}
            stroke={colors.text}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
          />
        ))}
      </Svg>
    </View>
  );
}

function normalizePoint(x: number, y: number, width: number): SignaturePoint {
  return {
    x: Number(Math.max(0, Math.min(1, x / width)).toFixed(4)),
    y: Number(Math.max(0, Math.min(1, y / PAD_HEIGHT)).toFixed(4)),
  };
}

const styles = StyleSheet.create({
  canvas: { pointerEvents: "none" },
  pad: {
    height: PAD_HEIGHT,
    overflow: "hidden",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    touchAction: "none",
  },
  hint: { position: "absolute", alignSelf: "center", color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
});

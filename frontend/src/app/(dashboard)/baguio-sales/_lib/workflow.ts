import type { ChannelSaleStatus } from "../../../../types/channel-sale";

export const baguioSaleSteps: Array<{
  status: Exclude<ChannelSaleStatus, "cancelled">;
  label: string;
}> = [
  { status: "draft", label: "Order created" },
  { status: "pending_approval", label: "Awaiting approval" },
  { status: "approved", label: "Approved" },
  { status: "loaded", label: "Van loaded" },
  { status: "in_transit", label: "In transit" },
  { status: "delivered", label: "Delivered" },
  { status: "successful", label: "Completed" },
];

export const baguioSaleProgressStages = [
  "Approval",
  "Loading",
  "Delivery",
  "Complete",
] as const;

export function getBaguioSaleStatusLabel(status: ChannelSaleStatus): string {
  const step = baguioSaleSteps.find((candidate) => candidate.status === status);
  if (step) return step.label;
  return "Cancelled";
}

export function getBaguioSaleProgressStage(status: ChannelSaleStatus): number {
  if (["draft", "pending_approval", "approved"].includes(status)) return 0;
  if (status === "loaded") return 1;
  if (["in_transit", "delivered"].includes(status)) return 2;
  if (status === "successful") return 3;
  return -1;
}

import { StatusBadge } from "./ui";
import type { CodeState } from "@/server/payments/promo";

const STATE: Record<CodeState, { status: string; label: string }> = {
  active: { status: "ACTIVE", label: "Active" },
  scheduled: { status: "PENDING", label: "Scheduled" },
  ended: { status: "CANCELLED", label: "Ended" },
  off: { status: "DISABLED", label: "Off" },
  used_up: { status: "COMPLETED", label: "Used up" },
};

export function CodeStateBadge({ state }: { state: CodeState }) {
  return <StatusBadge status={STATE[state].status} label={STATE[state].label} />;
}

export const planScope = (plans: string[]) =>
  plans.length === 0 || plans.length === 2 ? "Both plans" : plans[0] === "PREMIUM" ? "Premium only" : "Standard only";

import type { SendingMode } from "@/lib/marketing/links";
import { whatsappOff } from "@/server/whatsapp";

/** Marketing pages describe sending the way this deployment actually sends (see sending-mode.ts). */
export function sendingMode(): SendingMode {
  return whatsappOff() ? "own" : "cloud";
}

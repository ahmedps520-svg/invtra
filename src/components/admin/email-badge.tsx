import { verificationOf } from "@/lib/auth/verification";
import { StatusBadge } from "./ui";
import { day } from "./format";

type User = { role: string; emailVerifiedAt: Date | null; verifyBy: Date | null; createdAt: Date };

/** Whether the account's email is verified, how long it has left, or that it's locked for it. */
export function EmailBadge({ user, className }: { user: User; className?: string }) {
  const v = verificationOf(user);
  if (v.verified) return <StatusBadge status="PAID" label="Email verified" className={className} />;
  if (v.locked) return <StatusBadge status="FAILED" label="Locked: email not verified" className={className} />;
  return <StatusBadge status="PENDING" label={`Unverified · by ${day(v.deadline)}`} className={className} />;
}

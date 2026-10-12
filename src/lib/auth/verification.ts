/** Email verification state, shared by the server guards and the dashboard banner. */

export const VERIFY_DAYS = 5;

/** Browser storage key: the day the reminder popup was last shown (one popup a day). */
export const VERIFY_REMINDER_KEY = "invtra:verify-reminder";
export const todayKey = () => new Date().toISOString().slice(0, 10);
const DAY = 24 * 3600_000;

type VerifyFields = { role: string; emailVerifiedAt: Date | null; verifyBy: Date | null; createdAt: Date };

export type Verification =
  | { verified: true }
  | {
      verified: false;
      /** When the account is deactivated (ISO). */
      deadline: string;
      /** Whole days left, rounded up (0 once deactivated). */
      daysLeft: number;
      locked: boolean;
    };

/** The deadline for a new account. */
export function newAccountDeadline(now = new Date()) {
  return new Date(now.getTime() + VERIFY_DAYS * DAY);
}

export function verificationOf(user: VerifyFields, now = new Date()): Verification {
  if (user.emailVerifiedAt) return { verified: true };
  const deadline = user.verifyBy ?? new Date(user.createdAt.getTime() + VERIFY_DAYS * DAY);
  const left = deadline.getTime() - now.getTime();
  return {
    verified: false,
    deadline: deadline.toISOString(),
    daysLeft: Math.max(0, Math.ceil(left / DAY)),
    // Staff accounts are never locked out.
    locked: left <= 0 && user.role !== "ADMIN",
  };
}

/** Unverified past the deadline: signed in, but limited to the verification page. */
export function isLocked(user: VerifyFields, now = new Date()) {
  const v = verificationOf(user, now);
  return !v.verified && v.locked;
}

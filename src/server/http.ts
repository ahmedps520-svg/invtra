import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { Prisma } from "@prisma/client";
import { getSessionUser, type SessionUser } from "@/server/auth/session";
import { logError } from "@/server/log";

/**
 * Route-handler plumbing shared by every /api endpoint:
 *   - typed HttpError → JSON error envelope { error: { code, message, fields? } }
 *   - zod validation errors → 422 with per-field messages
 *   - unexpected errors → 500 (logged, details never leaked)
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public fields?: Record<string, string>,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code = "bad_request", message?: string, fields?: Record<string, string>) =>
  new HttpError(400, code, message, fields);
export const unauthorized = () => new HttpError(401, "unauthorized", "Please sign in to continue.");
export const forbidden = (message = "You don't have access to this.") => new HttpError(403, "forbidden", message);
export const notFound = (what = "Resource") => new HttpError(404, "not_found", `${what} not found.`);
export const conflict = (code = "conflict", message?: string) => new HttpError(409, code, message);
export const tooManyRequests = () => new HttpError(429, "rate_limited", "Too many requests. Please wait a moment.");

export function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

export function route<C = { params: Promise<Record<string, string>> }>(source: string, handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(source, err, req);
    }
  };
}

export async function errorResponse(source: string, err: unknown, req?: NextRequest): Promise<NextResponse> {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, fields: err.fields } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Please check the highlighted fields.", fields: zodFields(err) } },
      { status: 422 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });
    if (err.code === "P2002")
      return NextResponse.json({ error: { code: "duplicate", message: "This already exists." } }, { status: 409 });
  }
  await logError(`api:${source}`, err, req ? { method: req.method, path: req.nextUrl.pathname } : undefined);
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong." } }, { status: 500 });
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("invalid_json", "Request body must be JSON.");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (user.role !== "ADMIN") throw forbidden();
  return user;
}

/** Best-effort client IP (first hop of X-Forwarded-For set by the platform's proxy). */
export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export const ok = (data: unknown = { ok: true }, init?: ResponseInit) => NextResponse.json(data, init);

import { ExternalLink, ImageIcon, Reply } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewButton = { type: "QUICK_REPLY" | "URL"; text: string };

/** Render "{guest_name}" placeholders as chips. */
function BodyWithVariables({ text }: { text: string }) {
  const parts = text.split(/(\{[a-z_0-9]+\})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{[a-z_0-9]+\}$/.test(p) ? (
          <span key={i} dir="ltr" className="mx-0.5 inline-block rounded-md bg-bronze-100 px-1.5 py-px font-sans text-[12px] font-medium text-bronze-800">
            {p.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/**
 * WhatsApp-style bubble showing how a template reads (header, body with named
 * variables, footer, buttons). Hook-free, so it renders on the server or the client.
 */
export function TemplatePreview({
  headerType,
  namedBody,
  footer,
  buttons,
  className,
}: {
  headerType: string;
  namedBody: string;
  footer?: string | null;
  buttons: PreviewButton[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-[#efe8dd] p-3 paper-grain", className)}>
      <div className="max-w-[340px] overflow-hidden rounded-xl rounded-ss-sm bg-paper shadow-soft">
        {headerType === "IMAGE" ? (
          <div className="m-1 flex h-28 items-center justify-center gap-2 rounded-lg bg-bronze-50 text-[12px] text-bronze-600">
            <ImageIcon className="size-4" aria-hidden="true" /> Invitation image
          </div>
        ) : null}
        <div className="px-3 pb-2 pt-2">
          <p dir="auto" className="whitespace-pre-line break-words text-[13.5px] leading-relaxed text-ink">
            <BodyWithVariables text={namedBody || " "} />
          </p>
          {footer ? (
            <p dir="auto" className="mt-1.5 text-[12px] text-ink-faint">
              {footer}
            </p>
          ) : null}
        </div>
        {buttons.length ? (
          <div className="divide-y divide-line border-t border-line">
            {buttons.map((b, i) => (
              <div key={i} dir="auto" className="flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-bronze-700">
                {b.type === "URL" ? <ExternalLink className="size-3.5" aria-hidden="true" /> : <Reply className="size-3.5" aria-hidden="true" />}
                {b.text || "…"}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

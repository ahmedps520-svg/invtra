import nodemailer from "nodemailer";
import { env } from "@/server/env";

/** Transactional email. Development logs to the console; production uses SMTP. */
export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string }) {
  const e = env();
  if (e.EMAIL_PROVIDER === "console") {
    console.log(`\n[invtra:email] To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
    return;
  }
  const transport = nodemailer.createTransport(e.SMTP_URL!);
  await transport.sendMail({ from: e.EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
}

export function emailLayout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:Helvetica,Arial,sans-serif;color:#1e1a16">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fffdfa;border:1px solid #e6ddd0;border-radius:16px">
<tr><td style="padding:36px 40px 8px;font-size:13px;letter-spacing:6px;color:#84664a">INVTRA</td></tr>
<tr><td style="padding:8px 40px 0;font-size:24px;font-family:Georgia,serif">${title}</td></tr>
<tr><td style="padding:16px 40px 36px;font-size:15px;line-height:1.6;color:#57504a">${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

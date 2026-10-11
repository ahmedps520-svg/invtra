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

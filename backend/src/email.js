import nodemailer from "nodemailer";

const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
const transport = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: +(process.env.SMTP_PORT || 587),
      secure: +(process.env.SMTP_PORT || 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
  : null;

const shell = (title, body) => `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#172033"><div style="max-width:620px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden"><div style="padding:28px 32px;background:#071a3d;color:#fff"><div style="font-size:20px;font-weight:800;letter-spacing:1px">UNIFORM <span style="color:#d1a342">KINGS</span></div><div style="color:#dbe4f2;margin-top:5px">Quality uniforms. Confident futures.</div></div><div style="padding:32px;line-height:1.65">${body}</div><div style="padding:18px 32px;color:#6b7585;background:#f8f9fb;font-size:12px">Uniform Kings · Secure customer service</div></div></body></html>`;

export async function sendEmail({ to, subject, html }) {
  if (!transport) {
    console.log(`[email not sent - configure SMTP] ${to}: ${subject}`);
    return false;
  }
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
  return true;
}

export const welcomeEmail = (name) => shell("Welcome", `<h1 style="color:#071a3d">Welcome, ${name}.</h1><p>Your Uniform Kings account is ready. You can now shop faster, keep your order history together and check out with confidence.</p><p style="margin-top:24px"><a href="${process.env.FRONTEND_URL}" style="display:inline-block;padding:12px 18px;background:#071a3d;color:#fff;text-decoration:none;border-radius:7px;font-weight:bold">Start shopping</a></p>`);
export const resetEmail = (name, url) => shell("Reset password", `<h1 style="color:#071a3d">Reset your password</h1><p>Hello ${name}, use the button below to choose a new password. This secure link expires in 30 minutes.</p><p style="margin-top:24px"><a href="${url}" style="display:inline-block;padding:12px 18px;background:#071a3d;color:#fff;text-decoration:none;border-radius:7px;font-weight:bold">Reset password</a></p><p style="font-size:13px;color:#667085">If you did not request this, you can safely ignore this email.</p>`);

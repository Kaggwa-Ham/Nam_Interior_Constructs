// Outbound email. Uses SMTP so it works with Resend, SendGrid, Mailgun,
// Gmail, Zoho, cPanel — anything. When MAIL_ENABLED is false every send is
// logged instead, so local development needs no mail credentials.

import nodemailer from 'nodemailer';
import config from '../config.js';

let transporter = null;
let transportChecked = false;

function getTransporter() {
  if (transportChecked) return transporter;
  transportChecked = true;

  if (!config.mail.enabled) return null;
  if (!config.mail.host) {
    console.warn('[mail] MAIL_ENABLED is true but SMTP_HOST is empty — email disabled.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    // Fail fast rather than hanging the HTTP request.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

/// Verifies SMTP credentials. Called at boot so misconfiguration is obvious.
export async function verifyMailTransport() {
  const t = getTransporter();
  if (!t) return { enabled: false };
  try {
    await t.verify();
    console.log(`[mail] SMTP ready → ${config.mail.host}:${config.mail.port}`);
    return { enabled: true, ok: true };
  } catch (error) {
    console.error(`[mail] SMTP verification failed: ${error.message}`);
    return { enabled: true, ok: false, error: error.message };
  }
}

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/// Sends an email, swallowing transport errors so a mail outage can never
/// fail a customer's form submission. Returns true when actually delivered.
export async function sendMail({ subject, html, text, to, replyTo }) {
  const t = getTransporter();
  const recipient = to || config.mail.to;

  if (!t) {
    console.log(`[mail:disabled] "${subject}" → ${recipient}`);
    return false;
  }
  if (!recipient) {
    console.warn('[mail] No recipient configured (MAIL_TO); skipping.');
    return false;
  }

  try {
    await t.sendMail({
      from: config.mail.from,
      to: recipient,
      replyTo,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('[mail] Send failed:', error.message);
    return false;
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

const row = (label, value) =>
  value
    ? `<tr>
         <td style="padding:7px 14px 7px 0;color:#7b7169;font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
         <td style="padding:7px 0;color:#1c1917;font-size:14px;font-weight:500">${escapeHtml(value)}</td>
       </tr>`
    : '';

/// Wraps content in the branded shell shared by all outgoing mail.
function shell(title, innerHtml) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e7e1d9">
    <div style="background:#1c1917;padding:22px 26px">
      <div style="color:#c8a45c;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:600">Nam Interior Constructs</div>
      <div style="color:#fff;font-size:21px;margin-top:5px;font-weight:600">${escapeHtml(title)}</div>
    </div>
    <div style="padding:26px">${innerHtml}</div>
    <div style="padding:16px 26px;background:#faf8f5;border-top:1px solid #eee8e0;color:#8a8079;font-size:12px">
      Sent automatically from ${escapeHtml(config.publicUrl)}
    </div>
  </div>
</body></html>`;
}

export function leadNotificationEmail(lead) {
  const money = lead.budgetRange || '—';
  const html = shell(
    'New enquiry from your website',
    `<p style="margin:0 0 18px;color:#443d38;font-size:15px;line-height:1.6">
       <strong>${escapeHtml(lead.name)}</strong> submitted a ${
         lead.type === 'QUOTE' ? 'quote request' : 'message'
       }.
     </p>
     <table style="width:100%;border-collapse:collapse;margin-bottom:22px">
       ${row('Name', lead.name)}
       ${row('Email', lead.email)}
       ${row('Phone', lead.phone)}
       ${row('Location', lead.location)}
       ${row('Service', lead.service?.title)}
       ${row('Project type', lead.projectType)}
       ${row('Budget', money)}
       ${row('Timeline', lead.timeline)}
       ${row('Received', new Date(lead.createdAt).toLocaleString('en-GB'))}
     </table>
     <div style="background:#faf8f5;border-left:3px solid #c8a45c;padding:14px 16px;border-radius:0 8px 8px 0">
       <div style="color:#7b7169;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px">Message</div>
       <div style="color:#1c1917;font-size:14px;line-height:1.65;white-space:pre-wrap">${escapeHtml(lead.message)}</div>
     </div>
     <p style="margin:22px 0 0">
       <a href="${escapeHtml(config.publicUrl)}/admin/dashboard.html"
          style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:500">
         Open the dashboard
       </a>
     </p>
     <p style="margin:12px 0 0;color:#8a8079;font-size:12.5px">
       Or reply straight to this email — it goes directly to ${escapeHtml(lead.email)}.
     </p>`,
  );

  const text = [
    `New ${lead.type === 'QUOTE' ? 'quote request' : 'message'} from your website`,
    '',
    `Name:     ${lead.name}`,
    `Email:    ${lead.email}`,
    `Phone:    ${lead.phone}`,
    lead.location ? `Location: ${lead.location}` : '',
    lead.service?.title ? `Service:  ${lead.service.title}` : '',
    lead.projectType ? `Project:  ${lead.projectType}` : '',
    lead.budgetRange ? `Budget:   ${lead.budgetRange}` : '',
    lead.timeline ? `Timeline: ${lead.timeline}` : '',
    '',
    'Message:',
    lead.message,
    '',
    `Manage: ${config.publicUrl}/admin/dashboard.html`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: `New ${lead.type === 'QUOTE' ? 'quote request' : 'enquiry'} — ${lead.name}`,
    html,
    text,
    replyTo: lead.email,
  };
}

export function leadAutoReplyEmail(lead) {
  const html = shell(
    'Thanks — we have your details',
    `<p style="margin:0 0 16px;color:#443d38;font-size:15px;line-height:1.65">
       Dear ${escapeHtml(lead.name)},
     </p>
     <p style="margin:0 0 16px;color:#443d38;font-size:15px;line-height:1.65">
       Thank you for reaching out to Nam Interior Constructs. We have received your
       ${lead.type === 'QUOTE' ? 'request for a quotation' : 'message'} and a member of our team
       will be in touch within one working day.
     </p>
     <p style="margin:0 0 22px;color:#443d38;font-size:15px;line-height:1.65">
       If your enquiry is urgent, call or WhatsApp us on
       <a href="tel:${escapeHtml(config.business.phone)}" style="color:#1c1917">${escapeHtml(config.business.phone)}</a>.
     </p>
     <div style="background:#faf8f5;border-radius:10px;padding:16px;margin-bottom:22px">
       <div style="color:#7b7169;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:9px">Your message</div>
       <div style="color:#5c544e;font-size:13.5px;line-height:1.65;white-space:pre-wrap">${escapeHtml(lead.message)}</div>
     </div>
     <p style="margin:0;color:#443d38;font-size:15px;line-height:1.65">
       Warm regards,<br>
       <strong>${escapeHtml(config.business.name)}</strong><br>
       <span style="color:#8a8079;font-size:13.5px">${escapeHtml(config.business.address)} · ${escapeHtml(
         config.business.phone,
       )}</span>
     </p>`,
  );

  return {
    subject: 'We have received your enquiry — Nam Interior Constructs',
    html,
    text: `Dear ${lead.name},\n\nThank you for contacting Nam Interior Constructs. We have received your enquiry and will respond within one working day.\n\nFor urgent matters call ${config.business.phone}.\n\nWarm regards,\n${config.business.name}`,
    to: lead.email,
  };
}

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

import { COVER_CONTENT, THANKYOU_TYPE2_CONTENT } from "@/lib/constant";

const region = process.env.AWS_REGION || "us-east-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const sesClient = new SESClient({
  region,
  ...(accessKeyId && secretAccessKey
    ? {
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      }
    : {}),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getSesFromSource(): string | null {
  const addr = process.env.AWS_SES_FROM_EMAIL?.trim();
  if (!addr) return null;
  return `Assuritii <${addr}>`;
}

export interface SubmissionEmailParams {
  to: string;
  firstName: string;
  lastName: string;
}

export async function sendSubmissionConfirmationEmail(
  params: SubmissionEmailParams,
): Promise<boolean> {
  const email = params.to;
  if (!email || !email.includes("@")) {
    return false;
  }

  const source = getSesFromSource();
  if (!source) {
    console.warn(
      "[send-submission-email] Set AWS_SES_FROM_EMAIL; skipping confirmation email",
    );
    return false;
  }

  const firstName = params.firstName?.trim() || "there";
  const partnerName = THANKYOU_TYPE2_CONTENT.partnerName;
  const { confirmationMessage, emailConfirmationNotice } =
    THANKYOU_TYPE2_CONTENT;
  const phone = COVER_CONTENT.callToAction;
  const subject = "Thank you for your response!";

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(partnerName)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      text-align: center;
    }
    .email-container {
      max-width: 600px;
      width: 100%;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e8e8e8;
    }
    .email-wrapper {
      background-color: #f8f9fa;
      padding: 20px;
    }
    table.layout {
      width: 100%;
      max-width: 600px;
      border-spacing: 0;
      border-collapse: collapse;
      margin: 0 auto;
    }
    td {
      padding: 0;
      text-align: center;
      vertical-align: top;
    }
    .email-banner-img {
      border: 0;
      outline: none;
      text-decoration: none;
      display: block;
      width: 100%;
      max-width: 600px;
      height: auto;
      margin: 0 auto;
    }
    .headline {
      padding: 28px 24px 12px;
      font-size: 22px;
      font-weight: bold;
      color: #1e3a5f;
      line-height: 1.3;
    }
    .body-text {
      padding: 0 24px 20px;
      font-size: 15px;
      color: #374151;
      text-align: center;
      line-height: 1.65;
    }
    .cta-wrap {
      padding: 12px 24px 28px;
    }
    a.cta-phone {
      display: inline-block;
      padding: 14px 28px;
      background-color: #1e3a5f;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: bold;
      font-size: 16px;
      border-radius: 8px;
    }
    .footer-text {
      padding: 20px;
      font-size: 12px;
      color: #666;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .footer-text p {
      margin: 8px 0;
      text-align: center;
    }
    .footer-text a {
      color: #1e3a5f;
      text-decoration: none;
    }
    .footer-text a:hover {
      text-decoration: underline;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 10px; }
      .email-container { margin: 0; border-radius: 8px; }
      .footer-text { padding: 15px; font-size: 11px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="layout" style="width:100%;max-width:600px;border-collapse:collapse;margin:0 auto;">
      <tr>
        <td style="padding:0;line-height:0;font-size:0;">
          <img class="email-banner-img" src="https://www.home.assuritii.com/email/content-1.png" alt="Thank you for choosing First Premier Home Warranty" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;">
        </td>
      </tr>
      <tr>
        <td style="padding:0;line-height:0;font-size:0;">
          <a href="tel:+18559163700" style="display:block;line-height:0;">
            <img class="email-banner-img" src="https://www.home.assuritii.com/email/content-2.png" alt="Call to speak with a specialist" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;">
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:0;line-height:0;font-size:0;">
          <img class="email-banner-img" src="https://www.home.assuritii.com/email/content-3.png" alt="First Premier Home Warranty" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;">
        </td>
      </tr>
      <tr>
        <td class="footer-text">
          <p>This is an automated confirmation to let you know we've received your request.</p>
        </td>
      </tr>
      <tr>
        <td class="footer-text">
          <p><a href="https://www.home.assuritii.com">home.assuritii.com</a> | 12540 SW Leveton Dr, #P2150 Tualatin, OR, 97062</p>
        </td>
      </tr>
    </table>
    </div>
  </div>
</body>
</html>
`.trim();

  const textBody = `
Thank you for ${partnerName}

Hi ${firstName},

${confirmationMessage}

${emailConfirmationNotice ?? ""}

${phone.contactText}: ${phone.phoneNumber}
${phone.phoneHref}

This is an automated confirmation that we received your quote request.
${process.env.SES_EMAIL_UNSUBSCRIBE_URL?.trim() ? `Unsubscribe: ${process.env.SES_EMAIL_UNSUBSCRIBE_URL.trim()}` : ""}

assuritii.com${process.env.SES_EMAIL_FOOTER_ADDRESS?.trim() ? ` | ${process.env.SES_EMAIL_FOOTER_ADDRESS.trim()}` : ""}
`.trim();

  try {
    const command = new SendEmailCommand({
      Source: source,
      Destination: { ToAddresses: [email.trim()] },
      ReplyToAddresses: process.env.SES_REPLY_TO?.trim()
        ? [process.env.SES_REPLY_TO.trim()]
        : undefined,
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody, Charset: "UTF-8" },
        },
      },
    });

    await sesClient.send(command);
    return true;
  } catch (error) {
    console.error("[send-submission-email] Email sending error:", error);
    return false;
  }
}

export async function sendTestEmail(): Promise<boolean> {
  try {
    const testEmail = process.env.TEST_EMAIL?.trim() || "test@example.com";
    return await sendSubmissionConfirmationEmail({
      to: testEmail,
      firstName: "Test",
      lastName: "User",
    });
  } catch {
    return false;
  }
}

/**
 * Firebase Cloud Function to send client invitation emails using Nodemailer
 */

import * as functions from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import * as nodemailer from "nodemailer";

interface ClientInvitationEmailData {
  email: string;
  clientName: string;
  inviterName: string;
  inviterEmail: string;
  invitationLink: string;
}

// Define secrets for email configuration
const emailUser = defineSecret("EMAIL_USER");
const emailPass = defineSecret("EMAIL_PASS");

const FROM_NAME = "Serigrafie Brasov";

export const sendClientInvitationEmail = functions
  .runWith({secrets: [emailUser, emailPass]})
  .https.onCall(
  async (
    data: ClientInvitationEmailData,
    context: functions.https.CallableContext
  ) => {
    // Verify the user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to send invitations."
      );
    }

    // Get secret values
    const emailUserValue = emailUser.value();
    const emailPassValue = emailPass.value();

    // Check if email is configured
    if (!emailUserValue || !emailPassValue) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Email service is not configured. " +
        "Please set EMAIL_USER and EMAIL_PASS secrets."
      );
    }

    // Create transporter with secret values
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUserValue,
        pass: emailPassValue,
      },
    });

    // Validate required fields
    const {email, clientName, inviterName, inviterEmail, invitationLink} = data;

    if (!email || !inviterName || !invitationLink) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: " +
        "email, inviterName, or invitationLink"
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid email address format"
      );
    }

    // HTML Email Template (Romanian)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitație de comandă</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont,
                'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #1a1a1a;
              margin-bottom: 10px;
            }
            .content {
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background: #0693e3;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
            }
            .button:hover {
              opacity: 0.9;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
            .expires {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Serigrafie Brasov</div>
            </div>

            <div class="content">
              <h2>Ai fost invitat să plasezi comenzi!</h2>

              <p>Bună${clientName ? ` ${clientName}` : ""}!</p>

              <p>
                <strong>${inviterName}</strong>${
  inviterEmail ? ` (${inviterEmail})` : ""
} te-a invitat să folosești platforma noastră de comenzi personalizate.
              </p>

              <p>
                Vei putea:
              </p>
              <ul>
                <li>Plasa comenzi pentru produse personalizate (căni, tricouri, hanorace, genți, șepci și altele)</li>
                <li>Urmări statusul comenzilor tale în timp real</li>
                <li>Comunica direct cu echipa noastră</li>
                <li>Vizualiza istoricul comenzilor tale</li>
              </ul>

              <div class="expires">
                ⏱️ Această invitație expiră în 30 de zile.
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationLink}"
                   style="display: inline-block;
                          padding: 14px 32px;
                          background-color: #0693e3;
                          color: #ffffff;
                          text-decoration: none;
                          border-radius: 6px;
                          font-weight: 600;
                          font-size: 16px;">
                  Crează cont și începe să comanzi
                </a>
              </div>

              <p style="font-size: 14px; color: #666; margin-top: 20px;">
                Sau copiază și lipește acest link în browser:<br>
                <code style="background: #f5f5f5; padding: 8px;
                  display: inline-block; margin-top: 8px;
                  word-break: break-all;">${invitationLink}</code>
              </p>
            </div>

            <div class="footer">
              <p>
                Această invitație a fost trimisă de ${inviterName}.
                Dacă nu te așteptai la această invitație,
                poți ignora acest email în siguranță.
              </p>
              <p>
                © ${new Date().getFullYear()} Serigrafie Brasov. Toate drepturile rezervate.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain Text Email Template (Romanian)
    const textContent = `
Ai fost invitat să plasezi comenzi la Serigrafie Brasov!

Bună${clientName ? ` ${clientName}` : ""}!

${inviterName}${
  inviterEmail ? ` (${inviterEmail})` : ""
} te-a invitat să folosești platforma noastră de comenzi personalizate.

Vei putea:
- Plasa comenzi pentru produse personalizate (căni, tricouri, hanorace, genți, șepci și altele)
- Urmări statusul comenzilor tale în timp real
- Comunica direct cu echipa noastră
- Vizualiza istoricul comenzilor tale

Dă click pe linkul de mai jos pentru a accepta invitația:
${invitationLink}

Această invitație expiră în 30 de zile.

Dacă nu te așteptai la această invitație, poți ignora acest email în siguranță.

© ${new Date().getFullYear()} Serigrafie Brasov. Toate drepturile rezervate.
    `;

    try {
      // Send email using Nodemailer
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${FROM_NAME}" <${emailUserValue}>`,
        to: email,
        subject:
          `Invitație de comenzi de la ${inviterName} - Serigrafie Brasov`,
        text: textContent,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);

      functions.logger.info(
        `Client invitation email sent successfully to ${email}`,
        {messageId: info.messageId, inviterName}
      );

      return {
        success: true,
        message: "Invitation email sent successfully",
        messageId: info.messageId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ?
        error.message : "Unknown error";
      functions.logger.error("Error sending client invitation email:", {
        error: errorMessage,
        email,
        inviterName,
      });

      throw new functions.https.HttpsError(
        "internal",
        "Failed to send invitation email. " +
        "Please check your email configuration.",
        errorMessage
      );
    }
  }
);

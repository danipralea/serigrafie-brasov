/**
 * Firebase Cloud Function to send team invitation emails using Nodemailer
 *
 * Setup Instructions:
 * 1. Initialize Firebase Functions with TypeScript (if not already done):
 *    firebase init functions
 *    (Select TypeScript when prompted)
 *
 * 2. Install dependencies in functions directory:
 *    cd functions
 *    npm install nodemailer
 *    npm install --save-dev @types/nodemailer
 *
 * 3. Set email credentials (use app-specific password for Gmail):
 *    firebase functions:config:set email.user="your-email@gmail.com"
 *    firebase functions:config:set email.pass="your-app-password"
 *
 *    For Gmail app password: https://myaccount.google.com/apppasswords
 *
 * 4. Add this file to functions/src/index.ts:
 *    export * from './sendTeamInvitationEmail';
 *
 * 5. Deploy this function:
 *    firebase deploy --only functions:sendTeamInvitationEmail
 *
 * 6. The client/src/services/emailService.js already calls this function
 */

import * as functions from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import * as nodemailer from "nodemailer";

interface InvitationEmailData {
  email: string;
  inviterName: string;
  inviterEmail: string;
  role: "owner" | "admin" | "member";
  invitationLink: string;
}

// Define secrets for email configuration
const emailUser = defineSecret("EMAIL_USER");
const emailPass = defineSecret("EMAIL_PASS");

const FROM_NAME = "Serigrafie Brasov";

export const sendTeamInvitationEmail = functions
  .runWith({secrets: [emailUser, emailPass]})
  .https.onCall(
  async (
    data: InvitationEmailData,
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
      service: "gmail", // Change to 'outlook', 'yahoo', etc. if needed
      auth: {
        user: emailUserValue,
        pass: emailPassValue,
      },
    });

    // Validate required fields
    const {email, inviterName, inviterEmail, role, invitationLink} = data;

    if (!email || !inviterName || !role || !invitationLink) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: " +
        "email, inviterName, role, or invitationLink"
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

    // Role names mapping
    const roleNames: Record<string, string> = {
      owner: "Owner",
      admin: "Admin",
      member: "Member",
    };

    // HTML Email Template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
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
            .role-badge {
              display: inline-block;
              padding: 6px 12px;
              background: #0693e3;
              color: white;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              margin: 10px 0;
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
              <h2>You've been invited to join a team!</h2>

              <p>Hello!</p>

              <p>
                <strong>${inviterName}</strong>${
  inviterEmail ? ` (${inviterEmail})` : ""
} has invited you to join their team on Serigrafie Brasov's order tracking platform.
              </p>

              <p>
                You'll be joining as a <span class="role-badge">${
  roleNames[role] || role
}</span>
              </p>

              <div class="expires">
                ⏱️ This invitation expires in 7 days.
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
                  Accept Invitation
                </a>
              </div>

              <p style="font-size: 14px; color: #666; margin-top: 20px;">
                Or copy and paste this link into your browser:<br>
                <code style="background: #f5f5f5; padding: 8px;
                  display: inline-block; margin-top: 8px;
                  word-break: break-all;">${invitationLink}</code>
              </p>
            </div>

            <div class="footer">
              <p>
                This invitation was sent by ${inviterName}.
                If you didn't expect this invitation,
                you can safely ignore this email.
              </p>
              <p>
                © ${new Date().getFullYear()} Serigrafie Brasov. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain Text Email Template
    const textContent = `
You've been invited to join a team on Serigrafie Brasov!

${inviterName}${
  inviterEmail ? ` (${inviterEmail})` : ""
} has invited you to join their team.

Role: ${roleNames[role] || role}

Click the link below to accept the invitation:
${invitationLink}

This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} Serigrafie Brasov. All rights reserved.
    `;

    try {
      // Send email using Nodemailer
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${FROM_NAME}" <${emailUserValue}>`,
        to: email,
        subject:
          `You've been invited to join ${inviterName}'s team on Serigrafie Brasov`,
        text: textContent,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);

      functions.logger.info(
        `Team invitation email sent successfully to ${email}`,
        {messageId: info.messageId, inviterName, role}
      );

      return {
        success: true,
        message: "Invitation email sent successfully",
        messageId: info.messageId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ?
        error.message : "Unknown error";
      functions.logger.error("Error sending invitation email:", {
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

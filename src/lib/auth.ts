import { betterAuth } from "better-auth";
import {
  drizzleAdapter,
} from "@better-auth/drizzle-adapter";
import { Resend } from "resend";

import { db } from "@/lib/db";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

function escapeHtml(
  value: string
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const auth = betterAuth({
  appName: "Synapse",

  trustedOrigins: [
    "https://synapse-alpha-rosy.vercel.app",
    "http://localhost:3000",
  ],

  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,

    sendVerificationEmail: async ({
      user,
      url,
    }) => {
      const apiKey =
        process.env.RESEND_API_KEY;

      if (!apiKey) {
        throw new Error(
          "RESEND_API_KEY is not configured."
        );
      }

      const from =
        process.env.AUTH_EMAIL_FROM ??
        "Synapse <onboarding@resend.dev>";

      const safeUrl =
        escapeHtml(url);

      const result =
        await resend.emails.send({
          from,
          to: user.email,
          subject:
            "Verify your Synapse email",
          text: [
            "Verify your email address to finish creating your Synapse account.",
            "",
            url,
            "",
            "This link expires in one hour.",
            "If you did not create this account, you can ignore this email.",
          ].join("\n"),
          html: `
            <div style="margin:0;background:#f6f7f9;padding:32px 16px;font-family:Arial,sans-serif;color:#18181b">
              <div style="margin:0 auto;max-width:520px;border:1px solid #e4e4e7;border-radius:12px;background:#ffffff;padding:32px">
                <div style="font-size:20px;font-weight:700">
                  Synapse
                </div>

                <h1 style="margin:28px 0 12px;font-size:22px;line-height:1.3">
                  Verify your email address
                </h1>

                <p style="margin:0;color:#52525b;font-size:14px;line-height:1.7">
                  Verify your email address to finish creating your Synapse account.
                </p>

                <a
                  href="${safeUrl}"
                  style="display:inline-block;margin-top:24px;border-radius:8px;background:#4f46e5;padding:11px 18px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none"
                >
                  Verify email
                </a>

                <p style="margin:24px 0 0;color:#71717a;font-size:12px;line-height:1.6">
                  This link expires in one hour. If you did not create this account, you can ignore this email.
                </p>
              </div>
            </div>
          `,
        });

      if (result.error) {
        throw new Error(
          `Unable to send verification email: ${result.error.message}`
        );
      }
    },
  },

  socialProviders: {
    google: {
      clientId:
        process.env
          .AUTH_GOOGLE_CLIENT_ID as string,
      clientSecret:
        process.env
          .AUTH_GOOGLE_CLIENT_SECRET as string,
    },

    github: {
      clientId:
        process.env
          .AUTH_GITHUB_CLIENT_ID as string,
      clientSecret:
        process.env
          .AUTH_GITHUB_CLIENT_SECRET as string,
      scope: [
        "read:user",
        "user:email",
      ],
    },
  },
});
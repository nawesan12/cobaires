// src/lib/resend.ts
import { Resend } from "resend";

// --- Initialize the Resend Client ---
// It's best practice to use an environment variable for your API key.
// Create a .env file in the root of your project and add:
// RESEND_API_KEY=your_api_key_here
const resend = new Resend(import.meta.env.RESEND_API_KEY);

// --- Define the structure for an email payload ---
interface EmailPayload {
  to: string;
  subject: string;
  html: string; // You can also use `react: JSX.Element` if using React Email
}

/**
 * A reusable function to send emails using Resend.
 * @param {EmailPayload} payload - An object containing the recipient, subject, and HTML content.
 * @returns {Promise<object>} The response from the Resend API.
 * @throws {Error} Throws an error if the email fails to send.
 */
export const sendEmail = async (payload: EmailPayload) => {
  const { to, subject, html } = payload;

  // You must verify a domain with Resend to use it as the 'from' address.
  // For development, you can often use the default 'onboarding@resend.dev'.
  const fromAddress = "Cobaires <onboarding@resend.dev>";

  console.log(`Attempting to send email to: ${to}`);

  try {
    const data = await resend.emails.send({
      from: fromAddress,
      to: to,
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    // Re-throw the error so the calling function can handle it
    throw new Error("Failed to send email.", { cause: error });
  }
};

/*
 * --- HOW TO USE THIS LIBRARY ---
 *
 * 1. Install Resend:
 * npm install resend
 *
 * 2. Set up your .env file:
 * Create a file named `.env` in your project's root directory and add:
 * RESEND_API_KEY=re_YourApiKeyFromResend
 *
 * 3. Import and use in your API routes:
 *
 * // In /src/pages/api/replies.ts
 * import { sendEmail } from '../../lib/resend';
 *
 * export const POST: APIRoute = async ({ request }) => {
 * // ... your form handling logic ...
 *
 * try {
 * // After saving to the database, send the email
 * await sendEmail({
 * to: contactEmail,
 * subject: `Re: ${conversationSubject}`,
 * html: `<p>Your reply content here...</p>`
 * });
 *
 * // ... return success response ...
 * } catch (error) {
 * // ... handle error ...
 * }
 * };
 *
 */

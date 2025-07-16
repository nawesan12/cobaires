// src/pages/api/messages.ts
import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../../lib/resend"; // Import the email function

// This line is crucial for API routes that receive POST requests.
export const prerender = false;

const prisma = new PrismaClient();

// This API endpoint now creates a new Conversation and sends an email notification.
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    const name = formData.get("nombre") as string;
    const lastname = formData.get("apellido") as string;
    const phone = formData.get("telefono") as string | null;
    const email = formData.get("email") as string;
    const message = formData.get("mensaje") as string;

    // --- Basic Validation ---
    if (!name || !lastname || !email || !message) {
      return new Response(
        JSON.stringify({
          message: "Error: Nombre, apellido, email y mensaje son requeridos.",
        }),
        { status: 400 },
      );
    }

    // --- Create a new Conversation in the database ---
    const newConversation = await prisma.conversation.create({
      data: {
        contactName: `${name} ${lastname}`,
        contactEmail: email,
        phone,
        subject: message.split(" ").slice(0, 8).join(" ") + "...",
        initialMessage: message,
        status: "OPEN",
      },
    });

    // --- Send Notification Email to Site Owner ---
    try {
      const siteOwnerEmail = import.meta.env.ADMIN_EMAIL; // Set this in your .env file
      if (siteOwnerEmail) {
        await sendEmail({
          to: siteOwnerEmail,
          subject: `Nuevo mensaje de: ${newConversation.contactName}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; background-color: #f4f4f4;">
              <h2 style="color: #333;">Has recibido un nuevo mensaje</h2>
              <div style="background-color: #fff; padding: 20px; border-radius: 8px;">
                <p><strong>De:</strong> ${newConversation.contactName}</p>
                <p><strong>Email:</strong> ${newConversation.contactEmail}</p>
                ${newConversation.phone ? `<p><strong>Teléfono:</strong> ${newConversation.phone}</p>` : ""}
                <p><strong>Mensaje:</strong></p>
                <p style="white-space: pre-wrap; border-left: 3px solid #ccc; padding-left: 15px;">${newConversation.initialMessage}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <a href="${new URL(`/admin/mensajes/${newConversation.id}`, request.url).href}" style="display: inline-block; padding: 12px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">
                  Ver y Responder en el Dashboard
                </a>
              </div>
            </div>
          `,
        });
      }
    } catch (emailError) {
      // Log the email error but don't fail the entire request.
      // The user's message is already saved.
      console.error("Failed to send notification email:", emailError);
    }

    return new Response(
      JSON.stringify({
        message: "¡Mensaje enviado con éxito!",
        conversation: newConversation,
      }),
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating conversation:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor." }),
      { status: 500 },
    );
  }
};

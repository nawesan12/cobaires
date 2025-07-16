// src/pages/api/messages.ts
import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";

// This line is crucial for API routes that receive POST requests.
export const prerender = false;

const prisma = new PrismaClient();

// This API endpoint now creates a new Conversation instead of a single Message.
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
        // Create a subject from the first few words of the message
        subject: message.split(" ").slice(0, 8).join(" ") + "...",
        initialMessage: message,
        status: "OPEN", // All new conversations start as 'OPEN'
      },
    });

    // --- TODO: Add email notification logic here ---
    // You could send an email to your client to notify them of the new message.
    // await resend.emails.send({
    //   from: 'noreply@yourdomain.com',
    //   to: 'client@email.com',
    //   subject: `Nuevo mensaje de ${newConversation.contactName}`,
    //   html: `<p>Has recibido un nuevo mensaje. <a href="/dashboard/mensajes/${newConversation.id}">Ver conversación</a></p>`,
    // });

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

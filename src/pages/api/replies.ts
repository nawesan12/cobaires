// src/pages/api/replies.ts
import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../../lib/resend"; // Import the email function

export const prerender = false;
const prisma = new PrismaClient();

// API endpoint for creating new replies and notifying the user
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    const content = formData.get("content") as string;
    const conversationId = formData.get("conversationId") as string;

    if (!content || !conversationId) {
      return new Response(
        JSON.stringify({
          message: "Error: Faltan datos para enviar la respuesta.",
        }),
        { status: 400 },
      );
    }

    // --- 1. Find the original conversation to get user details ---
    const conversation = await prisma.conversation.findUnique({
      where: { id: Number(conversationId) },
    });

    if (!conversation) {
      return new Response(
        JSON.stringify({ message: "Conversación no encontrada." }),
        { status: 404 },
      );
    }

    // --- 2. Save the new reply to the database ---
    const newReply = await prisma.reply.create({
      data: {
        content,
        direction: "OUTBOUND", // This reply is from you
        conversationId: Number(conversationId),
      },
    });

    // --- 3. Also update the conversation's `updatedAt` timestamp ---
    await prisma.conversation.update({
      where: { id: Number(conversationId) },
      data: { updatedAt: new Date() },
    });

    // --- 4. Send the reply via email to the user ---
    try {
      await sendEmail({
        to: conversation.contactEmail,
        subject: `Re: ${conversation.subject}`,
        html: `
                <div style="font-family: sans-serif; padding: 20px; background-color: #f4f4f4;">
                    <h2 style="color: #333;">Respuesta a tu consulta</h2>
                    <div style="background-color: #fff; padding: 20px; border-radius: 8px;">
                        <p>Hola ${conversation.contactName},</p>
                        <p>Gracias por tu mensaje. Aquí está nuestra respuesta:</p>
                        <blockquote style="border-left: 3px solid #ccc; padding-left: 15px; margin-left: 15px; color: #555;">
                            <p style="white-space: pre-wrap;">${content}</p>
                        </blockquote>
                        <p>Saludos,<br>El equipo de Cobaires</p>
                    </div>
                </div>
            `,
      });
    } catch (emailError) {
      // Log the email error but don't fail the request, as the reply is already saved.
      console.error("Failed to send reply email to user:", emailError);
    }

    return new Response(
      JSON.stringify({
        message: "Respuesta enviada con éxito",
        reply: newReply,
      }),
      { status: 201 },
    );
  } catch (error) {
    console.error("Error sending reply:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor." }),
      { status: 500 },
    );
  }
};

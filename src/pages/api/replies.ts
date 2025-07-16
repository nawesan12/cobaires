// src/pages/api/replies.ts
import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";

export const prerender = false;
const prisma = new PrismaClient();

// API endpoint for creating new replies
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

    // --- TODO: Add email sending logic here ---
    // For example, using a service like Resend:
    // await resend.emails.send({
    //   from: 'tu@email.com',
    //   to: conversation.contactEmail,
    //   subject: `Re: ${conversation.subject}`,
    //   html: content,
    // });

    // --- Save the reply to the database ---
    const newReply = await prisma.reply.create({
      data: {
        content,
        direction: "OUTBOUND", // This reply is from you
        conversationId: Number(conversationId),
      },
    });

    // Also update the conversation's `updatedAt` timestamp
    await prisma.conversation.update({
      where: { id: Number(conversationId) },
      data: { updatedAt: new Date() },
    });

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

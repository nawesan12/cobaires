// src/pages/api/projects/[id].ts
import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// This API route handles deleting a single project by its ID.
export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({ message: "Error: ID del proyecto no proporcionado." }),
        { status: 400 },
      );
    }

    // Find the project to ensure it exists before trying to delete.
    const project = await prisma.project.findUnique({
      where: { id: Number(id) },
    });

    if (!project) {
      return new Response(
        JSON.stringify({ message: "Error: Proyecto no encontrado." }),
        { status: 404 },
      );
    }

    // TODO: In a real app with Cloudinary, you would also delete the image here.
    // Example: await cloudinary.uploader.destroy(public_id_of_image);

    // Delete the project from the database.
    await prisma.project.delete({
      where: { id: Number(id) },
    });

    return new Response(
      JSON.stringify({ message: "Proyecto eliminado con éxito." }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting project:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor." }),
      { status: 500 },
    );
  }
};

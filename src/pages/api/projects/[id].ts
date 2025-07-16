// src/pages/api/projects/[id].ts
import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

export const prerender = false;

// Configure Cloudinary with your credentials from the .env file
cloudinary.config({
  cloud_name: import.meta.env.CLOUDINARY_CLOUD_NAME,
  api_key: import.meta.env.CLOUDINARY_API_KEY,
  api_secret: import.meta.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();

// --- Helper function to extract public_id from a Cloudinary URL ---
const getPublicIdFromUrl = (url: string) => {
  const parts = url.split("/");
  const filename = parts.pop();
  const publicIdWithFolder = `cobaires_projects/${filename?.split(".")[0]}`;
  return publicIdWithFolder;
};

// --- API endpoint for UPDATING a project ---
export const PUT: APIRoute = async ({ params, request }) => {
  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    return new Response(
      JSON.stringify({ message: "ID de proyecto inválido." }),
      { status: 400 },
    );
  }

  try {
    const formData = await request.formData();

    // --- Get all form data ---
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const type = formData.get("type") as string | null;
    const year = formData.get("year") as string | null;
    const location = formData.get("location") as string | null;
    const surface = formData.get("surface") as string | null;
    const client = formData.get("client") as string | null;
    const newImageFiles = formData.getAll("newImages") as File[];
    const imagesToDeleteRaw = formData.get("imagesToDelete") as string;
    const imagesToDelete: number[] = imagesToDeleteRaw
      ? JSON.parse(imagesToDeleteRaw)
      : [];

    // --- 1. Handle Deletion of Existing Images ---
    if (imagesToDelete.length > 0) {
      const images = await prisma.projectImage.findMany({
        where: { id: { in: imagesToDelete } },
      });

      // Delete from Cloudinary
      const cloudinaryDeletePromises = images.map((img: any) =>
        cloudinary.uploader.destroy(getPublicIdFromUrl(img.url)),
      );
      await Promise.all(cloudinaryDeletePromises);

      // Delete from Database (this will happen inside the transaction)
    }

    // --- 2. Handle Upload of New Images ---
    let newImageUrls: string[] = [];
    if (newImageFiles.length > 0 && newImageFiles[0].size > 0) {
      const uploadPromises = newImageFiles.map(
        (file) =>
          new Promise<string>(async (resolve, reject) => {
            const buffer = Buffer.from(await file.arrayBuffer());
            cloudinary.uploader
              .upload_stream({ folder: "cobaires_projects" }, (err, result) => {
                if (err) return reject(err);
                if (result) return resolve(result.secure_url);
              })
              .end(buffer);
          }),
      );
      newImageUrls = await Promise.all(uploadPromises);
    }

    // --- 3. Update Database in a Single, Safe Transaction ---
    await prisma.$transaction(async (tx: any) => {
      // a. Update the project's text fields
      await tx.project.update({
        where: { id: projectId },
        data: { title, description, type, year, location, surface, client },
      });

      // b. Delete old image records from the database
      if (imagesToDelete.length > 0) {
        await tx.projectImage.deleteMany({
          where: { id: { in: imagesToDelete } },
        });
      }

      // c. Create new image records in the database
      if (newImageUrls.length > 0) {
        await tx.projectImage.createMany({
          data: newImageUrls.map((url) => ({
            url,
            projectId: projectId,
          })),
        });
      }
    });

    return new Response(
      JSON.stringify({ message: "Proyecto actualizado con éxito" }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating project:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor." }),
      { status: 500 },
    );
  }
};

// --- API endpoint for DELETING a project ---
export const DELETE: APIRoute = async ({ params }) => {
  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    return new Response(
      JSON.stringify({ message: "ID de proyecto inválido." }),
      { status: 400 },
    );
  }

  try {
    // Find the project and its images before deleting
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { images: true },
    });

    if (!project) {
      return new Response(
        JSON.stringify({ message: "Proyecto no encontrado." }),
        { status: 404 },
      );
    }

    // Delete all associated images from Cloudinary
    if (project.images.length > 0) {
      const deletePromises = project.images.map((img: any) =>
        cloudinary.uploader.destroy(getPublicIdFromUrl(img.url)),
      );
      await Promise.all(deletePromises);
    }

    // Delete the project and its related images from the database (cascade delete)
    await prisma.project.delete({
      where: { id: projectId },
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

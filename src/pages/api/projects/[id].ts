// src/pages/api/projects/[id].ts
import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

export const prerender = false;

// Configure Cloudinary
cloudinary.config({
  cloud_name: import.meta.env.CLOUDINARY_CLOUD_NAME,
  api_key: import.meta.env.CLOUDINARY_API_KEY,
  api_secret: import.meta.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();

// Helper to get Cloudinary public_id from a URL
const getPublicIdFromUrl = (url: string) => {
  const parts = url.split("/");
  const filename = parts.pop()?.split(".")[0];
  return `cobaires_projects/${filename}`;
};

// API endpoint for UPDATING a project
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

    // Get all form data
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
    const thumbnailId = formData.get("thumbnail") as string;

    // 1. Handle Deletion of Existing Images from Cloudinary
    if (imagesToDelete.length > 0) {
      const images = await prisma.projectImage.findMany({
        where: { id: { in: imagesToDelete } },
      });
      const cloudinaryDeletePromises = images.map((img) =>
        cloudinary.uploader.destroy(getPublicIdFromUrl(img.url)),
      );
      await Promise.all(cloudinaryDeletePromises);
    }

    // 2. Handle Upload of New Images to Cloudinary
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

    // 3. Update Database in a Single, Safe Transaction
    await prisma.$transaction(async (tx) => {
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
            isThumbnail: false, // New images are not thumbnails by default
          })),
        });
      }

      // d. Update thumbnail selection
      if (thumbnailId) {
        // First, set all images for this project to be non-thumbnails
        await tx.projectImage.updateMany({
          where: { projectId: projectId },
          data: { isThumbnail: false },
        });

        // Then, set the selected image as the thumbnail
        await tx.projectImage.update({
          where: { id: Number(thumbnailId) },
          data: { isThumbnail: true },
        });
      }

      // e. Final check: Ensure a thumbnail exists if there are any images left
      const remainingImages = await tx.projectImage.findMany({
        where: { projectId: projectId },
        orderBy: { id: "asc" },
      });

      if (remainingImages.length > 0) {
        const hasThumbnail = remainingImages.some((img) => img.isThumbnail);
        if (!hasThumbnail) {
          // If no thumbnail is set (e.g., the old one was deleted), set the first image as the new thumbnail.
          await tx.projectImage.update({
            where: { id: remainingImages[0].id },
            data: { isThumbnail: true },
          });
        }
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

// API endpoint for DELETING a project
export const DELETE: APIRoute = async ({ params }) => {
  // This part does not need changes, but is included for completeness.
  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    return new Response(
      JSON.stringify({ message: "ID de proyecto inválido." }),
      { status: 400 },
    );
  }

  try {
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

    if (project.images.length > 0) {
      const deletePromises = project.images.map((img) =>
        cloudinary.uploader.destroy(getPublicIdFromUrl(img.url)),
      );
      await Promise.all(deletePromises);
    }

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

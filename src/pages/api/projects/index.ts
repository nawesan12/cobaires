// src/pages/api/projects/index.ts
import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

// This tells Astro to run this endpoint on the server, which is required for API routes.
export const prerender = false;

// Configure Cloudinary with your credentials from the .env file
cloudinary.config({
  cloud_name: import.meta.env.CLOUDINARY_CLOUD_NAME,
  api_key: import.meta.env.CLOUDINARY_API_KEY,
  api_secret: import.meta.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();

// API endpoint for creating new projects
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    // --- Get all text fields ---
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const type = formData.get("type") as string | null;
    const year = formData.get("year") as string | null;
    const location = formData.get("location") as string | null;
    const surface = formData.get("surface") as string | null;
    const client = formData.get("client") as string | null;

    // --- Get all uploaded files ---
    const imageFiles = formData.getAll("images") as File[];

    // --- Validation ---
    if (!title || !description || !imageFiles || imageFiles.length === 0) {
      return new Response(
        JSON.stringify({
          message:
            "Error: Título, descripción y al menos una imagen son requeridos.",
        }),
        { status: 400 },
      );
    }

    // --- Upload all images to Cloudinary in parallel ---
    const uploadPromises = imageFiles.map((file) => {
      return new Promise<string>(async (resolve, reject) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        cloudinary.uploader
          .upload_stream(
            {
              folder: "cobaires_projects",
              resource_type: "image",
            },
            (error, result) => {
              if (error) return reject(error);
              if (result) return resolve(result.secure_url);
            },
          )
          .end(buffer);
      });
    });

    const imageUrls = await Promise.all(uploadPromises);

    // --- Save everything to the database in a single transaction ---
    const newProject = await prisma.project.create({
      data: {
        title,
        description,
        type,
        year,
        location,
        surface,
        client,
        // Create the related image records at the same time
        images: {
          create: imageUrls.map((url) => ({ url })),
        },
      },
    });

    return new Response(
      JSON.stringify({
        message: "¡Proyecto creado con éxito!",
        project: newProject,
      }),
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating project:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor." }),
      { status: 500 },
    );
  }
};

// API endpoint for fetching all projects (no changes needed here)
export const GET: APIRoute = async () => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });
    return new Response(JSON.stringify(projects), { status: 200 });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor." }),
      { status: 500 },
    );
  }
};

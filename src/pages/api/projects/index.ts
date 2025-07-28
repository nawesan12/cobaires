import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

export const prerender = false;

// Configure Cloudinary with your environment variables
cloudinary.config({
  cloud_name: import.meta.env.CLOUDINARY_CLOUD_NAME,
  api_key: import.meta.env.CLOUDINARY_API_KEY,
  api_secret: import.meta.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    // --- Get all text fields ---
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const type = (formData.get("type") as string) || null;
    const year = (formData.get("year") as string) || null;
    const location = (formData.get("location") as string) || null;
    const surface = (formData.get("surface") as string) || null;
    const client = (formData.get("client") as string) || null;

    // --- FIX: Get uploaded files using the correct name 'newImages' ---
    const newImages = formData.getAll("newImages") as File[];

    // --- FIX: Get the selected thumbnail index using the correct name 'thumbnailSelection' ---
    const thumbnailIndex = parseInt(
      formData.get("thumbnailSelection") as string,
      10,
    );

    // --- Validation ---
    if (
      !title ||
      !description ||
      !newImages ||
      newImages.length === 0 ||
      isNaN(thumbnailIndex)
    ) {
      return new Response(
        JSON.stringify({
          message:
            "Error: Título, descripción y al menos una imagen (con una portada seleccionada) son requeridos.",
        }),
        { status: 400 },
      );
    }

    // --- Upload images to Cloudinary ---
    const uploadPromises = newImages.map((file) => {
      return new Promise<string>(async (resolve, reject) => {
        // Ensure file is valid before processing
        if (!file || file.size === 0) {
          return reject(new Error("Invalid file provided."));
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        cloudinary.uploader
          .upload_stream(
            { folder: "cobaires_projects", resource_type: "image" },
            (error, result) => {
              if (error) return reject(error);
              if (result) return resolve(result.secure_url);
            },
          )
          .end(buffer);
      });
    });
    const imageUrls = await Promise.all(uploadPromises);

    // --- Save everything to the database ---
    const newProject = await prisma.project.create({
      data: {
        title,
        description,
        type,
        year,
        location,
        surface,
        client,
        images: {
          // Map over the URLs and set the 'isThumbnail' flag based on the index
          create: imageUrls.map((url, index) => ({
            url,
            isThumbnail: index === thumbnailIndex,
          })),
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
      include: {
        images: {
          where: { isThumbnail: true },
          take: 1,
        },
      },
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

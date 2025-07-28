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

    // --- Get uploaded files and thumbnail index from form ---
    const newImages = formData.getAll("newImages") as File[];
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

    // --- Upload images to Cloudinary with improved error handling ---
    const uploadPromises = newImages.map((file) => {
      return new Promise<string>(async (resolve, reject) => {
        if (!file || file.size === 0) {
          return reject(
            new Error("Se proporcionó un archivo inválido o vacío."),
          );
        }
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          cloudinary.uploader
            .upload_stream(
              { folder: "cobaires_projects", resource_type: "image" },
              (error, result) => {
                // If Cloudinary returns an error, reject the promise
                if (error) {
                  // Log the detailed error from Cloudinary
                  console.error(
                    "Cloudinary Upload Error:",
                    JSON.stringify(error, null, 2),
                  );
                  return reject(
                    new Error(`Error de Cloudinary: ${error.message}`),
                  );
                }
                // If the result exists and has a secure URL, resolve the promise
                if (result && result.secure_url) {
                  return resolve(result.secure_url);
                }
                // If there's no result or URL for some reason, reject
                return reject(
                  new Error("La subida a Cloudinary no devolvió una URL."),
                );
              },
            )
            .end(buffer);
        } catch (e) {
          return reject(
            new Error("No se pudo procesar el archivo para la subida."),
          );
        }
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
    // This will now catch the more specific errors from the upload promises
    console.error("Error creating project:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor.";
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
    });
  }
};

// API endpoint for fetching all projects
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

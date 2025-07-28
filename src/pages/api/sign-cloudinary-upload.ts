import type { APIRoute } from "astro";
import { v2 as cloudinary } from "cloudinary";

export const prerender = false;

// This endpoint is only for POST requests
export const POST: APIRoute = async () => {
  // Use your Cloudinary API Secret from environment variables.
  // DO NOT expose this key on the client side.
  const apiSecret = import.meta.env.CLOUDINARY_API_SECRET;

  if (!apiSecret) {
    return new Response(
      JSON.stringify({ message: "Cloudinary API secret is not configured." }),
      { status: 500 },
    );
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    // This creates the unique signature using your API secret.
    // The 'folder' parameter ensures uploads go to the correct place.
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: "cobaires_projects", // Must match the folder used in the frontend
      },
      apiSecret,
    );

    // Send the signature, timestamp, and public API key back to the client.
    return new Response(
      JSON.stringify({
        signature,
        timestamp,
        api_key: import.meta.env.PUBLIC_CLOUDINARY_API_KEY, // Public key is safe to send
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error creating Cloudinary signature:", error);
    return new Response(
      JSON.stringify({ message: "Error generating signature." }),
      {
        status: 500,
      },
    );
  }
};

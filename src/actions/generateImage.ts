"use server";

import { adminBucket } from "@/firebase/firebaseAdmin";
import { File } from "formdata-node";
import fetch from "node-fetch";

interface RequestBody {
  prompt: string;
  n?: number;
  size?: string;
  cfg_scale?: number;
  height?: number;
  width?: number;
  samples?: number;
  steps?: number;
  seed?: number;
  style_preset?: string;
  safety_check?: boolean;
  sampler?: string;
}

interface DalleResponse {
  data: { url: string }[];
}

export async function generateImage(data: FormData) {
  try {
    const message = data.get("message") as string | null;
    const uid = data.get("uid") as string | null;
    const openAPIKey = data.get("openAPIKey") as string | null;
    const fireworksAPIKey = data.get("fireworksAPIKey") as string | null;
    const stabilityAPIKey = data.get("stabilityAPIKey") as string | null;
    const useCredits = data.get("useCredits") as string | null;
    const credits = data.get("credits") as string | null;
    const model = data.get("model") as string | null;
    const img: File | null = data.get("imageField") as File | null;

    if (useCredits && credits && Number(credits) < 2) {
      throw new Error(
        "Not enough credits to generate an image. Please purchase credits or use your own API keys."
      );
    }

    let apiUrl: string | undefined;
    let requestBody: RequestBody | undefined;
    let formData: FormData | undefined;
    let headers: { [key: string]: string } = {};

    // Handling for DALL-E Model
    if (model === "dall-e") {
      if (img) {
        formData = new FormData();
        formData.append("image", img);
        formData.append("prompt", message!);
        formData.append("n", "1");
        formData.append("size", "1024x1024");

        apiUrl = `https://api.openai.com/v1/images/edits`;
        headers = {
          Authorization: `Bearer ${
            useCredits ? process.env.OPENAI_API_KEY! : openAPIKey!
          }`,
        };
      } else {
        apiUrl = `https://api.openai.com/v1/images/generations`;
        requestBody = {
          prompt: message!,
          n: 1,
          size: "1024x1024",
        };
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            useCredits ? process.env.OPENAI_API_KEY! : openAPIKey!
          }`,
        };
      }
    }
    // Handling for Stable Diffusion XL Model
    else if (model === "stable-diffusion-xl") {
      if (img) {
        formData = new FormData();
        formData.append("init_image", img);
        formData.append("prompt", message!);
        formData.append("init_image_mode", "IMAGE_STRENGTH");
        formData.append("image_strength", "0.5");
        formData.append("cfg_scale", "7");
        formData.append("seed", "1");
        formData.append("steps", "30");
        formData.append("safety_check", "false");

        apiUrl =
          "https://api.fireworks.ai/inference/v1/image_generation/accounts/fireworks/models/stable-diffusion-xl-1024-v1-0/image_to_image";
        headers = {
          Accept: "image/jpeg",
          Authorization: `Bearer ${
            useCredits ? process.env.FIREWORKS_API_KEY! : fireworksAPIKey!
          }`,
        };
      } else {
        apiUrl = `https://api.fireworks.ai/inference/v1/image_generation/accounts/fireworks/models/stable-diffusion-xl-1024-v1-0`;
        requestBody = {
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30,
          seed: 0,
          safety_check: false,
          prompt: message!,
        };
        headers = {
          "Content-Type": "application/json",
          Accept: "image/jpeg",
          Authorization: `Bearer ${
            useCredits ? process.env.FIREWORKS_API_KEY! : fireworksAPIKey!
          }`,
        };
      }
    }
    // Handling for Stability SD3 Turbo Model
    else if (model === "stability-sd3-turbo") {
      formData = new FormData();
      if (img) {
        formData.append("mode", "image-to-image");
        formData.append("image", img);
        formData.append("strength", "0.7");
      } else {
        formData.append("mode", "text-to-image");
        formData.append("aspect_ratio", "1:1");
      }
      formData.append("prompt", message!);
      formData.append("output_format", "png");
      formData.append("model", "sd3-turbo");
      formData.append("isValidPrompt", "true");

      apiUrl = "https://api.stability.ai/v2beta/stable-image/generate/sd3";
      headers = {
        Accept: "image/*",
        Authorization: `Bearer ${
          useCredits ? process.env.STABILITY_API_KEY! : stabilityAPIKey!
        }`,
      };
    }
    // Handling for Playground V2 Model
    else if (model === "playground-v2") {
      if (img) {
        formData = new FormData();
        formData.append("init_image", img);
        formData.append("prompt", message!);
        formData.append("init_image_mode", "IMAGE_STRENGTH");
        formData.append("image_strength", "0.5");
        formData.append("cfg_scale", "7");
        formData.append("seed", "1");
        formData.append("steps", "30");
        formData.append("safety_check", "false");

        apiUrl =
          "https://api.fireworks.ai/inference/v1/image_generation/accounts/fireworks/models/playground-v2-1024px-aesthetic/image_to_image";
        headers = {
          Accept: "image/jpeg",
          Authorization: `Bearer ${
            useCredits ? process.env.FIREWORKS_API_KEY! : fireworksAPIKey!
          }`,
        };
      } else {
        apiUrl =
          "https://api.fireworks.ai/inference/v1/image_generation/accounts/fireworks/models/playground-v2-1024px-aesthetic";
        requestBody = {
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30,
          seed: 0,
          safety_check: false,
          prompt: message!,
        };
        headers = {
          "Content-Type": "application/json",
          Accept: "image/jpeg",
          Authorization: `Bearer ${
            useCredits ? process.env.FIREWORKS_API_KEY! : fireworksAPIKey!
          }`,
        };
      }
    }

    // If no apiUrl is found, throw an error
    if (!apiUrl) {
      throw new Error("Invalid model type");
    }

    // Send the request to the external API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: formData || JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Error from Image API: ${response.status} ${response.statusText}`
      );
    }

    // Handle image response based on model
    let imageData: ArrayBuffer;

    if (model === "dall-e") {
      const dalleResponse: DalleResponse =
        (await response.json()) as DalleResponse;
      const imageUrl = dalleResponse.data[0].url;
      imageData = await fetch(imageUrl).then((res) => res.arrayBuffer());
    } else {
      imageData = await response.arrayBuffer();
    }

    const finalImage = Buffer.from(imageData);

    // Save the generated image to Firebase
    const fileName = `generated/${uid}/${Date.now()}.jpg`;
    const file = adminBucket.file(fileName);

    await file.save(finalImage, {
      contentType: "image/jpeg",
    });

    const metadata = {
      metadata: {
        prompt: message!,
      },
    };

    await file.setMetadata(metadata);

    const [imageUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-17-2125",
    });

    let imageReference;

    // Handle uploaded image reference
    if (img) {
      imageReference = Buffer.from(await img.arrayBuffer());

      const referenceFileName = `image-references/${uid}/${Date.now()}.jpg`;
      const referenceFile = adminBucket.file(referenceFileName);

      await referenceFile.save(imageReference, {
        contentType: "image/jpeg",
      });

      const [imageReferenceUrl] = await referenceFile.getSignedUrl({
        action: "read",
        expires: "03-17-2125",
      });

      imageReference = imageReferenceUrl;
    }

    return { imageUrl, imageReference };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error generating image:", errorMessage);
    throw new Error(errorMessage);
  }
}

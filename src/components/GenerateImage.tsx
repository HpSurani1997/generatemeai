/* eslint-disable @next/next/no-img-element */
"use client";

import TextareaAutosize from "react-textarea-autosize";
import { useAuthStore } from "@/zustand/useAuthStore";
import { db } from "@/firebase/firebaseClient";
import { Timestamp, collection, doc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { PromptDataType } from "@/types/promptdata";
import { artStyles } from "@/constants/artStyles";
import { selectStyles } from "@/constants/selectStyles";
import Select from "react-select";
import { PulseLoader } from "react-spinners";
import { generateImage } from "@/actions/generateImage";
import { generatePrompt } from "@/utils/promptUtils";

export default function GenerateImage() {
  const uid = useAuthStore((s) => s.uid);
  const [imagePrompt, setImagePrompt] = useState<string>("");
  const [imageStyle, setImageStyle] = useState<string>("");
  const [promptData, setPromptData] = useState<PromptDataType>({
    style: "",
    freestyle: "",
    downloadUrl: "",
    prompt: "",
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = useState<string>("");

  useEffect(() => {
    setPromptData((prevData) => ({
      ...prevData,
      style: "",
      freestyle: "",
    }));
  }, []);

  async function saveHistory(
    promptData: PromptDataType,
    prompt: string,
    downloadUrl: string
  ) {
    if (!uid) return;
    const coll = collection(db, "profiles", uid, "covers");
    const docRef = doc(coll);
    const p: PromptDataType = {
      ...promptData,
      downloadUrl: downloadUrl,
      prompt: prompt,
      id: docRef.id,
      timestamp: Timestamp.now(),
    };
    setPromptData(p);
    await setDoc(docRef, p);
  }

  const handleGenerateSDXL = async (e: React.FormEvent<HTMLButtonElement>) => {
    e.preventDefault();

    try {
      setLoading(true);
      const prompt: string = generatePrompt(imagePrompt, imageStyle);
      const response = await generateImage(prompt, uid);

      const downloadURL = response.imageUrl;
      if (!downloadURL) {
        throw new Error("Error generating image");
      }

      setGeneratedImage(downloadURL);
      await saveHistory(promptData, prompt, downloadURL);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error generating image:", error.message);
      } else {
        console.error("An unknown error occurred during image generation.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full p-4 bg-white">
      {/* Input Section */}
      <div className="flex flex-col w-full max-w-lg space-y-4">
        <TextareaAutosize
          autoFocus
          minRows={2}
          value={imagePrompt || ""}
          placeholder="Describe an image"
          onChange={(e) => setImagePrompt(e.target.value)}
          className="border-2 text-xl border-blue-500 bg-blue-100 rounded-md px-3 py-2 w-full"
        />
        <div>
          <div>Artistic Style (optional)</div>
          <Select
            isClearable={true}
            isSearchable={true}
            name="styles"
            onChange={(v) => setImageStyle(v ? v.value : "")}
            options={artStyles}
            styles={selectStyles}
          />
        </div>
        <button
          className="btn btn-blue h-10 flex items-center justify-center disabled:opacity-50"
          disabled={loading}
          onClick={(e) => {
            setPromptData({
              ...promptData,
              freestyle: imagePrompt,
              style: imageStyle,
            });
            handleGenerateSDXL(e);
          }}
        >
          {loading ? <PulseLoader color="#fff" size={12} /> : "Create Image"}
        </button>
      </div>

      {/* Generated Image Section */}
      <div className="w-full max-w-2xl mt-6">
        {generatedImage ? (
          <img
            className="object-cover w-full h-auto rounded-md"
            src={generatedImage}
            alt="Generated visualization"
          />
        ) : (
          <div className="text-gray-500 text-center">
            No image generated yet.
          </div>
        )}
      </div>
    </div>
  );
}
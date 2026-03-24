"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useLaunchStore } from "@/store/launch";
import { CreativeFile } from "@/lib/grouping";
import toast from "react-hot-toast";

/** Measure actual pixel dimensions from a File using browser APIs */
function measureDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
      img.src = url;
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
        URL.revokeObjectURL(url);
      };
      video.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
      video.preload = "metadata";
      video.src = url;
      video.load();
    } else {
      resolve({ width: 0, height: 0 });
    }
  });
}

export default function DropZone() {
  const addFiles = useLaunchStore((s) => s.addFiles);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true);
      const results: CreativeFile[] = [];

      for (let i = 0; i < accepted.length; i++) {
        const file = accepted[i];
        setProgress(`Uploading ${i + 1} / ${accepted.length}: ${file.name}`);

        // Measure dimensions in parallel with upload
        const [dims, uploadResult] = await Promise.all([
          measureDimensions(file),
          (async () => {
            const fd = new FormData();
            fd.append("files", file);
            try {
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              const data = await res.json();
              return data.uploaded?.[0] ?? null;
            } catch {
              toast.error(`Failed to upload ${file.name}`);
              return null;
            }
          })(),
        ]);

        if (uploadResult) {
          results.push({ ...uploadResult, width: dims.width, height: dims.height });
        }
      }

      addFiles(results);
      setUploading(false);
      setProgress(null);
      if (results.length) toast.success(`${results.length} file${results.length > 1 ? "s" : ""} uploaded`);
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "video/*": [] },
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
        ${isDragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30"}`}
    >
      <input {...getInputProps()} />
      <div className="text-4xl mb-3">🖼️</div>
      {uploading ? (
        <div>
          <div className="text-sm font-medium text-indigo-600 mb-1">{progress}</div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-indigo-500 h-1.5 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-indigo-600">Click to upload</span> or drag &amp; drop
          </p>
          <p className="text-xs text-gray-400 mt-1">Images &amp; videos · Auto-grouped by dimensions</p>
        </>
      )}
    </div>
  );
}

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
      const cleanup = (w: number, h: number) => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve({ width: w, height: h });
      };
      // Some large .mov files never fire onloadedmetadata — bail out after 4s
      const timer = setTimeout(() => cleanup(0, 0), 4000);
      video.onloadedmetadata = () => cleanup(video.videoWidth, video.videoHeight);
      video.onerror = () => cleanup(0, 0);
      video.preload = "metadata";
      video.src = url;
      video.load();
    } else {
      resolve({ width: 0, height: 0 });
    }
  });
}

/** Upload a file to Cloudinary using XHR (supports large files + real progress) */
function uploadToCloudinary(
  file: File,
  cloudName: string,
  apiKey: string,
  timestamp: string,
  signature: string,
  folder: string,
  onProgress: (pct: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const isVideo = file.type.startsWith("video/");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("timestamp", timestamp);
    fd.append("signature", signature);
    fd.append("folder", folder);
    fd.append("api_key", apiKey);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? "video" : "image"}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.secure_url) resolve(data);
        else reject(new Error(data.error?.message || "Upload failed"));
      } catch {
        reject(new Error(`Upload returned invalid response (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection and file size"));
    xhr.ontimeout = () => reject(new Error("Upload timed out — file may be too large"));
    xhr.timeout = 10 * 60 * 1000; // 10 minutes for large videos

    xhr.send(fd);
  });
}

export default function DropZone() {
  const addFiles = useLaunchStore((s) => s.addFiles);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true);
      const results: CreativeFile[] = [];

      // Get signature once for the whole batch
      const sigRes = await fetch("/api/upload/sign");
      const { timestamp, signature, folder, apiKey, cloudName } = await sigRes.json();

      for (let i = 0; i < accepted.length; i++) {
        const file = accepted[i];
        setProgress(`Uploading ${i + 1} / ${accepted.length}: ${file.name}`);
        setUploadPct(0);

        const [dims, uploadResult] = await Promise.all([
          measureDimensions(file),
          (async () => {
            try {
              const isVideo = file.type.startsWith("video/");
              const data = await uploadToCloudinary(
                file, cloudName, apiKey, String(timestamp), signature, folder,
                (pct) => setUploadPct(pct)
              );

              const fmtSize = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
              return {
                filename: data.public_id,
                originalName: file.name,
                url: data.secure_url,
                isVideo,
                sizeLabel: fmtSize(file.size),
              };
            } catch (e: any) {
              toast.error(`Failed to upload ${file.name}: ${e.message}`);
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
      setUploadPct(0);
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
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">{uploadPct}%</div>
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

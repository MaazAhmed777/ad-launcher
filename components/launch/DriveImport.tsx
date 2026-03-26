"use client";
import { useState, useEffect } from "react";
import { useLaunchStore } from "@/store/launch";
import { CreativeFile } from "@/lib/grouping";
import toast from "react-hot-toast";

/** Measure dimensions from a served URL (image or video) */
function measureFromUrl(url: string, isVideo: boolean): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (!isVideo) {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
    } else {
      const video = document.createElement("video");
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => resolve({ width: 0, height: 0 });
      video.preload = "metadata";
      video.src = url;
      video.load();
    }
  });
}

export default function DriveImport() {
  const [open, setOpen] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [folderId, setFolderId] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const addFiles = useLaunchStore((s) => s.addFiles);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("drive_code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      exchangeCode(code);
      setOpen(true);
    }
    const saved = sessionStorage.getItem("drive_token");
    if (saved) { setDriveToken(saved); setOpen(true); }
  }, []);

  async function exchangeCode(code: string) {
    const res = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exchange", code }),
    });
    const d = await res.json();
    if (d.access_token) {
      setDriveToken(d.access_token);
      sessionStorage.setItem("drive_token", d.access_token);
      toast.success("Google Drive connected");
    } else {
      toast.error("Drive auth failed — try reconnecting");
    }
  }

  async function connectDrive() {
    const res = await fetch("/api/drive?action=auth");
    const d = await res.json();
    window.location.href = d.url;
  }

  async function browseFolder() {
    if (!driveToken || !folderId.trim()) {
      toast.error("Enter a folder ID first");
      return;
    }
    setBrowsing(true);
    try {
      // URL-encode the token so special chars (+, /, =) don't break the query string
      const res = await fetch(
        `/api/drive?action=list&folderId=${encodeURIComponent(folderId.trim())}&token=${encodeURIComponent(driveToken)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) {
        toast.error(`Drive error: ${d.error}`);
        console.error("Drive list error details:", d.details);
        return;
      }
      setFiles(d.files || []);
      if (!d.files?.length) toast("No supported files found in this folder");
    } catch (e: any) {
      toast.error(`Browse failed: ${e.message}`);
    } finally {
      setBrowsing(false);
    }
  }

  async function importSelected() {
    if (!selected.size) return;
    setImporting(true);
    const toImport = files.filter((f) => selected.has(f.id));
    const results: CreativeFile[] = [];

    // Get Cloudinary signature once for the batch
    const sigRes = await fetch("/api/upload/sign");
    const { timestamp, signature, folder, apiKey, cloudName } = await sigRes.json();

    for (const file of toImport) {
      try {
        const isVideo = file.mimeType?.startsWith("video/");

        // Download from Drive via our API (server-side, no size limit issue here)
        const driveRes = await fetch("/api/drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "download", fileId: file.id, driveToken }),
        });
        if (!driveRes.ok) throw new Error(`Drive download failed: HTTP ${driveRes.status}`);
        const blob = await driveRes.blob();

        // Upload directly to Cloudinary from browser
        const fd = new FormData();
        fd.append("file", blob, file.name);
        fd.append("timestamp", String(timestamp));
        fd.append("signature", signature);
        fd.append("folder", folder);
        fd.append("api_key", apiKey);

        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? "video" : "image"}/upload`,
          { method: "POST", body: fd }
        );
        const d = await cloudRes.json();
        if (!d.secure_url) throw new Error(d.error?.message || "Cloudinary upload failed");

        const fmtSize = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
        const uploaded = { filename: d.public_id, originalName: file.name, url: d.secure_url, isVideo, sizeLabel: fmtSize(blob.size) };
        const dims = await measureFromUrl(uploaded.url, uploaded.isVideo);
        results.push({ ...uploaded, width: dims.width, height: dims.height });
      } catch (e: any) {
        toast.error(`Failed: ${file.name} — ${e.message}`);
      }
    }

    if (results.length) {
      addFiles(results);
      toast.success(`${results.length} file${results.length !== 1 ? "s" : ""} imported`);
    } else {
      toast.error("No files were imported");
    }
    setSelected(new Set());
    setImporting(false);
  }

  function toggleAll() {
    if (selected.size === files.length) setSelected(new Set());
    else setSelected(new Set(files.map((f) => f.id)));
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-500 hover:text-indigo-600 font-medium flex items-center gap-1"
      >
        ☁️ Import from Google Drive
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Google Drive Import</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      {!driveToken ? (
        <button
          onClick={connectDrive}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:border-indigo-400 hover:text-indigo-700 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L28 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="M43.65 25L29.4 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A9.06 9.06 0 000 53h28z" fill="#00ac47"/>
            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H59.3l5.9 13.35z" fill="#ea4335"/>
            <path d="M43.65 25L57.9 0H29.4z" fill="#00832d"/>
            <path d="M59.3 53H87.3L73.55 29.5H45.5z" fill="#2684fc"/>
            <path d="M28 53L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.1-.45 4.5-1.2L59.3 53z" fill="#ffba00"/>
          </svg>
          Connect Google Drive
        </button>
      ) : (
        <>
          <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg">
            <span>✓</span> Google Drive connected
            <button
              onClick={() => { setDriveToken(null); sessionStorage.removeItem("drive_token"); setFiles([]); }}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              Disconnect
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-gray-400">
              Get the folder ID from the Drive URL: drive.google.com/drive/folders/<strong>THIS_PART</strong>
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 outline-none"
                placeholder="Paste folder ID here"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && browseFolder()}
              />
              <button
                onClick={browseFolder}
                disabled={browsing}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {browsing ? "…" : "Browse"}
              </button>
            </div>
          </div>

          {files.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{files.length} files found</span>
                <button onClick={toggleAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  {selected.size === files.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-1">
                {files.map((f) => {
                  const isVideo = f.mimeType?.startsWith("video/");
                  return (
                    <label key={f.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(f.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const n = new Set(prev);
                            n.has(f.id) ? n.delete(f.id) : n.add(f.id);
                            return n;
                          })
                        }
                        className="rounded border-gray-300 text-indigo-600"
                      />
                      <span className="text-sm">{isVideo ? "🎬" : "🖼️"}</span>
                      <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>

              {selected.size > 0 && (
                <button
                  onClick={importSelected}
                  disabled={importing}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importing ? "Importing…" : `Import ${selected.size} file${selected.size !== 1 ? "s" : ""}`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

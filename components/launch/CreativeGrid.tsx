"use client";
import { useState, useRef, useEffect } from "react";
import { useLaunchStore } from "@/store/launch";
import { CTA_OPTIONS } from "@/lib/meta";
import { AdRow, CreativeFile } from "@/lib/grouping";

const RATIO_COLORS: Record<string, string> = {
  "9:16":  "bg-purple-100 text-purple-700",
  "4:5":   "bg-blue-100 text-blue-700",
  "1:1":   "bg-green-100 text-green-700",
  "16:9":  "bg-orange-100 text-orange-700",
  "4:3":   "bg-yellow-100 text-yellow-700",
  "2:3":   "bg-pink-100 text-pink-700",
  "unknown": "bg-gray-100 text-gray-500",
};

/** Capture first frame of a video as a data URL using canvas */
function VideoThumb({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const capture = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || !video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setThumbUrl(canvas.toDataURL("image/jpeg", 0.85));
    };

    video.addEventListener("seeked", capture);
    const onMeta = () => { video.currentTime = 0.1; };
    video.addEventListener("loadedmetadata", onMeta);
    video.load();

    return () => {
      video.removeEventListener("seeked", capture);
      video.removeEventListener("loadedmetadata", onMeta);
    };
  }, [src]);

  return (
    <>
      <video ref={videoRef} src={src} muted preload="metadata" className="hidden" crossOrigin="anonymous" />
      <canvas ref={canvasRef} className="hidden" />
      {thumbUrl ? (
        <img src={thumbUrl} alt="video thumbnail" className={className} />
      ) : (
        <div className={`flex items-center justify-center bg-gray-800 text-white ${className}`}>
          <span className="text-2xl">▶</span>
        </div>
      )}
    </>
  );
}

/** Lightbox for full-size preview */
function Lightbox({ creative, onClose }: { creative: CreativeFile; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-3xl leading-none hover:text-gray-300"
        >×</button>
        {creative.isVideo ? (
          <video
            src={creative.url}
            controls
            autoPlay
            muted
            className="max-h-[80vh] max-w-full rounded-xl shadow-2xl"
          />
        ) : (
          <img
            src={creative.url}
            alt={creative.originalName}
            className="max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain"
          />
        )}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-white text-xs opacity-70">{creative.originalName}</span>
          {creative.width && creative.height && (
            <span className="text-white text-xs opacity-50">{creative.width} × {creative.height}px</span>
          )}
          {creative.aspectRatio && creative.aspectRatio !== "unknown" && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${RATIO_COLORS[creative.aspectRatio] ?? RATIO_COLORS.unknown}`}>
              {creative.aspectRatio}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CreativeThumb({ creative }: { creative: CreativeFile }) {
  const [lightbox, setLightbox] = useState(false);
  const ratioClass = RATIO_COLORS[creative.aspectRatio || "unknown"] ?? RATIO_COLORS.unknown;

  // Compute card aspect ratio for the thumbnail container
  const cssAspect =
    creative.aspectRatio === "9:16" ? "aspect-[9/16]" :
    creative.aspectRatio === "4:5"  ? "aspect-[4/5]" :
    creative.aspectRatio === "16:9" ? "aspect-[16/9]" :
    creative.aspectRatio === "4:3"  ? "aspect-[4/3]" :
    creative.width && creative.height
      ? undefined
      : "aspect-square";

  const inlineStyle =
    !cssAspect && creative.width && creative.height
      ? { aspectRatio: `${creative.width}/${creative.height}` }
      : undefined;

  return (
    <>
      <div
        className={`group relative cursor-pointer rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200 hover:border-indigo-400 transition-all w-20 ${cssAspect ?? ""}`}
        style={inlineStyle}
        onClick={() => setLightbox(true)}
        title={`${creative.originalName}${creative.width ? ` · ${creative.width}×${creative.height}` : ""}`}
      >
        {creative.isVideo ? (
          <VideoThumb src={creative.url} className="w-full h-full object-cover" />
        ) : (
          <img src={creative.url} alt={creative.originalName} className="w-full h-full object-cover" />
        )}

        {/* Ratio badge */}
        {creative.aspectRatio && creative.aspectRatio !== "unknown" && (
          <span className={`absolute top-1 left-1 text-[9px] font-bold px-1 py-0.5 rounded leading-none ${ratioClass}`}>
            {creative.aspectRatio}
          </span>
        )}

        {/* Video badge */}
        {creative.isVideo && (
          <span className="absolute top-1 right-1 text-[9px] font-bold bg-black/60 text-white px-1 py-0.5 rounded leading-none">
            VID
          </span>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-white text-xs font-medium bg-black/60 px-2 py-1 rounded">Preview</span>
        </div>
      </div>

      {lightbox && <Lightbox creative={creative} onClose={() => setLightbox(false)} />}
    </>
  );
}

function AdCard({ row }: { row: AdRow }) {
  const updateRow = useLaunchStore((s) => s.updateRow);
  const removeRow = useLaunchStore((s) => s.removeRow);
  const adSets = useLaunchStore((s) => s.adSets);
  const selectedRowIds = useLaunchStore((s) => s.selectedRowIds);
  const toggleRowSelection = useLaunchStore((s) => s.toggleRowSelection);
  const [expanded, setExpanded] = useState(false);

  const isSelected = selectedRowIds.includes(row.id);

  const ratios = row.creatives
    .map((c) => c.aspectRatio)
    .filter((r) => r && r !== "unknown");

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${isSelected ? "border-indigo-400 ring-1 ring-indigo-300" : "border-gray-200 hover:border-gray-300 opacity-60"}`}>
      {/* Selection checkbox + Thumbnails */}
      <div className="p-3 bg-gray-50 border-b border-gray-100 min-h-[100px]">
        <div className="flex items-start justify-between mb-2">
          <button
            onClick={() => toggleRowSelection(row.id)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
              isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"
            }`}
          >
            {isSelected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
          </button>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {row.creatives.map((c) => (
            <CreativeThumb key={c.filename} creative={c} />
          ))}
        </div>
        {row.creatives.length > 1 && ratios.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-2">
            {row.creatives.length} variants · {ratios.join(" · ")}
          </p>
        )}
      </div>

      {/* Name + controls */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 text-xs font-medium border border-transparent rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none focus:bg-white bg-transparent min-w-0"
            value={row.name}
            onChange={(e) => updateRow(row.id, { name: e.target.value })}
            placeholder="Ad name"
          />
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-400 hover:text-indigo-600 font-medium shrink-0"
          >
            {expanded ? "Less ▲" : "Edit copy ▼"}
          </button>
          <button
            onClick={() => removeRow(row.id)}
            className="text-gray-300 hover:text-red-500 text-lg leading-none shrink-0"
          >×</button>
        </div>

        {/* Per-row URL override */}
        <input
          className="w-full text-[11px] border border-transparent rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none focus:bg-white bg-transparent text-gray-400"
          value={row.destinationUrl}
          onChange={(e) => updateRow(row.id, { destinationUrl: e.target.value })}
          placeholder="URL override (uses global if blank)"
          type="url"
        />

        {/* Expanded copy fields */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <textarea
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 focus:outline-none resize-none"
              rows={2}
              value={row.primaryText}
              onChange={(e) => updateRow(row.id, { primaryText: e.target.value })}
              placeholder="Primary text…"
            />
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 focus:outline-none"
                value={row.headline}
                onChange={(e) => updateRow(row.id, { headline: e.target.value })}
                placeholder="Headline"
              />
              <select
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 focus:outline-none cursor-pointer"
                value={row.cta}
                onChange={(e) => updateRow(row.id, { cta: e.target.value })}
              >
                {CTA_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            {adSets.length > 0 && (
              <select
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 focus:outline-none cursor-pointer"
                value={row.adSetId}
                onChange={(e) => updateRow(row.id, { adSetId: e.target.value })}
              >
                <option value="">— Ad Set override —</option>
                {adSets.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreativeGrid() {
  const rows = useLaunchStore((s) => s.rows);
  const removeRow = useLaunchStore((s) => s.removeRow);
  const selectedRowIds = useLaunchStore((s) => s.selectedRowIds);
  const selectAllRows = useLaunchStore((s) => s.selectAllRows);
  const deselectAllRows = useLaunchStore((s) => s.deselectAllRows);
  const groupCreativesEnabled = useLaunchStore((s) => s.groupCreativesEnabled);
  const toggleGroupCreatives = useLaunchStore((s) => s.toggleGroupCreatives);

  if (!rows.length) return null;

  const totalCreatives = rows.reduce((n, r) => n + r.creatives.length, 0);
  const allSelected = selectedRowIds.length === rows.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          {groupCreativesEnabled ? "Grouped Creatives" : "Creatives"}
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleGroupCreatives}
            className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border transition-all ${
              groupCreativesEnabled
                ? "bg-indigo-50 border-indigo-300 text-indigo-600"
                : "bg-gray-100 border-gray-300 text-gray-500"
            }`}
            title={groupCreativesEnabled ? "Creatives are grouped by concept — click to separate" : "Creatives are separate — click to group"}
          >
            <span>{groupCreativesEnabled ? "⊞" : "⊟"}</span>
            <span>{groupCreativesEnabled ? "Grouped" : "Ungrouped"}</span>
          </button>
          <span className="text-xs text-gray-400">
            {rows.length} {groupCreativesEnabled ? `group${rows.length !== 1 ? "s" : ""}` : `ad${rows.length !== 1 ? "s" : ""}`} · {totalCreatives} creative{totalCreatives !== 1 ? "s" : ""}
            {selectedRowIds.length < rows.length && (
              <span className="text-indigo-600 font-medium"> · {selectedRowIds.length} selected</span>
            )}
          </span>
          <button
            onClick={allSelected ? deselectAllRows : selectAllRows}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <button
            onClick={() => rows.forEach((r) => removeRow(r.id))}
            className="text-xs text-red-400 hover:text-red-600 font-medium"
          >
            Clear all
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => (
          <AdCard key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}

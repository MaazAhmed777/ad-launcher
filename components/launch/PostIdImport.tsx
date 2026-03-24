"use client";
import { useState } from "react";
import { useLaunchStore } from "@/store/launch";
import toast from "react-hot-toast";

export default function PostIdImport() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [postId, setPostId] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulkAds, setBulkAds] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const accountId = useLaunchStore(s => s.accountId);
  const addFiles = useLaunchStore(s => s.addFiles);
  const rows = useLaunchStore(s => s.rows);
  const setRows = useLaunchStore(s => s.setRows);

  async function fetchPost() {
    if (!postId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/post-id?postId=${postId.trim()}`);
      const data = await res.json();
      if (data.error) { toast.error(data.error.message || "Not found"); setLoading(false); return; }
      const attach = data.attachments?.data?.[0];
      const imageUrl = attach?.media?.image?.src;
      const text = data.message || data.story || "";
      // Load into a new row
      const newRow = {
        id: crypto.randomUUID(),
        baseName: postId,
        creatives: imageUrl ? [{ filename: postId, originalName: `post_${postId}`, url: imageUrl, isVideo: false, sizeLabel: "" }] : [],
        name: `Post ${postId}`,
        primaryText: text,
        headline: attach?.title || "",
        cta: "LEARN_MORE",
        destinationUrl: attach?.url || "",
        displayUrl: "",
        utmParams: "",
        adSetId: "",
      };
      setRows([...rows, newRow]);
      toast.success("Post loaded into table");
      setPostId("");
    } catch { toast.error("Failed to fetch post"); }
    setLoading(false);
  }

  async function fetchBulkAds(after?: string) {
    if (!accountId) { toast.error("Select an ad account first"); return; }
    setLoading(true);
    const res = await fetch("/api/post-id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, after }),
    });
    const data = await res.json();
    setBulkAds(prev => after ? [...prev, ...(data.data || [])] : (data.data || []));
    setCursor(data.paging?.cursors?.after || null);
    setLoading(false);
  }

  function loadAd(ad: any) {
    const creative = ad.creative || {};
    const spec = creative.object_story_spec || {};
    const linkData = spec.link_data || spec.video_data || {};
    const newRow = {
      id: crypto.randomUUID(),
      baseName: ad.name,
      creatives: creative.thumbnail_url
        ? [{ filename: ad.id, originalName: ad.name, url: creative.thumbnail_url, isVideo: !!spec.video_data, sizeLabel: "" }]
        : [],
      name: ad.name,
      primaryText: linkData.message || "",
      headline: linkData.name || linkData.title || "",
      cta: linkData.call_to_action?.type || "LEARN_MORE",
      destinationUrl: linkData.link || "",
      displayUrl: "",
      utmParams: "",
      adSetId: ad.adset_id || "",
    };
    setRows([...rows, newRow]);
    toast.success(`"${ad.name}" loaded`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gray-500 hover:text-indigo-600 font-medium flex items-center gap-1">
        📌 Import from Post ID or Existing Ads
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Import Existing Content</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <div className="flex gap-2">
        {(["single", "bulk"] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); if (m === "bulk") fetchBulkAds(); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-all
              ${mode === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-400"}`}>
            {m === "single" ? "By Post ID" : "Browse All Ads"}
          </button>
        ))}
      </div>

      {mode === "single" && (
        <div className="flex gap-2">
          <input
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 outline-none"
            placeholder="Paste Post ID (e.g. 123456789_987654321)"
            value={postId}
            onChange={e => setPostId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchPost()}
          />
          <button onClick={fetchPost} disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      )}

      {mode === "bulk" && (
        <div>
          {loading && bulkAds.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">Loading ads…</div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {bulkAds.map(ad => (
                <div key={ad.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg group">
                  {ad.creative?.thumbnail_url && (
                    <img src={ad.creative.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0 bg-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{ad.name}</div>
                    <div className="text-xs text-gray-400">{ad.status} · ID: {ad.id}</div>
                  </div>
                  <button onClick={() => loadAd(ad)}
                    className="text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 flex-shrink-0">
                    Load →
                  </button>
                </div>
              ))}
              {cursor && (
                <button onClick={() => fetchBulkAds(cursor)} disabled={loading}
                  className="w-full text-xs text-indigo-600 py-2 hover:text-indigo-800 font-medium">
                  {loading ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

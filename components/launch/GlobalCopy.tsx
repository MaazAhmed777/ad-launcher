"use client";
import { useLaunchStore } from "@/store/launch";
import { CTA_OPTIONS } from "@/lib/meta";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function GlobalCopy() {
  const gc = useLaunchStore((s) => s.globalCopy);
  const setGlobalCopy = useLaunchStore((s) => s.setGlobalCopy);
  const applyGlobalCopy = useLaunchStore((s) => s.applyGlobalCopy);
  const disableEnhancements = useLaunchStore((s) => s.disableEnhancements);
  const toggleEnhancements = useLaunchStore((s) => s.toggleEnhancements);

  const [templates, setTemplates] = useState<any[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    fetch("/api/templates").then(r => r.json()).then(d => setTemplates(d.templates || []));
  }, []);

  async function saveTemplate() {
    if (!saveName.trim()) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: saveName, ...gc }),
    });
    const d = await res.json();
    setTemplates(prev => [d.template, ...prev]);
    setSaveName(""); setShowSave(false);
    toast.success("Template saved");
  }

  function applyTemplate(t: any) {
    setGlobalCopy({ primaryText: t.primaryText || "", headline: t.headline || "", cta: t.cta || "LEARN_MORE" });
    toast.success(`Applied "${t.name}"`);
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Global Ad Copy</h3>
        <div className="flex gap-2 items-center">
          {/* Enhancements toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={toggleEnhancements}
              className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${disableEnhancements ? "bg-orange-500" : "bg-gray-200"}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${disableEnhancements ? "left-4" : "left-0.5"}`} />
            </div>
            <span className="text-xs text-gray-500">Disable AI Enhancements</span>
          </label>
          <button
            onClick={() => setShowSave(!showSave)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >Save as Template</button>
          <button
            onClick={() => { applyGlobalCopy(); toast.success("Applied to all rows"); }}
            className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-indigo-700"
          >Apply to All</button>
        </div>
      </div>

      {/* Template picker */}
      {templates.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-1 bg-gray-100 rounded-full pl-2.5 pr-1 py-0.5">
              <button onClick={() => applyTemplate(t)} className="text-xs text-gray-700 hover:text-indigo-700 font-medium">{t.name}</button>
              <button onClick={() => deleteTemplate(t.id)} className="text-gray-400 hover:text-red-500 text-xs leading-none">×</button>
            </div>
          ))}
        </div>
      )}

      {showSave && (
        <div className="flex gap-2">
          <input
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:border-indigo-400 outline-none"
            placeholder="Template name…"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveTemplate()}
          />
          <button onClick={saveTemplate} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium">Save</button>
          <button onClick={() => setShowSave(false)} className="text-xs text-gray-500 px-2">Cancel</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Primary Text</label>
          <textarea
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:border-indigo-400 outline-none resize-none"
            rows={3}
            placeholder="Your ad message…"
            value={gc.primaryText}
            onChange={e => setGlobalCopy({ primaryText: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Headline</label>
          <input
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:border-indigo-400 outline-none"
            placeholder="Short headline"
            value={gc.headline}
            onChange={e => setGlobalCopy({ headline: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Call to Action</label>
          <select
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:border-indigo-400 outline-none cursor-pointer"
            value={gc.cta}
            onChange={e => setGlobalCopy({ cta: e.target.value })}
          >
            {CTA_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">UTM Parameters</label>
          <input
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:border-indigo-400 outline-none"
            placeholder="utm_source=meta&utm_medium=paid"
            value={gc.utmParams}
            onChange={e => setGlobalCopy({ utmParams: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

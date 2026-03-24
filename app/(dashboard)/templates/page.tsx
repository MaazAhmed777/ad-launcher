"use client";
import { useState, useEffect } from "react";
import { CTA_OPTIONS } from "@/lib/meta";
import toast from "react-hot-toast";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", primaryText: "", headline: "", cta: "LEARN_MORE" });

  useEffect(() => {
    fetch("/api/templates").then(r => r.json()).then(d => setTemplates(d.templates || []));
  }, []);

  async function save() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    if (editing) {
      const res = await fetch("/api/templates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...form }) });
      const d = await res.json();
      setTemplates(prev => prev.map(t => t.id === editing.id ? d.template : t));
      setEditing(null);
    } else {
      const res = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json();
      setTemplates(prev => [d.template, ...prev]);
      setCreating(false);
    }
    setForm({ name: "", primaryText: "", headline: "", cta: "LEARN_MORE" });
    toast.success("Saved");
  }

  async function del(id: string) {
    await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Deleted");
  }

  function startEdit(t: any) {
    setEditing(t);
    setForm({ name: t.name, primaryText: t.primaryText || "", headline: t.headline || "", cta: t.cta || "LEARN_MORE" });
    setCreating(false);
  }

  const showForm = creating || editing;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Ad Copy Templates</h1>
        <button onClick={() => { setCreating(true); setEditing(null); setForm({ name: "", primaryText: "", headline: "", cta: "LEARN_MORE" }); }}
          className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700">
          + New Template
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">{editing ? "Edit Template" : "New Template"}</h3>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Template Name</label>
            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 outline-none"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer Sale Copy" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Primary Text</label>
            <textarea className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 outline-none resize-none" rows={3}
              value={form.primaryText} onChange={e => setForm(f => ({ ...f, primaryText: e.target.value }))} placeholder="Ad body text…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Headline</label>
              <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 outline-none"
                value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} placeholder="Short headline" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">CTA</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 outline-none cursor-pointer"
                value={form.cta} onChange={e => setForm(f => ({ ...f, cta: e.target.value }))}>
                {CTA_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setEditing(null); setCreating(false); }} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
            <button onClick={save} className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-indigo-700">Save</button>
          </div>
        </div>
      )}

      {templates.length === 0 && !showForm ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3">💾</div>
          No templates yet — create your first one above
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                {t.primaryText && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.primaryText}</div>}
                <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                  {t.headline && <span>Headline: {t.headline}</span>}
                  {t.cta && <span>CTA: {t.cta.replace(/_/g, " ")}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => startEdit(t)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                <button onClick={() => del(t.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

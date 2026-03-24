"use client";
import { useState, useEffect } from "react";
import { useLaunchStore } from "@/store/launch";
import { OBJECTIVES } from "@/lib/meta";
import toast from "react-hot-toast";

export default function CampaignsPage() {
  const accountId = useLaunchStore(s => s.accountId);
  const adSets = useLaunchStore(s => s.adSets);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", objective: "OUTCOME_SALES", dailyBudget: "" });

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/campaigns?accountId=${accountId}`)
      .then(r => r.json())
      .then(d => { setCampaigns(d.data || []); setLoading(false); });
  }, [accountId]);

  async function createCampaign() {
    if (!form.name.trim() || !accountId) return;
    const res = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", accountId, ...form, dailyBudget: form.dailyBudget ? Math.round(parseFloat(form.dailyBudget) * 100) : undefined }),
    });
    const d = await res.json();
    if (d.id) { toast.success("Campaign created"); setShowCreate(false); setForm({ name: "", objective: "OUTCOME_SALES", dailyBudget: "" }); }
    else toast.error(d.error?.message || "Failed");
  }

  async function duplicateCampaign(camp: any) {
    const name = prompt("New campaign name:", `${camp.name} (copy)`);
    if (!name) return;
    const res = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate_campaign", accountId, campaignId: camp.id, newName: name }),
    });
    const d = await res.json();
    if (d.id) toast.success("Campaign duplicated");
    else toast.error(d.error?.message || "Failed");
  }

  async function duplicateAdSet(adSet: any) {
    const name = prompt("New ad set name:", `${adSet.name} (copy)`);
    if (!name) return;
    const res = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate_adset", accountId, adSetId: adSet.id, newName: name }),
    });
    const d = await res.json();
    if (d.id) toast.success("Ad set duplicated");
    else toast.error(d.error?.message || "Failed");
  }

  const objMap = Object.fromEntries(OBJECTIVES.map(o => [o.value, o]));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Campaigns & Ad Sets</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700">
          + New Campaign
        </button>
      </div>

      {!accountId && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-3xl mb-2">⚠️</div>
          Select an ad account from the top bar
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Campaign</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-xs font-medium text-gray-600 block mb-1">Name</label>
              <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 outline-none"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Campaign name" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Objective</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 outline-none cursor-pointer"
                value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}>
                {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Daily Budget (optional)</label>
              <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2 focus-within:border-indigo-400">
                <span className="text-gray-500 text-sm mr-1">$</span>
                <input className="flex-1 text-sm outline-none" type="number" min="1"
                  value={form.dailyBudget} onChange={e => setForm(f => ({ ...f, dailyBudget: e.target.value }))} placeholder="20" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
            <button onClick={createCampaign} className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-indigo-700">Create</button>
          </div>
        </div>
      )}

      {/* Campaigns table */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
      ) : campaigns.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Campaign</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Objective</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Budget</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map(c => {
                const obj = objMap[c.objective];
                const budget = c.daily_budget ? `$${(c.daily_budget / 100).toFixed(0)}/day` : c.lifetime_budget ? `$${(c.lifetime_budget / 100).toFixed(0)} lifetime` : "—";
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{obj ? `${obj.icon} ${obj.label}` : c.objective}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${c.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{budget}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => duplicateCampaign(c)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Duplicate</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : accountId ? (
        <div className="text-center py-10 text-gray-400 text-sm">No campaigns found</div>
      ) : null}

      {/* Ad sets section */}
      {adSets.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Ad Sets</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Ad Set</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Budget</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adSets.map((s: any) => {
                  const budget = s.daily_budget ? `$${(s.daily_budget / 100).toFixed(0)}/day` : s.lifetime_budget ? `$${(s.lifetime_budget / 100).toFixed(0)} lifetime` : "—";
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{budget}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => duplicateAdSet(s)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Duplicate</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

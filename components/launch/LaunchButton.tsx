"use client";
import { useLaunchStore } from "@/store/launch";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function LaunchButton() {
  const rows = useLaunchStore((s) => s.rows);
  const accountId = useLaunchStore((s) => s.accountId);
  const pageId = useLaunchStore((s) => s.pageId);
  const instagramAccountId = useLaunchStore((s) => s.instagramAccountId);
  const appId = useLaunchStore((s) => s.appId);
  const disableEnhancements = useLaunchStore((s) => s.disableEnhancements);
  const batchId = useLaunchStore((s) => s.batchId);
  const launchStatus = useLaunchStore((s) => s.launchStatus);
  const setBatchId = useLaunchStore((s) => s.setBatchId);
  const setLaunchStatus = useLaunchStore((s) => s.setLaunchStatus);

  const selectedAdSetIds = useLaunchStore((s) => s.selectedAdSetIds);
  const selectedRowIds = useLaunchStore((s) => s.selectedRowIds);
  const launchMode = useLaunchStore((s) => s.launchMode);
  const newCampaignBudget = useLaunchStore((s) => s.newCampaignBudget);
  const newCampaignObjective = useLaunchStore((s) => s.newCampaignObjective);
  const newCampaignName = useLaunchStore((s) => s.newCampaignName);
  const newAdSetName = useLaunchStore((s) => s.newAdSetName);
  const newBidStrategy = useLaunchStore((s) => s.newBidStrategy);
  const newBidAmount = useLaunchStore((s) => s.newBidAmount);
  const newOptimizationGoal = useLaunchStore((s) => s.newOptimizationGoal);
  const newCampaignBudgetEnabled = useLaunchStore((s) => s.newCampaignBudgetEnabled);
  const newCampaignLevelBudget = useLaunchStore((s) => s.newCampaignLevelBudget);
  const [launchAsActive, setLaunchAsActive] = useState(false);
  const [progress, setProgress] = useState<{ launched: number; total: number; done: boolean; logs: string[] }>({
    launched: 0, total: 0, done: false, logs: [],
  });

  const selectedRows = rows.filter((r) => selectedRowIds.includes(r.id));
  const totalAds = selectedRows.length;
  const globalAdSetId = selectedAdSetIds[0] || "";
  const isNew = launchMode === "new";
  const ready =
    selectedRows.length > 0 &&
    accountId &&
    pageId &&
    (isNew ? !!newCampaignBudget : (globalAdSetId || selectedRows.every((r) => r.adSetId)));

  useEffect(() => {
    if (!batchId || launchStatus !== "launching") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/launch?batchId=${batchId}`);
      const data = await res.json();
      const logs = data.ads?.map((a: any) =>
        a.status === "launched" ? `✓ ${a.name}` : `✕ ${a.name}: ${a.errorMessage}`
      ) || [];
      setProgress({ launched: data.launchedAds, total: data.totalAds, done: data.status === "done", logs });
      if (data.status === "done") {
        clearInterval(timer);
        setLaunchStatus("done");
        toast.success(`${data.launchedAds} ad${data.launchedAds !== 1 ? "s" : ""} launched!`);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [batchId, launchStatus]);

  async function testCreative() {
    if (!selectedRows.length || !accountId) return;
    const effectiveRows = selectedRows.map((r) => ({ ...r, adSetId: r.adSetId || globalAdSetId }));
    toast.loading("Testing creative…", { id: "test" });
    try {
      const res = await fetch("/api/launch/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, pageId, instagramAccountId, rows: effectiveRows }),
      });
      const data = await res.json();
      toast.dismiss("test");
      if (data.ok) {
        const ctaWarning = data.steps?.find((s: any) => s.step === "cta_warning");
        if (ctaWarning) toast(`⚠️ CTA changed to LEARN_MORE (DOWNLOAD requires App Store URL)`, { duration: 6000 });
        toast.success(`Creative OK — ID ${data.creativeId}`);
      } else {
        const err = data.metaError || {};
        const msg = err.error_user_msg || err.message || data.error || "Unknown error";
        const code = err.error_subcode || err.code || "";
        toast.error(`Meta error${code ? ` (${code})` : ""}: ${msg}`, { duration: 15000 });
        // Log full steps to browser console for debugging
        const createStep = data.steps?.find((s: any) => s.step === "create_creative");
        if (createStep) console.log("Creative payload:", createStep.sentPayload, "\nMeta response:", createStep.response);
        console.log("All steps:", JSON.stringify(data.steps, null, 2));
      }
    } catch (e: any) {
      toast.dismiss("test");
      toast.error(e.message);
    }
  }

  async function testAdStructure() {
    if (!selectedRows.length || !accountId) return;
    const effectiveRows = selectedRows.map((r) => ({ ...r, adSetId: r.adSetId || globalAdSetId }));
    const adSetId = effectiveRows[0]?.adSetId || globalAdSetId;
    toast.loading("Testing full ad structure…", { id: "testad" });
    try {
      const res = await fetch("/api/launch/test-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId, pageId, instagramAccountId, adSetId: adSetId || null, rows: effectiveRows,
          pixelId: useLaunchStore.getState().pixelId,
          conversionEvent: useLaunchStore.getState().conversionEvent,
          newCampaign: !adSetId && isNew ? { objective: newCampaignObjective, budget: newCampaignBudget || "1", bidStrategy: newBidStrategy, bidAmount: newBidAmount, optimizationGoal: newOptimizationGoal, campaignLevelBudget: newCampaignBudgetEnabled ? newCampaignLevelBudget : "" } : null,
        }),
      });
      const data = await res.json();
      toast.dismiss("testad");
      if (data.ok) {
        toast.success("Full ad structure OK — test ad created & deleted cleanly", { duration: 8000 });
      } else {
        const stoppedAt = data.stoppedAt || "unknown";
        const err = data.metaError || {};
        const msg = err.error_user_msg || err.message || data.error || "Unknown error";
        const code = err.error_subcode || err.code || "";
        toast.error(`Failed at [${stoppedAt}]${code ? ` (${code})` : ""}: ${msg}`, { duration: 15000 });
      }
      console.log("Ad structure test steps:", JSON.stringify(data.steps, null, 2));
    } catch (e: any) {
      toast.dismiss("testad");
      toast.error(e.message);
    }
  }

  async function launch() {
    if (!ready) return;
    setLaunchStatus("launching");
    setProgress({ launched: 0, total: totalAds, done: false, logs: [] });

    try {
      // Only launch selected rows; fill missing adSetId from global selection
      const effectiveRows = selectedRows.map((r) => ({
        ...r,
        adSetId: r.adSetId || globalAdSetId,
      }));
      const res = await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId, pageId, instagramAccountId, appId,
          pixelId: useLaunchStore.getState().pixelId,
          conversionEvent: useLaunchStore.getState().conversionEvent,
          rows: effectiveRows, disableEnhancements, launchAsActive,
          newCampaign: isNew ? { objective: newCampaignObjective, budget: newCampaignBudget, campaignName: newCampaignName, adSetName: newAdSetName, bidStrategy: newBidStrategy, bidAmount: newBidAmount, optimizationGoal: newOptimizationGoal, campaignLevelBudget: newCampaignBudgetEnabled ? newCampaignLevelBudget : "" } : null,
        }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); setLaunchStatus("error"); return; }
      setBatchId(data.batchId);
    } catch (e) {
      toast.error("Launch failed"); setLaunchStatus("error");
    }
  }

  return (
    <div>
      {launchStatus === "launching" || launchStatus === "done" ? (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">
              {launchStatus === "done" ? `✅ ${progress.launched} ads launched` : "Launching…"}
            </span>
            <span className="text-xs text-gray-500">{progress.launched} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: progress.total ? `${(progress.launched / progress.total) * 100}%` : "0%" }}
            />
          </div>
          <div className="max-h-36 overflow-y-auto text-xs space-y-0.5">
            {progress.logs.map((l, i) => (
              <div key={i} className={l.startsWith("✓") ? "text-green-700" : "text-red-600"}>{l}</div>
            ))}
          </div>
          {launchStatus === "done" && (
            <div className="flex gap-2">
              <a
                href="https://adsmanager.facebook.com"
                target="_blank"
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700"
              >View in Ads Manager ↗</a>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Paused / Active toggle */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <div>
              <span className="text-xs font-medium text-gray-700">Launch status</span>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {launchAsActive ? "Ads will go live immediately" : "Ads will be created as paused — enable in Ads Manager when ready"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium ${!launchAsActive ? "text-gray-700" : "text-gray-400"}`}>Paused</span>
              <button
                onClick={() => setLaunchAsActive(!launchAsActive)}
                className={`w-10 h-5 rounded-full transition-colors relative ${launchAsActive ? "bg-green-500" : "bg-gray-200"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${launchAsActive ? "left-5" : "left-0.5"}`} />
              </button>
              <span className={`text-xs font-medium ${launchAsActive ? "text-green-600" : "text-gray-400"}`}>Active</span>
            </div>
          </div>

          <button
            onClick={testCreative}
            disabled={!selectedRows.length || !accountId}
            className="w-full text-xs text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🔬 Test Creative (debug)
          </button>

          <button
            onClick={testAdStructure}
            disabled={!selectedRows.length || !accountId}
            className="w-full text-xs text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🧪 Test Ad Structure (debug)
          </button>

          <button
            onClick={launch}
            disabled={!ready}
            className={`w-full text-white rounded-xl py-3 text-sm font-bold transition-all
              disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5
              ${launchAsActive
                ? "bg-green-600 hover:bg-green-700 hover:shadow-green-200"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200"
              }`}
          >
            🚀 Launch {totalAds} Ad{totalAds !== 1 ? "s" : ""} {launchAsActive ? "· Active" : "· Paused"}
            {!ready && rows.length > 0 && (
              <span className="block text-xs font-normal opacity-70 mt-0.5">
                {!accountId ? "Connect an ad account" : !pageId ? "Select a Facebook page" : isNew ? "Enter a daily budget above" : "Select an ad set in Campaign Setup"}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

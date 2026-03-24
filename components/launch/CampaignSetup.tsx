"use client";
import { useState, useEffect, useCallback } from "react";
import { useLaunchStore } from "@/store/launch";
import { OBJECTIVES } from "@/lib/meta";

type Mode = "new" | "existing";

interface Assets {
  pages: any[];
  igAccounts: any[];
  pixels: any[];
  conversions: any[];
  apps: any[];
}

const EMPTY_ASSETS: Assets = { pages: [], igAccounts: [], pixels: [], conversions: [], apps: [] };

export default function CampaignSetup() {

  const [metaAccounts, setMetaAccounts] = useState<any[]>([]);
  const [assets, setAssets] = useState<Assets>(EMPTY_ASSETS);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadingAdSets, setLoadingAdSets] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  const accountId = useLaunchStore((s) => s.accountId);
  const setAccountId = useLaunchStore((s) => s.setAccountId);
  const pageId = useLaunchStore((s) => s.pageId);
  const setPageId = useLaunchStore((s) => s.setPageId);
  const instagramAccountId = useLaunchStore((s) => s.instagramAccountId);
  const setInstagramAccountId = useLaunchStore((s) => s.setInstagramAccountId);
  const appId = useLaunchStore((s) => s.appId);
  const setAppId = useLaunchStore((s) => s.setAppId);
  const pixelId = useLaunchStore((s) => s.pixelId);
  const setPixelId = useLaunchStore((s) => s.setPixelId);
  const conversionEvent = useLaunchStore((s) => s.conversionEvent);
  const setConversionEvent = useLaunchStore((s) => s.setConversionEvent);
  const selectedAdSetIds = useLaunchStore((s) => s.selectedAdSetIds);
  const setSelectedAdSetIds = useLaunchStore((s) => s.setSelectedAdSetIds);
  const adSets = useLaunchStore((s) => s.adSets);
  const setAdSets = useLaunchStore((s) => s.setAdSets);
  const globalCopy = useLaunchStore((s) => s.globalCopy);
  const setGlobalCopy = useLaunchStore((s) => s.setGlobalCopy);
  const launchMode = useLaunchStore((s) => s.launchMode);
  const setLaunchMode = useLaunchStore((s) => s.setLaunchMode);
  const newCampaignObjective = useLaunchStore((s) => s.newCampaignObjective);
  const newCampaignBudget = useLaunchStore((s) => s.newCampaignBudget);
  const newCampaignName = useLaunchStore((s) => s.newCampaignName);
  const newAdSetName = useLaunchStore((s) => s.newAdSetName);
  const newBidStrategy = useLaunchStore((s) => s.newBidStrategy);
  const newBidAmount = useLaunchStore((s) => s.newBidAmount);
  const newOptimizationGoal = useLaunchStore((s) => s.newOptimizationGoal);
  const newCampaignBudgetEnabled = useLaunchStore((s) => s.newCampaignBudgetEnabled);
  const newCampaignLevelBudget = useLaunchStore((s) => s.newCampaignLevelBudget);
  const setNewCampaignParams = useLaunchStore((s) => s.setNewCampaignParams);

  const isAppCampaign = newCampaignObjective === "OUTCOME_APP_PROMOTION";

  // Load connected ad accounts
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => {
        const accs = d.accounts || [];
        setMetaAccounts(accs);
        const active = accs.find((a: any) => a.isActive);
        if (active && !accountId) setAccountId(active.accountId);
      });
  }, []);

  // Load all assets when account changes
  const loadAssets = useCallback(async (actId: string, pgId?: string) => {
    if (!actId) return;
    setLoadingAssets(true);
    try {
      const url = `/api/meta-assets?accountId=${actId}${pgId ? `&pageId=${pgId}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setAssets(data);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    if (accountId) {
      loadAssets(accountId);
      loadCampaigns(accountId);
    }
  }, [accountId]);

  async function loadAdSets(actId: string, campaignId?: string) {
    if (!actId) return;
    setLoadingAdSets(true);
    try {
      const url = `/api/adsets?accountId=${actId}`;
      const res = await fetch(url);
      const data = await res.json();
      const all: any[] = data.data || [];
      // If a campaign is selected, filter to its ad sets
      setAdSets(campaignId ? all.filter((s) => s.campaign_id === campaignId) : all);
    } finally {
      setLoadingAdSets(false);
    }
  }

  async function loadCampaigns(actId: string) {
    if (!actId) return;
    try {
      const res = await fetch(`/api/campaigns?accountId=${actId}`);
      const data = await res.json();
      setCampaigns(data.data || []);
    } catch { /* silently fail */ }
  }

  function handleCampaignSelect(campaignId: string) {
    setSelectedCampaignId(campaignId);
    setSelectedAdSetIds([]);
    setAdSets([]);
    if (accountId && campaignId) loadAdSets(accountId, campaignId);
  }

  // Reload IG accounts when page changes
  useEffect(() => {
    if (accountId && pageId) loadAssets(accountId, pageId);
    setInstagramAccountId("");
  }, [pageId]);

  async function switchAccount(actId: string) {
    // Update active in DB
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: actId }),
    });
    setAccountId(actId);
    setPageId("");
    setInstagramAccountId("");
    setPixelId("");
    setConversionEvent("");
    setAppId("");
    setAdSets([]);
    setSelectedAdSetIds([]);
    setCampaigns([]);
    setSelectedCampaignId("");
  }

  const inp = "w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:border-indigo-400 outline-none bg-white";
  const lbl = "text-xs font-medium text-gray-600 mb-1 block";
  const sel = `${inp} cursor-pointer`;

  const Skeleton = () => <div className="w-full h-8 bg-gray-100 rounded-lg animate-pulse" />;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Campaign Setup</h3>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => { setLaunchMode("new"); }}
            className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${launchMode === "new" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            New Campaign
          </button>
          <button onClick={() => { setLaunchMode("existing"); }}
            className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${launchMode === "existing" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Use Existing
          </button>
        </div>
      </div>

      {/* ── Ad Account (always) ── */}
      <div>
        <label className={lbl}>Ad Account</label>
        {metaAccounts.length > 1 ? (
          <select className={sel} value={accountId} onChange={(e) => switchAccount(e.target.value)}>
            {metaAccounts.map((a: any) => (
              <option key={a.accountId} value={a.accountId}>{a.name}</option>
            ))}
          </select>
        ) : (
          <div className="text-xs border border-gray-200 rounded-lg px-2.5 py-2 text-gray-500 bg-gray-50">
            {metaAccounts[0]?.name || "Connect Meta to load accounts"}
          </div>
        )}
      </div>

      {/* ── New Campaign ── */}
      {launchMode === "new" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Campaign Name</label>
            <input className={inp} placeholder="e.g. Q2 2026 — Brand Awareness"
              value={newCampaignName}
              onChange={(e) => setNewCampaignParams({ campaignName: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Ad Set Name</label>
            <input className={inp} placeholder="e.g. US — 25-44 — Interests"
              value={newAdSetName}
              onChange={(e) => setNewCampaignParams({ adSetName: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Objective</label>
            <select className={sel} value={newCampaignObjective}
              onChange={(e) => setNewCampaignParams({ objective: e.target.value })}>
              {OBJECTIVES.map((o) => (
                <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className={lbl} style={{marginBottom: 0}}>Budget</label>
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span className={!newCampaignBudgetEnabled ? "font-semibold text-gray-700" : ""}>Ad Set</span>
                <button
                  type="button"
                  onClick={() => setNewCampaignParams({ campaignBudgetEnabled: !newCampaignBudgetEnabled })}
                  className={`w-8 h-4 rounded-full transition-colors relative ${newCampaignBudgetEnabled ? "bg-indigo-500" : "bg-gray-200"}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${newCampaignBudgetEnabled ? "left-4" : "left-0.5"}`} />
                </button>
                <span className={newCampaignBudgetEnabled ? "font-semibold text-indigo-600" : ""}>Campaign (CBO)</span>
              </div>
            </div>
            {newCampaignBudgetEnabled ? (
              <input className={inp} type="number" min="1" placeholder="Campaign daily budget ($)"
                value={newCampaignLevelBudget}
                onChange={(e) => setNewCampaignParams({ campaignLevelBudget: e.target.value })} />
            ) : (
              <input className={inp} type="number" min="1" placeholder="Ad set daily budget ($)"
                value={newCampaignBudget}
                onChange={(e) => setNewCampaignParams({ budget: e.target.value })} />
            )}
          </div>
          <div>
            <label className={lbl}>Optimization Goal</label>
            <select className={sel} value={newOptimizationGoal}
              onChange={(e) => setNewCampaignParams({ optimizationGoal: e.target.value })}>
              <option value="REACH">Reach</option>
              <option value="IMPRESSIONS">Impressions</option>
              <option value="LINK_CLICKS">Link Clicks</option>
              <option value="LANDING_PAGE_VIEWS">Landing Page Views</option>
              <option value="APP_INSTALLS">App Installs</option>
              <option value="OFFSITE_CONVERSIONS">Conversions</option>
              <option value="VALUE">Value (ROAS)</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Bid Strategy</label>
            <select className={sel} value={newBidStrategy}
              onChange={(e) => setNewCampaignParams({ bidStrategy: e.target.value, bidAmount: "" })}>
              <option value="LOWEST_COST_WITHOUT_CAP">Lowest Cost</option>
              <option value="COST_CAP">Cost Cap (CPA)</option>
              <option value="LOWEST_COST_WITH_BID_CAP">Bid Cap</option>
              <option value="MINIMUM_ROAS">Minimum ROAS</option>
            </select>
          </div>
          {(newBidStrategy === "COST_CAP" || newBidStrategy === "LOWEST_COST_WITH_BID_CAP") && (
            <div>
              <label className={lbl}>{newBidStrategy === "COST_CAP" ? "Target CPA ($)" : "Max Bid ($)"} <span className="text-gray-400 font-normal">(leave blank → Lowest Cost)</span></label>
              <input className={inp} type="number" min="0.01" step="0.01" placeholder="Leave blank for automatic"
                value={newBidAmount}
                onChange={(e) => setNewCampaignParams({ bidAmount: e.target.value })} />
            </div>
          )}
          {newBidStrategy === "MINIMUM_ROAS" && (
            <div>
              <label className={lbl}>Min ROAS (e.g. 1.5) <span className="text-gray-400 font-normal">(leave blank → Lowest Cost)</span></label>
              <input className={inp} type="number" min="0.01" step="0.01" placeholder="Leave blank for automatic"
                value={newBidAmount}
                onChange={(e) => setNewCampaignParams({ bidAmount: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {/* ── Use Existing: Campaign → Ad Set ── */}
      {launchMode === "existing" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Campaign</label>
            {campaigns.length > 0 ? (
              <select className={sel} value={selectedCampaignId}
                onChange={(e) => handleCampaignSelect(e.target.value)}>
                <option value="">— Select Campaign —</option>
                {campaigns.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <div className="text-xs border border-gray-200 rounded-lg px-2.5 py-2 text-gray-400 bg-gray-50">
                {accountId ? "Loading campaigns…" : "Select an account first"}
              </div>
            )}
          </div>
          <div>
            <label className={lbl}>Ad Set</label>
            {loadingAdSets ? (
              <div className="w-full h-8 bg-gray-100 rounded-lg animate-pulse" />
            ) : adSets.length > 0 ? (
              <select className={sel} value={selectedAdSetIds[0] || ""}
                onChange={(e) => setSelectedAdSetIds(e.target.value ? [e.target.value] : [])}>
                <option value="">— Select Ad Set —</option>
                {adSets.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <div className="text-xs border border-gray-200 rounded-lg px-2.5 py-2 text-gray-400 bg-gray-50">
                {selectedCampaignId ? "No ad sets found" : "Select a campaign first"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Divider ── */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Ad Identity &amp; Tracking</p>

        <div className="grid grid-cols-2 gap-3">
          {/* Facebook Page */}
          <div>
            <label className={lbl}>Facebook Page</label>
            {loadingAssets ? <Skeleton /> : assets.pages.length > 0 ? (
              <select className={sel} value={pageId}
                onChange={(e) => setPageId(e.target.value)}>
                <option value="">— Select Page —</option>
                {assets.pages.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <input className={inp} placeholder={accountId ? "No pages found" : "Select an ad account first"}
                value={pageId} onChange={(e) => setPageId(e.target.value)} />
            )}
          </div>

          {/* Instagram Account */}
          <div>
            <label className={lbl}>Instagram Account</label>
            {loadingAssets ? <Skeleton /> : assets.igAccounts.length > 0 ? (
              <select className={sel} value={instagramAccountId}
                onChange={(e) => setInstagramAccountId(e.target.value)}>
                <option value="">— Select Instagram —</option>
                {assets.igAccounts.map((ig: any) => (
                  <option key={ig.id} value={ig.id}>@{ig.username}</option>
                ))}
              </select>
            ) : (
              <input className={inp}
                placeholder={pageId ? "No Instagram linked" : "Select a page first"}
                value={instagramAccountId} onChange={(e) => setInstagramAccountId(e.target.value)} />
            )}
          </div>

          {/* Pixel */}
          <div>
            <label className={lbl}>Pixel / Data Source</label>
            {loadingAssets ? <Skeleton /> : assets.pixels.length > 0 ? (
              <select className={sel} value={pixelId} onChange={(e) => setPixelId(e.target.value)}>
                <option value="">— Select Pixel —</option>
                {assets.pixels.map((px: any) => <option key={px.id} value={px.id}>{px.name} ({px.id})</option>)}
              </select>
            ) : (
              <input className={inp} placeholder={accountId ? "No pixels found" : "Select an ad account first"}
                value={pixelId} onChange={(e) => setPixelId(e.target.value)} />
            )}
          </div>

          {/* Conversion Event */}
          <div>
            <label className={lbl}>Conversion Event</label>
            {loadingAssets ? <Skeleton /> : (
              <select className={sel} value={conversionEvent} onChange={(e) => setConversionEvent(e.target.value)}>
                <option value="">— Select Event —</option>
                {assets.conversions.filter((c: any) => c.type === "standard").length > 0 && (
                  <optgroup label="Standard Events">
                    {assets.conversions
                      .filter((c: any) => c.type === "standard")
                      .map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
                {assets.conversions.filter((c: any) => c.type === "custom").length > 0 && (
                  <optgroup label="Custom Conversions">
                    {assets.conversions
                      .filter((c: any) => c.type === "custom")
                      .map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
              </select>
            )}
          </div>

          {/* App — only for app campaigns */}
          {isAppCampaign && (
            <div className="col-span-2">
              <label className={lbl}>App</label>
              {loadingAssets ? <Skeleton /> : assets.apps.length > 0 ? (
                <select className={sel} value={appId} onChange={(e) => setAppId(e.target.value)}>
                  <option value="">— Select App —</option>
                  {assets.apps.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : (
                <input className={inp} placeholder="App Store URL or App ID"
                  value={appId} onChange={(e) => setAppId(e.target.value)} />
              )}
            </div>
          )}

          {/* Destination URL — hidden for app campaigns */}
          {!isAppCampaign && (
            <div className="col-span-2">
              <label className={lbl}>Destination URL</label>
              <input className={inp} placeholder="https://yoursite.com" type="url"
                value={globalCopy.destinationUrl}
                onChange={(e) => setGlobalCopy({ destinationUrl: e.target.value })} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

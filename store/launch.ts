import { create } from "zustand";
import { groupCreatives, deriveCampaignBase, AdRow, CreativeFile, computeAspectRatio } from "@/lib/grouping";

function buildRows(files: CreativeFile[], grouped: boolean): AdRow[] {
  if (grouped) return groupCreatives(files);
  return files.map((file) => ({
    id: crypto.randomUUID(),
    baseName: file.originalName.replace(/\.[^.]+$/, ""),
    creatives: [file],
    name: file.originalName.replace(/\.[^.]+$/, ""),
    primaryText: "",
    headline: "",
    cta: "LEARN_MORE",
    destinationUrl: "",
    displayUrl: "",
    utmParams: "",
    adSetId: "",
    scheduledAt: undefined,
  }));
}

interface LaunchStore {
  // account & targeting assets
  accountId: string;
  pageId: string;
  instagramAccountId: string;
  appId: string;
  pixelId: string;
  conversionEvent: string;
  adSets: any[];
  setAccountId: (id: string) => void;
  setPageId: (id: string) => void;
  setInstagramAccountId: (id: string) => void;
  setAppId: (id: string) => void;
  setPixelId: (id: string) => void;
  setConversionEvent: (e: string) => void;
  setAdSets: (adSets: any[]) => void;

  // creatives
  uploadedFiles: CreativeFile[];
  addFiles: (files: CreativeFile[]) => void;
  removeFile: (filename: string) => void;

  // ad rows (auto-grouped)
  rows: AdRow[];
  setRows: (rows: AdRow[]) => void;
  updateRow: (id: string, patch: Partial<AdRow>) => void;
  removeRow: (id: string) => void;

  // row selection (for choosing which ads to launch)
  selectedRowIds: string[];
  toggleRowSelection: (id: string) => void;
  selectAllRows: () => void;
  deselectAllRows: () => void;

  // global copy
  globalCopy: {
    primaryText: string;
    headline: string;
    cta: string;
    destinationUrl: string;
    displayUrl: string;
    utmParams: string;
  };
  setGlobalCopy: (patch: Partial<LaunchStore["globalCopy"]>) => void;
  applyGlobalCopy: () => void;

  // settings
  disableEnhancements: boolean;
  toggleEnhancements: () => void;
  groupCreativesEnabled: boolean;
  toggleGroupCreatives: () => void;
  selectedAdSetIds: string[];
  setSelectedAdSetIds: (ids: string[]) => void;

  // campaign mode
  launchMode: "new" | "existing";
  setLaunchMode: (m: "new" | "existing") => void;
  newCampaignObjective: string;
  newCampaignBudget: string;
  newCampaignName: string;
  newAdSetName: string;
  newBidStrategy: string;
  newBidAmount: string;
  newOptimizationGoal: string;
  newCampaignBudgetEnabled: boolean;
  newCampaignLevelBudget: string;
  setNewCampaignParams: (p: { objective?: string; budget?: string; campaignName?: string; adSetName?: string; bidStrategy?: string; bidAmount?: string; optimizationGoal?: string; campaignBudgetEnabled?: boolean; campaignLevelBudget?: string }) => void;

  // launch
  batchId: string | null;
  launchStatus: "idle" | "launching" | "done" | "error";
  setBatchId: (id: string) => void;
  setLaunchStatus: (s: LaunchStore["launchStatus"]) => void;
  reset: () => void;
}

export const useLaunchStore = create<LaunchStore>((set, get) => ({
  accountId: "",
  pageId: "",
  instagramAccountId: "",
  appId: "",
  pixelId: "",
  conversionEvent: "",
  adSets: [],
  setAccountId: (id) => set({ accountId: id }),
  setPageId: (id) => set({ pageId: id }),
  setInstagramAccountId: (id) => set({ instagramAccountId: id }),
  setAppId: (id) => set({ appId: id }),
  setPixelId: (id) => set({ pixelId: id }),
  setConversionEvent: (e) => set({ conversionEvent: e }),
  setAdSets: (adSets) => set({ adSets }),

  uploadedFiles: [],
  addFiles: (files) => {
    const all = [...get().uploadedFiles, ...files];
    const rows = buildRows(all, get().groupCreativesEnabled);
    // Auto-fill campaign/ad set names from filenames if not already set
    let nameUpdates: { newCampaignName?: string; newAdSetName?: string } = {};
    if (files.length > 0 && !get().newCampaignName) {
      const base = deriveCampaignBase(files.map((f) => f.originalName));
      if (base) {
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        nameUpdates = {
          newCampaignName: `${base}_${today}`,
          newAdSetName: `${base}_${today}_AS`,
        };
      }
    }
    set({ uploadedFiles: all, rows, selectedRowIds: rows.map((r) => r.id), ...nameUpdates });
  },
  removeFile: (filename) => {
    const all = get().uploadedFiles.filter((f) => f.filename !== filename);
    const rows = buildRows(all, get().groupCreativesEnabled);
    set({ uploadedFiles: all, rows, selectedRowIds: rows.map((r) => r.id) });
  },

  rows: [],
  setRows: (rows) => set({ rows, selectedRowIds: rows.map((r) => r.id) }),
  updateRow: (id, patch) =>
    set({ rows: get().rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
  removeRow: (id) => set({
    rows: get().rows.filter((r) => r.id !== id),
    selectedRowIds: get().selectedRowIds.filter((sid) => sid !== id),
  }),

  selectedRowIds: [],
  toggleRowSelection: (id) => {
    const cur = get().selectedRowIds;
    set({ selectedRowIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  },
  selectAllRows: () => set({ selectedRowIds: get().rows.map((r) => r.id) }),
  deselectAllRows: () => set({ selectedRowIds: [] }),

  globalCopy: {
    primaryText: "",
    headline: "",
    cta: "LEARN_MORE",
    destinationUrl: "",
    displayUrl: "",
    utmParams: "",
  },
  setGlobalCopy: (patch) =>
    set({ globalCopy: { ...get().globalCopy, ...patch } }),
  applyGlobalCopy: () => {
    const gc = get().globalCopy;
    set({
      rows: get().rows.map((r) => ({
        ...r,
        primaryText: gc.primaryText || r.primaryText,
        headline: gc.headline || r.headline,
        cta: gc.cta || r.cta,
        destinationUrl: gc.destinationUrl || r.destinationUrl,
        displayUrl: gc.displayUrl || r.displayUrl,
        utmParams: gc.utmParams || r.utmParams,
      })),
    });
  },

  disableEnhancements: false,
  toggleEnhancements: () => set({ disableEnhancements: !get().disableEnhancements }),
  groupCreativesEnabled: true,
  toggleGroupCreatives: () => {
    const next = !get().groupCreativesEnabled;
    const rows = buildRows(get().uploadedFiles, next);
    set({ groupCreativesEnabled: next, rows, selectedRowIds: rows.map((r) => r.id) });
  },
  selectedAdSetIds: [],
  setSelectedAdSetIds: (ids) => set({ selectedAdSetIds: ids }),

  launchMode: "existing",
  setLaunchMode: (m) => set({ launchMode: m }),
  newCampaignObjective: "OUTCOME_TRAFFIC",
  newCampaignBudget: "",
  newCampaignName: "",
  newAdSetName: "",
  newBidStrategy: "LOWEST_COST_WITHOUT_CAP",
  newBidAmount: "",
  newOptimizationGoal: "REACH",
  newCampaignBudgetEnabled: false,
  newCampaignLevelBudget: "",
  setNewCampaignParams: (p) => set({
    newCampaignObjective: p.objective ?? get().newCampaignObjective,
    newCampaignBudget: p.budget ?? get().newCampaignBudget,
    newCampaignName: p.campaignName ?? get().newCampaignName,
    newAdSetName: p.adSetName ?? get().newAdSetName,
    newBidStrategy: p.bidStrategy ?? get().newBidStrategy,
    newBidAmount: p.bidAmount ?? get().newBidAmount,
    newOptimizationGoal: p.optimizationGoal ?? get().newOptimizationGoal,
    newCampaignBudgetEnabled: p.campaignBudgetEnabled ?? get().newCampaignBudgetEnabled,
    newCampaignLevelBudget: p.campaignLevelBudget ?? get().newCampaignLevelBudget,
  }),

  batchId: null,
  launchStatus: "idle",
  setBatchId: (id) => set({ batchId: id }),
  setLaunchStatus: (s) => set({ launchStatus: s }),
  reset: () =>
    set({
      uploadedFiles: [],
      rows: [],
      selectedRowIds: [],
      batchId: null,
      launchStatus: "idle",
      selectedAdSetIds: [],
    }),
}));

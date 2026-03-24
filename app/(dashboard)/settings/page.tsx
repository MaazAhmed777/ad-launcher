"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(d => setKeys(d.keys || []));
  }, []);

  async function createKey() {
    if (!newKeyName.trim()) return;
    const res = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newKeyName }) });
    const d = await res.json();
    setKeys(prev => [d.key, ...prev]);
    setRevealed(d.key.key);
    setNewKeyName("");
    toast.success("API key created");
  }

  async function deleteKey(id: string) {
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    setKeys(prev => prev.filter(k => k.id !== id));
    toast.success("Deleted");
  }

  const SHEETS_SCRIPT = `
// Meta Launcher — Google Sheets Add-on
// Paste this in Extensions → Apps Script

const API_KEY = "YOUR_API_KEY_HERE";
const API_URL = "YOUR_APP_URL/api/launch-sheets";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Meta Launcher")
    .addItem("Open Launcher", "showSidebar")
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("Sidebar")
    .setTitle("Meta Launcher");
  SpreadsheetApp.getUi().showSidebar(html);
}

function launchAds() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).filter(r => r[0]).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return {
      creative_url:    obj["creative_url"],
      ad_name:         obj["ad_name"],
      primary_text:    obj["primary_text"],
      headline:        obj["headline"],
      cta:             obj["cta"] || "LEARN_MORE",
      destination_url: obj["destination_url"],
      ad_set_id:       String(obj["ad_set_id"]),
      page_id:         String(obj["page_id"]),
      account_id:      String(obj["account_id"]),
      scheduled_time:  obj["scheduled_time"] || null,
    };
  });

  const response = UrlFetchApp.fetch(API_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + API_KEY },
    payload: JSON.stringify(rows),
  });

  const results = JSON.parse(response.getContentText()).results;
  const statusCol = headers.indexOf("status") + 1 || headers.length + 1;
  const adIdCol = headers.indexOf("ad_id") + 1 || headers.length + 2;

  results.forEach(r => {
    sheet.getRange(r.index + 2, statusCol).setValue(r.status);
    if (r.ad_id) sheet.getRange(r.index + 2, adIdCol).setValue(r.ad_id);
    if (r.error) sheet.getRange(r.index + 2, statusCol).setValue("error: " + r.error);
  });

  SpreadsheetApp.getUi().alert("Done! " + results.filter(r => r.status === "success").length + " ads launched.");
}`.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* API Keys */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">API Keys</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use these keys to launch ads from the Google Sheets add-on or any external tool via <code className="bg-gray-100 px-1 rounded text-xs">POST /api/launch-sheets</code>.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 outline-none"
            placeholder="Key name (e.g. Google Sheets)"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createKey()}
          />
          <button onClick={createKey} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Generate</button>
        </div>

        {keys.length > 0 && (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{k.name || "Unnamed"}</div>
                  <div className="text-xs text-gray-500 mt-0.5 font-mono truncate">
                    {revealed === k.key ? k.key : k.key.slice(0, 12) + "••••••••••••••••"}
                  </div>
                  {k.lastUsed && <div className="text-xs text-gray-400 mt-0.5">Last used {new Date(k.lastUsed).toLocaleDateString()}</div>}
                </div>
                <button onClick={() => setRevealed(revealed === k.key ? null : k.key)} className="text-xs text-indigo-600 hover:text-indigo-800">
                  {revealed === k.key ? "Hide" : "Reveal"}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(k.key); toast.success("Copied!"); }} className="text-xs text-gray-500 hover:text-gray-800">Copy</button>
                <button onClick={() => deleteKey(k.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Sheets Add-on */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-1">Google Sheets Add-on</h2>
        <p className="text-sm text-gray-500 mb-3">
          Copy the script below into your Google Sheet → Extensions → Apps Script. Set your API key and app URL at the top.
          Your sheet should have columns: <code className="bg-gray-100 px-1 rounded text-xs">creative_url, ad_name, primary_text, headline, cta, destination_url, ad_set_id, page_id, account_id</code>
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-4 overflow-x-auto max-h-64 font-mono leading-relaxed">
            {SHEETS_SCRIPT}
          </pre>
          <button
            onClick={() => { navigator.clipboard.writeText(SHEETS_SCRIPT); toast.success("Copied!"); }}
            className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1 rounded-lg"
          >Copy</button>
        </div>
      </div>

      {/* API Docs */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-1">API Reference</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 text-sm">
          <div>
            <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded inline-block mb-1">POST /api/launch-sheets</div>
            <p className="text-gray-500 text-xs">Launch ads from any external source. Authenticate with <code className="bg-gray-100 px-1 rounded">Authorization: Bearer YOUR_API_KEY</code></p>
          </div>
          <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto">{`[
  {
    "creative_url": "https://your-cdn.com/image.jpg",
    "ad_name": "Summer Ad 1",
    "primary_text": "Check out our sale!",
    "headline": "Shop Now",
    "cta": "SHOP_NOW",
    "destination_url": "https://yoursite.com",
    "ad_set_id": "123456789",
    "page_id": "987654321",
    "account_id": "111222333",
    "scheduled_time": "2024-06-01T09:00:00Z"
  }
]`}</pre>
        </div>
      </div>
    </div>
  );
}

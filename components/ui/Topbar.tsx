"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function Topbar() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setConnected(d.accounts?.length > 0));
  }, []);

  async function saveSystemToken() {
    if (!token.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/system-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Invalid token");
      } else {
        toast.success(`Connected as ${data.name}`);
        setShowTokenInput(false);
        setToken("");
        setConnected(true);
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-3 flex-shrink-0 h-12">
      <span className="text-xs text-gray-400 font-medium">Meta Launcher</span>
      <div className="flex-1" />

      {connected === true && (
        <div className="flex items-center gap-3">
          <span className="text-xs bg-green-50 text-green-700 font-medium px-2.5 py-1 rounded-full">
            ✓ Meta Connected
          </span>
          <a href="/api/auth/logout" className="text-xs text-gray-400 hover:text-gray-600">
            Disconnect
          </a>
        </div>
      )}

      {connected === false && !showTokenInput && (
        <div className="flex items-center gap-2">
          <a href="/api/auth/meta"
            className="text-xs bg-indigo-600 text-white font-medium px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-colors">
            Connect Meta
          </a>
          <button
            onClick={() => setShowTokenInput(true)}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors">
            Use System Token
          </button>
        </div>
      )}

      {connected === false && showTokenInput && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="password"
            placeholder="Paste system user token…"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveSystemToken()}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 w-72 focus:border-indigo-400 outline-none"
          />
          <button
            onClick={saveSystemToken}
            disabled={saving || !token.trim()}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Connecting…" : "Connect"}
          </button>
          <button
            onClick={() => { setShowTokenInput(false); setToken(""); }}
            className="text-xs text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        </div>
      )}
    </header>
  );
}

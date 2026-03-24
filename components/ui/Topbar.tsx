"use client";
import { useEffect, useState } from "react";

export default function Topbar() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setConnected(d.accounts?.length > 0));
  }, []);

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
      {connected === false && (
        <a href="/api/auth/meta"
          className="text-xs bg-indigo-600 text-white font-medium px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-colors">
          Connect Meta
        </a>
      )}
    </header>
  );
}

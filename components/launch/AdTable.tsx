"use client";
import { useLaunchStore } from "@/store/launch";
import { CTA_OPTIONS } from "@/lib/meta";
import Image from "next/image";

export default function AdTable() {
  const rows = useLaunchStore((s) => s.rows);
  const adSets = useLaunchStore((s) => s.adSets);
  const updateRow = useLaunchStore((s) => s.updateRow);
  const removeRow = useLaunchStore((s) => s.removeRow);

  if (!rows.length) return null;

  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-32">Creative</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Ad Name</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Primary Text</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Headline</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-28">CTA</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">URL</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Ad Set</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/50 group">
                {/* Creative thumbnail */}
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {row.creatives.map((c) => (
                      <div key={c.filename} className="relative w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                        {c.isVideo ? (
                          <div className="w-full h-full flex items-center justify-center text-xs bg-gray-800 text-white">▶</div>
                        ) : (
                          <img src={c.url} alt={c.originalName} className="w-full h-full object-cover" />
                        )}
                        {c.aspectRatio && c.aspectRatio !== "unknown" && (
                          <span className="absolute bottom-0 left-0 right-0 text-center bg-black/50 text-white text-[7px] px-0.5">
                            {c.aspectRatio}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none bg-transparent focus:bg-white"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <textarea
                    className="w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none bg-transparent focus:bg-white resize-none"
                    rows={2}
                    value={row.primaryText}
                    onChange={(e) => updateRow(row.id, { primaryText: e.target.value })}
                    placeholder="Primary text…"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none bg-transparent focus:bg-white"
                    value={row.headline}
                    onChange={(e) => updateRow(row.id, { headline: e.target.value })}
                    placeholder="Headline"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none bg-transparent focus:bg-white cursor-pointer"
                    value={row.cta}
                    onChange={(e) => updateRow(row.id, { cta: e.target.value })}
                  >
                    {CTA_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none bg-transparent focus:bg-white"
                    value={row.destinationUrl}
                    onChange={(e) => updateRow(row.id, { destinationUrl: e.target.value })}
                    placeholder="https://…"
                    type="url"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none bg-transparent focus:bg-white cursor-pointer"
                    value={row.adSetId}
                    onChange={(e) => updateRow(row.id, { adSetId: e.target.value })}
                  >
                    <option value="">— Select —</option>
                    {adSets.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => removeRow(row.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-base leading-none"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

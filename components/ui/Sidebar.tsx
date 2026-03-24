"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/launch",    icon: "🚀", label: "Launch" },
  { href: "/campaigns", icon: "📁", label: "Campaigns" },
  { href: "/history",   icon: "📋", label: "History" },
  { href: "/templates", icon: "💾", label: "Templates" },
  { href: "/settings",  icon: "⚙️", label: "Settings" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-52 bg-[#181c2e] flex flex-col h-full flex-shrink-0">
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">M</div>
        <span className="text-white font-semibold text-sm">Meta Launcher</span>
      </div>
      <nav className="px-2 flex-1 space-y-0.5 mt-2">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${path === n.href
                ? "bg-indigo-500/20 text-indigo-300"
                : "text-white/40 hover:text-white/80 hover:bg-white/5"}`}
          >
            <span>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

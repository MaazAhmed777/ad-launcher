"use client";
import DropZone from "@/components/launch/DropZone";
import GlobalCopy from "@/components/launch/GlobalCopy";
import CreativeGrid from "@/components/launch/CreativeGrid";
import LaunchButton from "@/components/launch/LaunchButton";
import PostIdImport from "@/components/launch/PostIdImport";
import DriveImport from "@/components/launch/DriveImport";
import CampaignSetup from "@/components/launch/CampaignSetup";

export default function LaunchPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Launch Ads</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload creatives, write copy, and launch at scale</p>
      </div>

      {/* Step 1 — Campaign & Ad Set */}
      <CampaignSetup />

      {/* Step 2 — Creatives */}
      <DropZone />
      <div className="flex gap-4 px-1">
        <PostIdImport />
        <DriveImport />
      </div>

      {/* Step 3 — Grouped creative cards */}
      <CreativeGrid />

      {/* Step 4 — Global copy */}
      <GlobalCopy />

      {/* Launch */}
      <LaunchButton />
    </div>
  );
}

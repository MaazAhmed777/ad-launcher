// Auto-grouping: detect aspect ratio from actual dimensions or filename fallback

export interface CreativeFile {
  filename: string;
  originalName: string;
  url: string;
  isVideo: boolean;
  sizeLabel: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
}

export interface AdRow {
  id: string;
  baseName: string;
  creatives: CreativeFile[];
  name: string;
  primaryText: string;
  headline: string;
  cta: string;
  destinationUrl: string;
  displayUrl: string;
  utmParams: string;
  adSetId: string;
  scheduledAt?: string;
}

/** Compute standard aspect ratio label from actual pixel dimensions */
export function computeAspectRatio(w: number, h: number): string {
  if (!w || !h) return "unknown";
  const r = w / h;
  if (Math.abs(r - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(r - 4 / 5) < 0.05) return "4:5";
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (Math.abs(r - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(r - 4 / 3) < 0.05) return "4:3";
  if (Math.abs(r - 2 / 3) < 0.05) return "2:3";
  if (Math.abs(r - 3 / 4) < 0.05) return "3:4";
  return `${w}×${h}`;
}

/** Fallback: detect ratio from filename patterns */
function detectRatioFromName(filename: string): string {
  const noExt = filename.replace(/\.[^.]+$/, "");
  if (/_9_16(?:_|$)/i.test(noExt)) return "9:16";
  if (/_4_5(?:_|$)/i.test(noExt)) return "4:5";
  if (/_1_1(?:_|$)/i.test(noExt)) return "1:1";
  if (/_16_9(?:_|$)/i.test(noExt)) return "16:9";
  if (/_4_3(?:_|$)/i.test(noExt)) return "4:3";
  if (/9[x:]?16|916|story|stories|reel|vertical/i.test(noExt)) return "9:16";
  if (/4[x:]?5|45(?!\d)/i.test(noExt)) return "4:5";
  if (/1[x:]?1|square|sq/i.test(noExt)) return "1:1";
  if (/16[x:]?9|169|landscape|horizontal/i.test(noExt)) return "16:9";
  if (/4[x:]?3(?!\d)/i.test(noExt)) return "4:3";
  return "unknown";
}

const RATIO_SUFFIXES = [
  /[_\- ](9[x:]?16|916|story|stories|reel|reels|vertical)$/i,
  /[_\- ](4[x:]?5|portrait)$/i,
  /[_\- ](1[x:]?1|square|sq)$/i,
  /[_\- ](16[x:]?9|169|landscape|horizontal)$/i,
  /[_\- ](4[x:]?3)$/i,
  /[_\- ](2[x:]?3)$/i,
  /[_\- ](3[x:]?4)$/i,
  /\s*[\(\[](9x16|4x5|1x1|16x9|4x3)[\)\]]$/i,
  /[_\- ](v|h|sq)$/i,
  /[_\- ]\d{3,4}x\d{3,4}$/i,
];

/** Strip aspect-ratio hints and UUID-like hashes from a filename to get the "concept name" */
export function extractBaseName(filename: string): string {
  let base = filename.replace(/\.[^.]+$/, ""); // strip extension

  // Strip known ratio suffixes
  for (const pattern of RATIO_SUFFIXES) {
    const stripped = base.replace(pattern, "");
    if (stripped !== base) { base = stripped; break; }
  }

  // Strip underscore-separated ratio patterns from anywhere in the filename
  // e.g. _4_5_A → _A, _9_16_A → _A so both map to the same base
  base = base.replace(/_(?:9_16|16_9|4_5|1_1|4_3|2_3|3_4)(?=_|$)/gi, "");

  // Strip trailing UUID-like segments: _abc123def, _86b5ukn7k, etc.
  // A "hash-like" segment: 5–16 alphanumeric chars that contain at least one digit
  base = base.replace(/[_\-][a-zA-Z0-9]*[0-9][a-zA-Z0-9]{3,15}$/g, "");

  // Strip trailing version/number suffixes: _01, _v2, _final, _copy
  base = base.replace(/[_\- ](v\d+|\d+|final|copy|draft|export)$/i, "");

  return base.trim();
}

export function groupCreatives(files: CreativeFile[]): AdRow[] {
  return files.map((file) => {
    const ratio =
      file.width && file.height
        ? computeAspectRatio(file.width, file.height)
        : detectRatioFromName(file.originalName);
    const name = file.originalName.replace(/\.[^.]+$/, "");
    return {
      id: crypto.randomUUID(),
      baseName: name,
      creatives: [{ ...file, aspectRatio: ratio }],
      name,
      primaryText: "",
      headline: "",
      cta: "LEARN_MORE",
      destinationUrl: "",
      displayUrl: "",
      utmParams: "",
      adSetId: "",
      scheduledAt: undefined,
    };
  });
}

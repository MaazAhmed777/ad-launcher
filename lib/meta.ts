const META_API = "https://graph.facebook.com/v19.0";

export async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_API}${path}`);
  url.searchParams.set("access_token", token);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { cache: "no-store" });
  return res.json();
}

export async function metaPost(
  path: string,
  token: string,
  body: Record<string, string> = {},
  formData?: FormData
) {
  const url = `${META_API}${path}`;
  if (formData) {
    formData.append("access_token", token);
    const res = await fetch(url, { method: "POST", body: formData });
    return res.json();
  }
  const form = new URLSearchParams({ ...body, access_token: token });
  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.json();
}

export async function uploadImageToMeta(
  accountId: string,
  token: string,
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<{ hash: string }> {
  const fd = new FormData();
  fd.append("access_token", token);
  fd.append(filename, new Blob([fileBuffer]), filename);
  const res = await fetch(`${META_API}/act_${accountId}/adimages`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  if (!data.images) throw new Error(data.error?.message || "Image upload failed");
  const key = Object.keys(data.images)[0];
  return { hash: data.images[key].hash };
}

export async function uploadVideoToMeta(
  accountId: string,
  token: string,
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<{ videoId: string }> {
  const fd = new FormData();
  fd.append("access_token", token);
  fd.append("source", new Blob([fileBuffer]), filename);
  fd.append("name", filename);
  const res = await fetch(`${META_API}/act_${accountId}/advideos`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  if (!data.id) throw new Error(data.error?.message || "Video upload failed");
  return { videoId: data.id };
}

export const OBJECTIVES = [
  { value: "OUTCOME_AWARENESS",      label: "Awareness",      icon: "📣" },
  { value: "OUTCOME_TRAFFIC",        label: "Traffic",        icon: "🔗" },
  { value: "OUTCOME_ENGAGEMENT",     label: "Engagement",     icon: "💬" },
  { value: "OUTCOME_LEADS",          label: "Leads",          icon: "📋" },
  { value: "OUTCOME_APP_PROMOTION",  label: "App Promotion",  icon: "📱" },
  { value: "OUTCOME_SALES",          label: "Sales",          icon: "🛒" },
] as const;

export const CTA_OPTIONS = [
  "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "GET_OFFER",
  "BOOK_TRAVEL", "CONTACT_US", "DOWNLOAD", "WATCH_MORE",
  "APPLY_NOW", "GET_QUOTE", "SUBSCRIBE", "INSTALL_APP",
] as const;

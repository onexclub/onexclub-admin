import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage — gym / organization brand logos
 *
 * **Reusability:** Any server-only flow that needs to set `organizations.logo_url`
 * should import `GYM_BRAND_LOGOS_BUCKET` + `uploadGymBrandLogoForOrganization` from here
 * so the bucket id stays in one place (must match the bucket in Supabase + migration SQL).
 *
 * **Bucket naming:** We use `gym-brand-logos` instead of a generic `gym-logos` so the
 * bucket purpose is obvious next to future buckets (e.g. member avatars, documents).
 * If you rename in the dashboard, update `GYM_BRAND_LOGOS_BUCKET` and the migration.
 */
export const GYM_BRAND_LOGOS_BUCKET = "gym-brand-logos" as const;

/**
 * Normalize `organizations.logo_url` for browsers.
 *
 * **Why:** Logos occasionally fail to render when the saved value is only a pathname (starts with `/storage/...`),
 * uses a stale Supabase project host after env rotation, or was pasted manually during support. This keeps
 * list/detail thumbnails working without rewriting every row immediately.
 *
 * **Reuse:** `GymLogoThumbnail` calls this automatically; reuse the same helper if you expose logo URLs elsewhere
 * (marketing pages, receipts, etc.).
 */
export function normalizeGymBrandLogoUrl(
  logoUrl: string | null | undefined,
  supabaseOrigin: string | null | undefined,
): string | null {
  const raw = typeof logoUrl === "string" ? logoUrl.trim() : "";
  if (!raw) return null;

  const base = typeof supabaseOrigin === "string" ? supabaseOrigin.replace(/\/$/, "").trim() : "";
  try {
    if (raw.startsWith("/storage/v1/object/public/" + String(GYM_BRAND_LOGOS_BUCKET)) && base) {
      return `${base}${raw}`;
    }
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);

    const isStorageLogo =
      u.pathname.includes("/storage/v1/object/public/") && u.pathname.includes(`/${GYM_BRAND_LOGOS_BUCKET}/`);

    // If we know the project's public Supabase URL, prefer it for public object paths so a renamed project ref
    // doesn't leave broken thumbnails.
    if (isStorageLogo && base) {
      try {
        const canonical = new URL(base);
        u.protocol = canonical.protocol;
        u.host = canonical.host;
        return u.toString();
      } catch {
        return u.toString();
      }
    }

    return u.toString();
  } catch {
    return base && raw.startsWith("/") ? `${base}${raw}` : raw || null;
  }
}

/** Matches app validation; keep roughly aligned with `supabase/migrations/002_*` if you set bucket MIME limits there. */
export const GYM_BRAND_LOGO_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type GymBrandLogoMime = (typeof GYM_BRAND_LOGO_ALLOWED_MIME_TYPES)[number];

/**
 * Normalizes `FormData` file fields for logo uploads.
 *
 * **Reuse:** Server actions should use this instead of `value instanceof File` alone — runtimes occasionally surface
 * uploads as `Blob`, and treating a non-file entry as "no upload" skips Storage entirely (symptom: bucket stays empty).
 */
export function imageBlobFromFormDataEntry(entry: FormDataEntryValue | null): Blob | File | null {
  if (entry == null || typeof entry === "string") return null;
  if (typeof File !== "undefined" && entry instanceof File) {
    return entry.size > 0 ? entry : null;
  }
  if (typeof Blob !== "undefined" && entry instanceof Blob) {
    return entry.size > 0 ? entry : null;
  }
  return null;
}

function mimeFromFileName(name: string): GymBrandLogoMime | null {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return null;
  }
}

/** 2 MiB — enough for crisp logos without bloating storage. */
export const GYM_BRAND_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type UploadGymBrandLogoResult =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; message: string };

function fileExtensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

/**
 * Upload a brand logo object for an organization. Intended for **service role** clients
 * (server actions after authz checks) so uploads do not depend on end-user storage policies.
 *
 * Object path: `{organizationId}/brand-logo.{ext}` — one canonical object per org; upsert replaces.
 */
export async function uploadGymBrandLogoForOrganization(
  adminClient: SupabaseClient,
  organizationId: string,
  file: Blob | File,
): Promise<UploadGymBrandLogoResult> {
  if (!file.size) {
    return { ok: false, message: "Logo file is empty." };
  }
  if (file.size > GYM_BRAND_LOGO_MAX_BYTES) {
    return { ok: false, message: `Logo must be at most ${GYM_BRAND_LOGO_MAX_BYTES / 1024 / 1024} MB.` };
  }

  let mime = typeof file.type === "string" ? file.type.trim() : "";
  if (!mime && typeof File !== "undefined" && file instanceof File && file.name) {
    mime = mimeFromFileName(file.name) ?? "";
  }
  if (!GYM_BRAND_LOGO_ALLOWED_MIME_TYPES.includes(mime as GymBrandLogoMime)) {
    return {
      ok: false,
      message: `Unsupported image type (${mime || "unknown"}). Use PNG, JPEG, WebP, or GIF.`,
    };
  }

  const ext = fileExtensionForMime(mime);
  const path = `${organizationId}/brand-logo.${ext}`;

  const body = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await adminClient.storage.from(GYM_BRAND_LOGOS_BUCKET).upload(path, body, {
    contentType: mime,
    upsert: true,
  });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data } = adminClient.storage.from(GYM_BRAND_LOGOS_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;
  if (!publicUrl) {
    return { ok: false, message: "Upload succeeded but public URL could not be resolved." };
  }

  return { ok: true, publicUrl, path };
}

/**
 * Deletes any objects stored for this org under `gym-brand-logos/{organizationId}/…` via service role.
 * Safe to call when clearing `organizations.logo_url` or before replacing with a fresh upload path.
 */
export async function removeGymBrandLogoObjectsForOrganization(
  adminClient: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const prefix = `${organizationId}`;
  const { data: entries, error: listErr } = await adminClient.storage.from(GYM_BRAND_LOGOS_BUCKET).list(prefix, {
    limit: 50,
    sortBy: { column: "name", order: "asc" },
  });

  if (listErr) {
    return { ok: false, message: listErr.message };
  }

  const names = (entries ?? []).map((e) => e.name).filter(Boolean);
  if (!names.length) {
    return { ok: true };
  }

  const paths = names.map((name) => `${prefix}/${name}`);
  const { error: rmErr } = await adminClient.storage.from(GYM_BRAND_LOGOS_BUCKET).remove(paths);
  if (rmErr) {
    return { ok: false, message: rmErr.message };
  }

  return { ok: true };
}

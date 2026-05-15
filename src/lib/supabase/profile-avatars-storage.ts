import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage — profile avatars (staff + members).
 *
 * **Reusability:** Import `PROFILE_AVATARS_BUCKET` + `uploadProfileAvatar` from here so bucket id
 * stays aligned with `supabase/migrations/018_profile_avatars_bucket.sql`.
 * Pattern mirrors `gym-brand-logos-storage.ts` (service-role upload, public read).
 */
export const PROFILE_AVATARS_BUCKET = "profile-avatars" as const;

export const PROFILE_AVATAR_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type ProfileAvatarMime = (typeof PROFILE_AVATAR_ALLOWED_MIME_TYPES)[number];

/** 2 MiB — enough for crisp headshots without bloating storage. */
export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type UploadProfileAvatarResult =
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
 * Upload a profile avatar. Intended for **service role** clients after authz checks.
 *
 * Object path: `{profileId}/avatar.{ext}` — one canonical object per profile; upsert replaces.
 */
export async function uploadProfileAvatar(
  adminClient: SupabaseClient,
  profileId: string,
  file: File,
): Promise<UploadProfileAvatarResult> {
  if (!file.size) {
    return { ok: false, message: "Photo file is empty." };
  }
  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    return { ok: false, message: `Photo must be at most ${PROFILE_AVATAR_MAX_BYTES / 1024 / 1024} MB.` };
  }

  const mime = file.type;
  if (!PROFILE_AVATAR_ALLOWED_MIME_TYPES.includes(mime as ProfileAvatarMime)) {
    return {
      ok: false,
      message: `Unsupported image type (${mime || "unknown"}). Use PNG, JPEG, WebP, or GIF.`,
    };
  }

  const ext = fileExtensionForMime(mime);
  const path = `${profileId}/avatar.${ext}`;
  const body = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await adminClient.storage.from(PROFILE_AVATARS_BUCKET).upload(path, body, {
    contentType: mime,
    upsert: true,
  });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data } = adminClient.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;
  if (!publicUrl) {
    return { ok: false, message: "Upload succeeded but public URL could not be resolved." };
  }

  return { ok: true, publicUrl, path };
}

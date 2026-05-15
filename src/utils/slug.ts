/** URL-safe slug for `organizations.slug` (must stay unique). */
export function slugifyOrganization(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (s || "gym").slice(0, 80);
}

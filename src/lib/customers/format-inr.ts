/** INR price formatting for plan cards and roster columns. */
export function formatInrPrice(amount: number | null | undefined, currency = "INR"): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const code = currency.toUpperCase().slice(0, 3);
  if (code === "INR") {
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
  return `${code} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function profileInitials(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

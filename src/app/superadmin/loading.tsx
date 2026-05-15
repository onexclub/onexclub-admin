export default function SuperadminLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {["a", "b", "c"].map((k) => (
        <div
          key={k}
          className="h-28 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/60"
        />
      ))}
    </div>
  );
}

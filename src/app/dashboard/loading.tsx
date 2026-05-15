export default function DashboardLoading() {
  return (
    <div className="space-y-6 px-4 py-8 lg:px-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800/80" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded bg-zinc-800/50" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-zinc-800/40" />
        <div className="h-28 animate-pulse rounded-xl bg-zinc-800/40" />
        <div className="h-28 animate-pulse rounded-xl bg-zinc-800/40" />
      </div>
    </div>
  );
}

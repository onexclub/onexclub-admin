import type { TrainerLite } from "@/lib/customers/membership-detail";
import { trainerDisplayLabel } from "@/lib/admin/outlet-trainers";

const selectCn =
  "mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 text-sm text-zinc-900 outline-none ring-orange-500/25 transition focus:border-orange-500 focus:bg-white focus:ring-4 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:focus:bg-zinc-950";

type Props = {
  trainers: TrainerLite[];
  value: string;
  onChange: (trainerId: string) => void;
  name?: string;
  id?: string;
  /** Shown when no coach is picked — default "No coach yet (optional)". */
  emptyLabel?: string;
  className?: string;
};

/**
 * Shared coach dropdown — onboard wizard review + inline roster assign.
 * **Reuse:** pass outlet-scoped trainers from `listTrainersGroupedByOutlet`.
 */
export function TrainerSelectField(props: Props) {
  const { trainers, value, onChange, name, id, emptyLabel = "No coach yet (optional)", className } = props;

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? selectCn}
    >
      <option value="">{emptyLabel}</option>
      {trainers.map((t) => (
        <option key={t.id} value={t.id}>
          {trainerDisplayLabel(t)}
        </option>
      ))}
    </select>
  );
}

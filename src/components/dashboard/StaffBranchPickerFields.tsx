"use client";

import { useEffect, useMemo, useState } from "react";

export type StaffBranchPickerOutlet = { id: string; name: string | null };

const fieldClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

type Props = {
  outlets: StaffBranchPickerOutlet[];
  /** Pre-select when adding a teammate (defaults to first outlet). */
  defaultOutletId?: string;
  /** Pre-fill on edit — primary row first. */
  initialSelectedIds?: string[];
  initialPrimaryId?: string;
  /** Fired when the selection is valid for submit (e.g. multi mode with ≥1 branch). */
  onValidChange?: (valid: boolean) => void;
};

/**
 * Shared branch picker for add-staff and edit branch-access forms.
 *
 * **Reuse:** Submits `access_mode`, `outlet_id` / `outlet_ids`, and `primary_outlet_id`.
 * Parsed server-side via `parseStaffBranchFormSelection`.
 */
export function StaffBranchPickerFields({
  outlets,
  defaultOutletId,
  initialSelectedIds,
  initialPrimaryId,
  onValidChange,
}: Props) {
  const fallbackId = defaultOutletId ?? outlets[0]?.id ?? "";
  const initialIds = useMemo(
    () => (initialSelectedIds?.length ? initialSelectedIds : [fallbackId]),
    [initialSelectedIds, fallbackId],
  );
  const initialPrimary = initialPrimaryId ?? initialIds.find((id) => id === fallbackId) ?? initialIds[0]!;

  const defaultMode = initialIds.length > 1 ? "multi" : "single";
  const [accessMode, setAccessMode] = useState<"single" | "multi">(defaultMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialIds));
  const [primaryOutletId, setPrimaryOutletId] = useState(initialPrimary);
  const [assignAll, setAssignAll] = useState(initialIds.length > 1 && initialIds.length === outlets.length);

  const outletNameById = Object.fromEntries(outlets.map((o) => [o.id, o.name ?? o.id]));
  const selectionValid = accessMode === "single" || selectedIds.size > 0;

  useEffect(() => {
    onValidChange?.(selectionValid);
  }, [selectionValid, onValidChange]);

  function toggleOutlet(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!next.has(primaryOutletId) && next.size) {
        setPrimaryOutletId([...next][0]!);
      }
      return next;
    });
  }

  function applyAllBranches(checked: boolean) {
    setAssignAll(checked);
    if (checked) {
      const all = new Set(outlets.map((o) => o.id));
      setSelectedIds(all);
      if (!all.has(primaryOutletId)) {
        setPrimaryOutletId(fallbackId);
      }
    }
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Access scope</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="radio"
            name="access_mode"
            value="single"
            checked={accessMode === "single"}
            onChange={() => {
              setAccessMode("single");
              setSelectedIds(new Set([primaryOutletId || fallbackId]));
              setAssignAll(false);
            }}
          />
          Single branch
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="radio"
            name="access_mode"
            value="multi"
            checked={accessMode === "multi"}
            onChange={() => {
              setAccessMode("multi");
              if (selectedIds.size <= 1) {
                setSelectedIds(new Set(initialIds.length ? initialIds : [fallbackId]));
              }
            }}
          />
          Multiple branches — same role at each selected location
        </label>
      </fieldset>

      {accessMode === "single" ? (
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Branch
          <select
            name="outlet_id"
            required
            className={fieldClass}
            value={primaryOutletId}
            onChange={(e) => {
              setPrimaryOutletId(e.target.value);
              setSelectedIds(new Set([e.target.value]));
            }}
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name ?? o.id}
              </option>
            ))}
          </select>
          <input type="hidden" name="primary_outlet_id" value={primaryOutletId} />
        </label>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            <input
              type="checkbox"
              checked={assignAll}
              onChange={(e) => applyAllBranches(e.target.checked)}
              className="size-4 rounded border-zinc-300"
            />
            All branches ({outlets.length})
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {outlets.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <input
                  type="checkbox"
                  name="outlet_ids"
                  value={o.id}
                  checked={selectedIds.has(o.id)}
                  onChange={() => {
                    setAssignAll(false);
                    toggleOutlet(o.id);
                  }}
                />
                {o.name ?? o.id}
              </label>
            ))}
          </div>
          {selectedIds.size > 1 ? (
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Primary branch
              <select
                name="primary_outlet_id"
                className={fieldClass}
                value={primaryOutletId}
                onChange={(e) => setPrimaryOutletId(e.target.value)}
              >
                {[...selectedIds].map((id) => (
                  <option key={id} value={id}>
                    {outletNameById[id] ?? id}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="primary_outlet_id" value={[...selectedIds][0] ?? primaryOutletId} />
          )}
          {selectedIds.size === 0 ? (
            <p className="text-xs text-rose-600">Select at least one branch.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

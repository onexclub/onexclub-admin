"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { saveCustomerQuestionnaireSectionAction } from "@/app/admin/customers/actions";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";

import { fetchMergedDefinitionsForOutlet } from "../question-definitions.service";
import { fetchResponsesBundle, upsertQuestionsResponse } from "../question-responses.service";
import type { OnboardingFormName, QuestionsResponseRow } from "../types";

export const onboardingQueries = {
  definitions: (outletId: string) => ["onboarding", "definitions", outletId] as const,
  responses: (profileId: string, outletId: string) => ["onboarding", "responses", profileId, outletId] as const,
};

export function useOnboardingDefinitions(outletId: string | null) {
  const supabase = useSupabaseBrowser();
  const enabled = Boolean(outletId);

  return useQuery({
    queryKey: onboardingQueries.definitions(outletId ?? ""),
    enabled,
    queryFn: async () => fetchMergedDefinitionsForOutlet(supabase, outletId ?? ""),
  });
}

export function useOnboardingFormsBundle(profileId: string, outletId: string | null) {
  const supabase = useSupabaseBrowser();
  const enabled = !!outletId;

  const definitions = useQuery({
    queryKey: onboardingQueries.definitions(outletId ?? ""),
    enabled,
    queryFn: async () => fetchMergedDefinitionsForOutlet(supabase, outletId ?? ""),
  });

  const responses = useQuery({
    queryKey: onboardingQueries.responses(profileId, outletId ?? ""),
    enabled,
    queryFn: async () => fetchResponsesBundle(supabase, profileId, outletId ?? ""),
  });

  return {
    definitions,
    responses,
    mergedDefinitions: definitions.data,
    bundledResponses: responses.data,
    isBusy: definitions.isPending || responses.isPending || !enabled,
    isLoading: definitions.isPending || responses.isPending,
    error: definitions.error ?? responses.error ?? null,
  };
}

export function useUpsertOnboardingSectionMutation(
  profileId: string,
  outletId: string | null,
  /** When set (staff customer profile), saves via server action + service role. */
  membershipId?: string | null,
) {
  const supabase = useSupabaseBrowser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      formName: OnboardingFormName;
      answers: Record<string, unknown>;
      finalize: boolean;
      actorProfileId: string | null;
      previous: QuestionsResponseRow | null | undefined;
    }) => {
      if (!outletId) throw new Error("Missing outlet");

      if (membershipId) {
        const result = await saveCustomerQuestionnaireSectionAction({
          profileId,
          outletId,
          membershipId,
          formName: payload.formName,
          answers: payload.answers,
          finalize: payload.finalize,
        });
        if (result.error) throw new Error(result.error);
        return;
      }

      await upsertQuestionsResponse({
        supabase,
        profileId,
        outletId,
        formName: payload.formName,
        answers: payload.answers,
        actorProfileId: payload.actorProfileId,
        finalize: payload.finalize,
        previous: payload.previous ?? null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: onboardingQueries.responses(profileId, outletId ?? "") });
      await qc.refetchQueries({ queryKey: onboardingQueries.responses(profileId, outletId ?? "") });
    },
  });
}

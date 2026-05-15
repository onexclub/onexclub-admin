import type { OnboardingFormName } from "./types";

/** Seed + query keys rely on these literals — keep aligned with Supabase CHECK constraints / seed inserts. */
export const ONBOARDING_FORM = {
  basic: "basic_info",
  health: "health_screening",
  diet: "diet_preferences",
} satisfies Record<string, OnboardingFormName>;

export const ONBOARDING_FORMS_IN_ORDER: OnboardingFormName[] = [
  ONBOARDING_FORM.basic,
  ONBOARDING_FORM.health,
  ONBOARDING_FORM.diet,
];

export const SECTION_COPY: Record<OnboardingFormName, { title: string; description: string }> = {
  basic_info: {
    title: "Basic information",
    description: "Contact alternatives, goals, and baseline activity for reception tooling.",
  },
  health_screening: {
    title: "Health screening",
    description: "Safety questions and clinician-style notes trainers rely on.",
  },
  diet_preferences: {
    title: "Diet preferences",
    description: "Allergens, cravings, patterns — ideal for trainer programming.",
  },
};

export const SECTION_SHORT_LABEL: Record<OnboardingFormName, string> = {
  basic_info: "Basic",
  health_screening: "Screening",
  diet_preferences: "Diet",
};

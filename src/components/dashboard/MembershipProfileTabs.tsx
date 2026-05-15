"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function MembershipProfileTabs(props: { overviewSlot: ReactNode; onboardingSlot: ReactNode }) {
  const { overviewSlot, onboardingSlot } = props;

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full gap-2 sm:grid-cols-2 sm:max-w-xl">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="onboarding">Onboarding forms</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {overviewSlot}
      </TabsContent>

      <TabsContent value="onboarding" className="space-y-6">
        {onboardingSlot}
      </TabsContent>
    </Tabs>
  );
}

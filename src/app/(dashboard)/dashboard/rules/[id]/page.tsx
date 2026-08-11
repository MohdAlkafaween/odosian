"use client";

import { useParams } from "next/navigation";
import { RuleDetailView } from "@/components/rule-detail-view";

// The real content lives in RuleDetailView (takes ruleId as a prop) so the
// exact same view can also render inside a tab (see ai-tab-content.tsx)
// instead of only ever being reachable through this route.
export default function RuleDetailPage() {
  const params = useParams<{ id: string }>();
  return <RuleDetailView ruleId={params.id} />;
}

"use client";

import { MitreView } from "@/components/mitre-view";

// The real content lives in MitreView so it can also render inside a tab
// (see ai-tab-content.tsx) instead of only ever being reachable through
// this route.
export default function MitrePage() {
  return <MitreView />;
}

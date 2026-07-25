export const RULE_CATEGORIES = [
  "Active Directory",
  "Windows",
  "Linux",
  "macOS",
  "AWS",
  "Azure",
  "GCP",
  "Kubernetes",
  "Identity",
  "SaaS",
  "Network",
  "Cloud",
  "Endpoint",
  "General",
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

const CATEGORY_MATCHERS: [RuleCategory, (tag: string) => boolean][] = [
  ["Active Directory", (t) => t === "Data Source: Active Directory" || t === "Use Case: Active Directory Monitoring"],
  ["Windows", (t) => t === "OS: Windows"],
  ["Linux", (t) => t === "OS: Linux"],
  ["macOS", (t) => t === "OS: macOS"],
  ["AWS", (t) => t.startsWith("Data Source: AWS") || t === "Data Source: Amazon Web Services"],
  ["Azure", (t) => t === "Data Source: Azure" || t === "Data Source: Microsoft Entra ID" || t.startsWith("Data Source: Microsoft 365")],
  ["GCP", (t) => t === "Data Source: GCP" || t === "Data Source: Google Cloud Platform"],
  ["Kubernetes", (t) => t === "Domain: Kubernetes" || t === "Domain: Container" || t === "Data Source: Kubernetes"],
  ["Identity", (t) => t === "Domain: Identity" || t === "Data Source: Okta"],
  ["SaaS", (t) => t === "Domain: SaaS" || t === "Data Source: Google Workspace" || t === "Data Source: Github"],
  ["Network", (t) => t === "Domain: Network" || t === "Data Source: PAN-OS"],
  ["Cloud", (t) => t === "Domain: Cloud"],
  ["Endpoint", (t) => t === "Domain: Endpoint"],
];

export function deriveCategoryFromTags(tags: string[]): RuleCategory {
  for (const [category, matches] of CATEGORY_MATCHERS) {
    if (tags.some(matches)) return category;
  }
  return "General";
}

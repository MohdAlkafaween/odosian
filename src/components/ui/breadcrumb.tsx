"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  rules: "Detection Rules",
  analysis: "AI Analysis",
  history: "History",
  templates: "Templates",
  mitre: "MITRE ATT&CK",
  audit: "Audit Logs",
  users: "Users",
  settings: "Settings",
  projects: "Shield Categories",
  profile: "Profile",
  new: "Create",
  edit: "Edit",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Always render a (possibly empty) nav — an actually-null return collapses
  // this to zero DOM children, which breaks `justify-between` in the topbar:
  // with only one flex item left, it snaps to flex-start instead of flex-end.
  if (segments.length <= 1) return <nav />;

  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = UUID_REGEX.test(segment)
      ? "Details"
      : ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
          {crumb.isLast ? (
            <span className="text-text-secondary font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-text transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

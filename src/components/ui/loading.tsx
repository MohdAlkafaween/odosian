interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-border border-t-primary ${sizeClasses[size]} ${className}`}
    />
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-light animate-pulse rounded-lg ${className}`}
    />
  );
}

export function ForgeLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle
          cx="30"
          cy="30"
          r="25"
          fill="none"
          stroke="#1E2D3D"
          strokeWidth="4"
        />
        <circle
          cx="30"
          cy="30"
          r="25"
          fill="none"
          stroke="#4CBDFA"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="157"
          className="animate-forge-loader"
        />
      </svg>
      <span className="text-sm text-text-muted">Forging shield analysis...</span>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <ForgeLoader />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  valueColor?: string;
  iconBg?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon,
  valueColor,
  iconBg,
}: StatCardProps) {
  const changeColor = {
    positive: "text-success",
    negative: "text-danger",
    neutral: "text-text-muted",
  }[changeType];

  return (
    <div className="bg-surface border border-border rounded-[10px] p-5 card-hover-glow relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs text-text-muted font-medium tracking-wider mb-2">{label}</div>
          <div
            className="text-3xl font-extrabold"
            style={valueColor ? { color: valueColor } : undefined}
          >
            {value}
          </div>
          {change && (
            <p className={`text-xs mt-1 ${changeColor}`}>{change}</p>
          )}
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center"
            style={iconBg ? { background: iconBg } : undefined}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = "", children }: CardProps) {
  return (
    <div className={`bg-surface border border-border rounded-[10px] card-hover-glow ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: CardProps) {
  return (
    <div className={`px-6 py-4 border-b border-border ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ className = "", children }: CardProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ className = "", children }: CardProps) {
  return (
    <div className={`px-6 py-4 border-t border-border ${className}`}>
      {children}
    </div>
  );
}

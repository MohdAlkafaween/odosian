export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg hex-bg px-4 relative">
      {/* Attack particles */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[20%] right-[10%] w-[3px] h-[3px] rounded-full bg-danger animate-float-1" />
        <div className="absolute top-[60%] left-[8%] w-[3px] h-[3px] rounded-full bg-severity-high animate-float-2" />
      </div>

      <div className="w-full max-w-[420px] animate-fade-in-up relative z-10">
        {/* Shield logo */}
        <div className="text-center mb-8">
          <div className="inline-block animate-pulse-cyan rounded-full p-1">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#4CBDFA">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            </svg>
          </div>
          <div className="text-2xl font-extrabold tracking-[4px] mt-3 text-primary">
            ODOSIAN
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

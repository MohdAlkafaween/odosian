"use client";

import { useToastStore } from "@/stores/toast";

const typeClasses = {
  success: "bg-success/90 backdrop-blur-xl border border-white/[0.06]",
  error: "bg-danger/90 backdrop-blur-xl border border-white/[0.06]",
  info: "bg-primary/90 backdrop-blur-xl border border-white/[0.06]",
  warning: "bg-warning/90 backdrop-blur-xl border border-white/[0.06]",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${typeClasses[toast.type]} text-white px-5 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 animate-fade-in-up pointer-events-auto`}
        >
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/70 hover:text-white shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

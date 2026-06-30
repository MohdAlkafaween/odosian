"use client";

import { type SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, required, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary"
          >
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-text-secondary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors cursor-pointer ${
            error ? "border-danger" : "border-border"
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

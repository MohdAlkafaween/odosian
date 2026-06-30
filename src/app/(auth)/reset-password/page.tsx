"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 shadow-[0_0_40px_rgba(76,189,250,0.05)]">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text mb-2">Shield Key Reset</h2>
          <p className="text-sm text-text-secondary mb-4">
            Your password has been reset successfully.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 btn-primary-gradient text-bg rounded-lg text-sm font-bold hover:shadow-[0_4px_16px_rgba(76,189,250,0.3)] transition-all"
          >
            Shield Up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-8 shadow-[0_0_40px_rgba(76,189,250,0.05)]">
      <h2 className="text-xl font-bold text-text mb-1">New Shield Key</h2>
      <p className="text-sm text-text-muted mb-6">Set a new password for your account</p>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Button type="submit" className="w-full" loading={loading}>
          Reset Shield Key
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="bg-surface border border-border rounded-xl p-8"><div className="h-48 animate-pulse bg-surface-light rounded-lg" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

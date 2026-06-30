"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-8 shadow-[0_0_40px_rgba(76,189,250,0.05)]">
      <h2 className="text-xl font-bold text-text mb-1">Reset Shield Access</h2>
      <p className="text-sm text-text-muted mb-6">We&apos;ll send a reset link to your email</p>

      {sent ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            If an account with that email exists, we&apos;ve sent a password reset link.
            Check your inbox.
          </p>
          <Link href="/login" className="text-primary hover:underline text-sm">
            &larr; Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="defender@example.com"
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            Send Shield Reset
          </Button>
        </form>
      )}
      {!sent && (
        <p className="text-sm text-center mt-4">
          <Link href="/login" className="text-primary hover:underline">
            &larr; Back to login
          </Link>
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (res.ok) router.replace("/dashboard");
    }).catch(() => {});
  }, [router]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.error?.includes("verify")) {
          addToast("warning", "Please verify your email before logging in.");
        } else if (res.status === 423) {
          addToast("error", data.error || "Account is locked. Try again later.");
        } else {
          setErrors({ form: data.error || "Invalid credentials" });
        }
        return;
      }

      setAuth(data.user, data.token);
      addToast("success", "Welcome back!");
      router.push("/dashboard");
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-8 shadow-[0_0_40px_rgba(76,189,250,0.05)]">
      <h2 className="text-xl font-bold text-text mb-1">Welcome back, defender</h2>
      <p className="text-sm text-text-muted mb-6">Sign into your command center</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg px-4 py-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            </svg>
            {errors.form}
          </div>
        )}
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="defender@example.com"
          required
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="••••••••"
          required
        />
        <Button type="submit" className="w-full gap-2" loading={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
          </svg>
          Shield Up
        </Button>
      </form>
      <div className="flex justify-between mt-4 text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="text-primary hover:underline">
          Join the wall &rarr;
        </Link>
      </div>
    </div>
  );
}

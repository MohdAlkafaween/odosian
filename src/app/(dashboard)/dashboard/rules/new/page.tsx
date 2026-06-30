"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RuleForm, type RuleFormData } from "@/components/rule-form";
import { useToastStore } from "@/stores/toast";
import { Spinner } from "@/components/ui/loading";

function CreateRuleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);

  const fromTemplate = searchParams.get("fromTemplate") === "1";
  const initialData: Partial<RuleFormData> | undefined = fromTemplate
    ? {
        title: searchParams.get("title") || "",
        description: searchParams.get("description") || "",
        query: searchParams.get("query") || "",
        language: searchParams.get("language") || "kuery",
        ruleType: searchParams.get("ruleType") || "query",
        tags: (() => {
          try { return JSON.parse(searchParams.get("tags") || "[]") as string[]; } catch { return []; }
        })(),
      }
    : undefined;

  const handleSubmit = async (data: RuleFormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) {
        addToast("error", result.error || "Failed to create rule");
        return;
      }

      addToast("success", "Rule created successfully");
      router.push(`/dashboard/rules/${result.rule.id}`);
    } catch {
      addToast("error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold text-text">Forge New Shield</h1>
        <p className="text-sm text-text-secondary mt-1">
          {fromTemplate ? "Creating rule from template" : "Define a new Elastic SIEM detection rule"}
        </p>
      </div>
      <RuleForm
        initialData={initialData}
        onSubmit={handleSubmit}
        submitLabel="Create Rule"
        loading={loading}
        onCancel={() => router.push("/dashboard/rules")}
      />
    </div>
  );
}

export default function CreateRulePage() {
  return (
    <Suspense fallback={<Spinner size="lg" />}>
      <CreateRuleContent />
    </Suspense>
  );
}

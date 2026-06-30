"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RuleForm, type RuleFormData } from "@/components/rule-form";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loading";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

export default function EditRulePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [rule, setRule] = useState<(RuleFormData & { id: string; version: number; authorId: string; customFields?: Array<{ fieldName: string; fieldValue: string; fieldType: string }> }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchRule = async () => {
      try {
        const res = await fetch(`/api/rules/${params.id}`);
        if (!res.ok) {
          addToast("error", "Rule not found");
          router.push("/dashboard/rules");
          return;
        }
        const data = await res.json();
        setRule(data.rule);
      } catch {
        addToast("error", "Failed to load rule");
        router.push("/dashboard/rules");
      } finally {
        setLoading(false);
      }
    };
    fetchRule();
  }, [params.id, router, addToast]);

  useEffect(() => {
    if (!loading && rule && user) {
      if (rule.authorId !== user.id && user.role !== "ADMIN") {
        addToast("error", "You can only edit your own rules");
        router.push(`/dashboard/rules/${params.id}`);
      }
    }
  }, [loading, rule, user, router, params.id, addToast]);

  const handleSubmit = async (data: RuleFormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rules/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) {
        addToast("error", result.error || "Failed to update rule");
        return;
      }

      addToast("success", "Rule updated successfully");
      router.push(`/dashboard/rules/${params.id}`);
    } catch {
      addToast("error", "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!rule) return null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Edit Shield Rule</h1>
          <p className="text-sm text-text-secondary mt-1">{rule.title}</p>
        </div>
        <Badge preset={"draft"}>v{rule.version}</Badge>
      </div>
      <RuleForm
        initialData={rule}
        onSubmit={handleSubmit}
        submitLabel="Update Rule"
        loading={saving}
        onCancel={() => router.push(`/dashboard/rules/${params.id}`)}
      />
    </div>
  );
}

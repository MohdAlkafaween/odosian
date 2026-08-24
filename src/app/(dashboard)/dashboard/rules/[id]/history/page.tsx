"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";
import { DeploymentList } from "@/components/deployment-list";
import { RuleHistory } from "@/components/rule-history";
import { useOpenPageTab } from "@/hooks/use-open-page-tab";

export default function RuleAnalysisHistoryPage() {
  const params = useParams();
  const { openRule } = useOpenPageTab();
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleLanguage, setRuleLanguage] = useState("kuery");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/rules/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.rule) {
          setRuleTitle(d.rule.title);
          setRuleLanguage(d.rule.language);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-5xl">
      <button
        onClick={() => openRule(params.id as string, ruleTitle)}
        className="text-sm text-text-secondary hover:text-primary mb-4 inline-block"
      >
        ← Back to Rule
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">AI Analysis History</h1>
          {ruleTitle && <p className="text-sm text-text-muted mt-1">{ruleTitle}</p>}
        </div>
      </div>

      <RuleHistory ruleId={params.id as string} ruleLanguage={ruleLanguage} ruleTitle={ruleTitle} />

      <div className="mt-8">
        <h2 className="text-lg font-bold text-text mb-3">Deployments to Elastic</h2>
        <DeploymentList ruleId={params.id as string} />
      </div>
    </div>
  );
}

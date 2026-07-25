"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { MonacoQueryEditor } from "@/components/monaco-query-editor";
import { RULE_CATEGORIES } from "@/lib/rule-category";

const CATEGORY_OPTIONS = [
  { value: "", label: "Uncategorized" },
  ...RULE_CATEGORIES.map((c) => ({ value: c, label: c })),
];

interface CustomFieldDef {
  id: string;
  fieldName: string;
  label: string;
  fieldType: string;
  options: string;
  required: boolean;
  defaultValue: string;
}

export interface RuleFormData {
  title: string;
  description: string;
  query: string;
  ruleType: string;
  severity: string;
  language: string;
  riskScore: number;
  index: string;
  tags: string[];
  client: string;
  category: string;
  interval: string;
  fromTime: string;
  maxSignals: number;
  investigationGuide: string;
  references: string[];
  falsePositives: string[];
  status: string;
  customFields?: Array<{ fieldName: string; fieldValue: string; fieldType: string }>;
}

interface RuleFormProps {
  initialData?: Partial<RuleFormData>;
  onSubmit: (data: RuleFormData) => Promise<void>;
  submitLabel: string;
  loading: boolean;
  onCancel: () => void;
}

const RULE_TYPES = [
  { value: "query", label: "Query" },
  { value: "eql", label: "EQL" },
  { value: "threshold", label: "Threshold" },
  { value: "new_terms", label: "New Terms" },
  { value: "machine_learning", label: "Machine Learning" },
];

const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const LANGUAGES = [
  { value: "kuery", label: "KQL (Kuery)" },
  { value: "eql", label: "EQL" },
  { value: "lucene", label: "Lucene" },
  { value: "esql", label: "ES|QL" },
];

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "production", label: "Production" },
  { value: "deprecated", label: "Deprecated" },
];

export function RuleForm({ initialData, onSubmit, submitLabel, loading, onCancel }: RuleFormProps) {
  const [form, setForm] = useState<RuleFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    query: initialData?.query || "",
    ruleType: initialData?.ruleType || "query",
    severity: initialData?.severity || "medium",
    language: initialData?.language || "kuery",
    riskScore: initialData?.riskScore ?? 50,
    index: initialData?.index || "",
    tags: initialData?.tags || [],
    client: initialData?.client || "",
    category: initialData?.category || "",
    interval: initialData?.interval || "5m",
    fromTime: initialData?.fromTime || "now-6m",
    maxSignals: initialData?.maxSignals ?? 100,
    investigationGuide: initialData?.investigationGuide || "",
    references: initialData?.references || [],
    falsePositives: initialData?.falsePositives || [],
    status: initialData?.status || "draft",
  });

  const [tagInput, setTagInput] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    if (initialData?.customFields) {
      for (const cf of initialData.customFields) {
        values[cf.fieldName] = cf.fieldValue;
      }
    }
    return values;
  });

  useEffect(() => {
    fetch("/api/rules/clients")
      .then((r) => r.json())
      .then((data) => setClientSuggestions(data.clients || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/custom-fields")
      .then((r) => r.json())
      .then((data) => {
        if (data.customFields) {
          setCustomFieldDefs(data.customFields);
          setCustomFieldValues((prev) => {
            const merged = { ...prev };
            for (const def of data.customFields as CustomFieldDef[]) {
              if (!(def.fieldName in merged)) {
                merged[def.fieldName] = def.defaultValue || "";
              }
            }
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!form.title || form.title.length < 3) {
      setErrors({ title: "Title must be at least 3 characters" });
      return;
    }
    if (!form.query) {
      setErrors({ query: "Detection query is required" });
      return;
    }

    const submitData: RuleFormData = {
      ...form,
      customFields: customFieldDefs.map((def) => ({
        fieldName: def.fieldName,
        fieldValue: customFieldValues[def.fieldName] || "",
        fieldType: def.fieldType,
      })),
    };
    await onSubmit(submitData);
  };

  const addTag = () => {
    const newTags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !form.tags.includes(t));
    if (newTags.length > 0) {
      setForm({ ...form, tags: [...form.tags, ...newTags] });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const addListItem = (field: "references" | "falsePositives") => {
    setForm({ ...form, [field]: [...form[field], ""] });
  };

  const updateListItem = (field: "references" | "falsePositives", index: number, value: string) => {
    const updated = [...form[field]];
    updated[index] = value;
    setForm({ ...form, [field]: updated });
  };

  const removeListItem = (field: "references" | "falsePositives", index: number) => {
    setForm({ ...form, [field]: form[field].filter((_, i) => i !== index) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-text">Basic Information</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Suspicious PowerShell Encoded Command"
            error={errors.title}
            required
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe what this rule detects and why it matters..."
            rows={3}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={STATUSES}
          />
          <Input
            label="Client"
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.target.value })}
            placeholder="e.g., Acme Corp, Internal, Client-X"
            list="client-suggestions"
          />
          <datalist id="client-suggestions">
            {clientSuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={CATEGORY_OPTIONS}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-text">Rule Configuration</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Rule Type"
              value={form.ruleType}
              onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
              options={RULE_TYPES}
            />
            <Select
              label="Severity"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              options={SEVERITIES}
            />
            <Select
              label="Language"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              options={LANGUAGES}
            />
            <Input
              label="Risk Score (0-100)"
              type="number"
              value={String(form.riskScore)}
              onChange={(e) =>
                setForm({ ...form, riskScore: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })
              }
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-text">Detection Query</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Query <span className="text-danger">*</span>
            </label>
            <MonacoQueryEditor
              value={form.query}
              onChange={(v) => setForm({ ...form, query: v })}
              language={form.language}
            />
            {errors.query && <p className="text-xs text-danger mt-1">{errors.query}</p>}
          </div>
          <Input
            label="Index Patterns"
            value={form.index}
            onChange={(e) => setForm({ ...form, index: e.target.value })}
            placeholder="e.g., logs-endpoint.events.*, winlogbeat-*"
            helperText="Comma-separated index patterns"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-text">Scheduling</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Interval"
              value={form.interval}
              onChange={(e) => setForm({ ...form, interval: e.target.value })}
              placeholder="5m"
              helperText="e.g., 5m, 1h, 30s"
            />
            <Input
              label="From Time"
              value={form.fromTime}
              onChange={(e) => setForm({ ...form, fromTime: e.target.value })}
              placeholder="now-6m"
            />
            <Input
              label="Max Signals"
              type="number"
              value={String(form.maxSignals)}
              onChange={(e) =>
                setForm({ ...form, maxSignals: Math.max(1, parseInt(e.target.value) || 100) })
              }
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-text">Tags</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-primary/60 hover:text-primary"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tags (comma-separated)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addTag} size="sm">
              Add
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-text">Investigation Guide</h3>
        </CardHeader>
        <CardBody>
          <Textarea
            value={form.investigationGuide}
            onChange={(e) => setForm({ ...form, investigationGuide: e.target.value })}
            placeholder="Steps for analysts to follow when this rule triggers..."
            rows={6}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">References</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => addListItem("references")}>
              + Add Reference
            </Button>
          </div>
        </CardHeader>
        {form.references.length > 0 && (
          <CardBody className="space-y-2">
            {form.references.map((ref, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={ref}
                  onChange={(e) => updateListItem("references", i, e.target.value)}
                  placeholder="https://..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeListItem("references", i)}
                  className="text-danger shrink-0"
                >
                  Remove
                </Button>
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">False Positives</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => addListItem("falsePositives")}>
              + Add Entry
            </Button>
          </div>
        </CardHeader>
        {form.falsePositives.length > 0 && (
          <CardBody className="space-y-2">
            {form.falsePositives.map((fp, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={fp}
                  onChange={(e) => updateListItem("falsePositives", i, e.target.value)}
                  placeholder="Describe a known false positive scenario..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeListItem("falsePositives", i)}
                  className="text-danger shrink-0"
                >
                  Remove
                </Button>
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      {customFieldDefs.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-text">Custom Fields</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            {customFieldDefs.map((def) => {
              const val = customFieldValues[def.fieldName] || "";
              const onChange = (v: string) =>
                setCustomFieldValues((prev) => ({ ...prev, [def.fieldName]: v }));

              if (def.fieldType === "boolean") {
                return (
                  <label key={def.fieldName} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={val === "true"}
                      onChange={(e) => onChange(e.target.checked ? "true" : "false")}
                      className="w-4 h-4 rounded border-border bg-surface accent-primary"
                    />
                    <span className="text-sm text-text">{def.label}</span>
                  </label>
                );
              }

              if (def.fieldType === "select") {
                let opts: string[] = [];
                try { opts = JSON.parse(def.options); } catch { /* ignore */ }
                return (
                  <Select
                    key={def.fieldName}
                    label={def.label}
                    value={val}
                    onChange={(e) => onChange(e.target.value)}
                    options={[
                      { value: "", label: `Select ${def.label}...` },
                      ...opts.map((o) => ({ value: o, label: o })),
                    ]}
                  />
                );
              }

              if (def.fieldType === "textarea") {
                return (
                  <Textarea
                    key={def.fieldName}
                    label={def.label}
                    value={val}
                    onChange={(e) => onChange(e.target.value)}
                    rows={3}
                  />
                );
              }

              return (
                <Input
                  key={def.fieldName}
                  label={def.label}
                  type={def.fieldType === "number" ? "number" : "text"}
                  value={val}
                  onChange={(e) => onChange(e.target.value)}
                />
              );
            })}
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

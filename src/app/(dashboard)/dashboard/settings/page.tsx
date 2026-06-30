"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/loading";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import { WebhooksTab } from "./webhooks-tab";
import { CustomFieldsTab } from "./custom-fields-tab";

interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
  label: string;
}

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  isDefault: boolean;
  maxTokens: number;
  temperature: number;
  costPerInputToken: number;
  costPerOutputToken: number;
}

interface PromptItem {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  systemPromptPreview: string;
  isActive: boolean;
  isDefault: boolean;
  version: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI Configuration",
  display: "Display Preferences",
  export: "Export Settings",
  analysis: "Analysis Configuration",
};

const SELECT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  "display.defaultLanguage": [
    { value: "kuery", label: "KQL" }, { value: "eql", label: "EQL" },
    { value: "lucene", label: "Lucene" }, { value: "esql", label: "ES|QL" },
  ],
  "display.defaultRuleType": [
    { value: "query", label: "Query" }, { value: "threshold", label: "Threshold" },
    { value: "eql", label: "EQL" }, { value: "machine_learning", label: "Machine Learning" },
  ],
  "export.defaultFormat": [
    { value: "json", label: "JSON" }, { value: "ndjson", label: "NDJSON" }, { value: "csv", label: "CSV" },
  ],
};

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [settings, setSettings] = useState<Record<string, Setting[]>>({});
  const [providers, setProviders] = useState<Provider[]>([]);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [savingCategories, setSavingCategories] = useState<Set<string>>(new Set());
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.status === 403) { setLoading(false); return; }
      const data = await res.json();
      setSettings(data.settings || {});
      setProviders(data.providers || []);
      setPrompts(data.prompts || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-bold text-text mb-2">Access Denied</h2>
        <p className="text-text-secondary">Only administrators can manage settings.</p>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  const getEditedValue = (key: string, original: string) =>
    editedValues[key] !== undefined ? editedValues[key] : original;

  const setEditedValue = (key: string, value: string) =>
    setEditedValues((prev) => ({ ...prev, [key]: value }));

  const saveCategory = async (category: string) => {
    const categorySettings = settings[category] || [];
    const toSave = categorySettings.filter((s) => editedValues[s.key] !== undefined && editedValues[s.key] !== s.value);
    if (toSave.length === 0) { addToast("info", "No changes to save"); return; }

    setSavingCategories((prev) => new Set([...prev, category]));
    try {
      for (const s of toSave) {
        const res = await fetch(`/api/settings/${s.key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: editedValues[s.key] }),
        });
        if (!res.ok) {
          const data = await res.json();
          addToast("error", data.error || `Failed to save ${s.key}`);
          return;
        }
      }
      addToast("success", "Settings saved");
      setEditedValues((prev) => {
        const next = { ...prev };
        for (const s of toSave) delete next[s.key];
        return next;
      });
      fetchSettings();
    } catch { addToast("error", "Failed to save settings"); }
    finally { setSavingCategories((prev) => { const next = new Set(prev); next.delete(category); return next; }); }
  };

  const saveProvider = async () => {
    if (!editingProvider) return;
    setSavingProvider(true);
    try {
      const res = await fetch(`/api/settings/providers/${editingProvider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingProvider.name,
          baseUrl: editingProvider.baseUrl,
          model: editingProvider.model,
          isActive: editingProvider.isActive,
          isDefault: editingProvider.isDefault,
          maxTokens: editingProvider.maxTokens,
          temperature: editingProvider.temperature,
        }),
      });
      if (!res.ok) { const d = await res.json(); addToast("error", d.error || "Failed"); return; }
      addToast("success", "Provider updated");
      setEditingProvider(null);
      fetchSettings();
    } catch { addToast("error", "Failed to update provider"); }
    finally { setSavingProvider(false); }
  };

  const savePrompt = async () => {
    if (!editingPrompt) return;
    setSavingPrompt(true);
    try {
      const res = await fetch(`/api/settings/prompts/${editingPrompt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: editingPrompt.systemPrompt,
          description: editingPrompt.description,
          isActive: editingPrompt.isActive,
          isDefault: editingPrompt.isDefault,
        }),
      });
      if (!res.ok) { const d = await res.json(); addToast("error", d.error || "Failed"); return; }
      addToast("success", "Prompt updated");
      setEditingPrompt(null);
      fetchSettings();
    } catch { addToast("error", "Failed to update prompt"); }
    finally { setSavingPrompt(false); }
  };

  const isJsonSetting = (key: string) => key === "analysis.scoringWeights";
  const isNumberSetting = (key: string) =>
    ["ai.temperature", "ai.maxTokens", "ai.maxRetries"].includes(key);

  const tabs = [
    { id: "general", label: "General Settings" },
    { id: "providers", label: "AI Providers" },
    { id: "prompts", label: "Prompts" },
    { id: "webhooks", label: "Webhooks" },
    { id: "customfields", label: "Custom Fields" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold text-text">Shield Configuration</h1>
        <p className="text-sm text-text-secondary mt-1">Manage system configuration, AI providers, and prompts</p>
      </div>

      <Tabs tabs={tabs} defaultTab="general">
        {(activeTab) => (
          <>
            {activeTab === "general" && (
              <div className="space-y-6">
                {Object.entries(settings).map(([category, items]) => (
                  <Card key={category}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-text">{CATEGORY_LABELS[category] || category}</h2>
                        <Button
                          size="sm"
                          onClick={() => saveCategory(category)}
                          loading={savingCategories.has(category)}
                        >
                          Save
                        </Button>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      {items.map((s) => (
                        <div key={s.key}>
                          {SELECT_OPTIONS[s.key] ? (
                            <Select
                              label={s.label || s.key}
                              value={getEditedValue(s.key, s.value)}
                              onChange={(e) => setEditedValue(s.key, e.target.value)}
                              options={SELECT_OPTIONS[s.key]}
                            />
                          ) : isJsonSetting(s.key) ? (
                            <Textarea
                              label={s.label || s.key}
                              value={getEditedValue(s.key, s.value)}
                              onChange={(e) => setEditedValue(s.key, e.target.value)}
                              rows={8}
                              className="font-mono text-xs"
                            />
                          ) : isNumberSetting(s.key) ? (
                            <Input
                              label={s.label || s.key}
                              type="number"
                              value={getEditedValue(s.key, s.value)}
                              onChange={(e) => setEditedValue(s.key, e.target.value)}
                              step={s.key === "ai.temperature" ? "0.1" : "1"}
                            />
                          ) : (
                            <Input
                              label={s.label || s.key}
                              value={getEditedValue(s.key, s.value)}
                              onChange={(e) => setEditedValue(s.key, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "providers" && (
              <div className="space-y-4">
                {editingProvider && (
                  <Card className="border-primary/30">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-text">Edit Provider: {editingProvider.name}</h2>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingProvider(null)}>Cancel</Button>
                          <Button size="sm" onClick={saveProvider} loading={savingProvider}>Save</Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Name" value={editingProvider.name} onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })} />
                        <Input label="Model" value={editingProvider.model} onChange={(e) => setEditingProvider({ ...editingProvider, model: e.target.value })} />
                        <Input label="Base URL" value={editingProvider.baseUrl} onChange={(e) => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })} />
                        <Input label="Max Tokens" type="number" value={String(editingProvider.maxTokens)} onChange={(e) => setEditingProvider({ ...editingProvider, maxTokens: parseInt(e.target.value) || 0 })} />
                        <Input label="Temperature" type="number" step="0.1" value={String(editingProvider.temperature)} onChange={(e) => setEditingProvider({ ...editingProvider, temperature: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-text">
                          <input type="checkbox" checked={editingProvider.isActive} onChange={(e) => setEditingProvider({ ...editingProvider, isActive: e.target.checked })} className="accent-primary" />
                          Active
                        </label>
                        <label className="flex items-center gap-2 text-sm text-text">
                          <input type="checkbox" checked={editingProvider.isDefault} onChange={(e) => setEditingProvider({ ...editingProvider, isDefault: e.target.checked })} className="accent-primary" />
                          Default
                        </label>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {providers.map((p) => (
                  <Card key={p.id}>
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-text">{p.name}</h3>
                            {p.isDefault && <Badge preset="production">Default</Badge>}
                            <Badge preset={p.isActive ? "reviewed" : "deprecated"}>
                              {p.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex gap-4 text-xs text-text-muted">
                            <span>Model: <span className="text-text-secondary">{p.model}</span></span>
                            <span>Max Tokens: <span className="text-text-secondary">{p.maxTokens}</span></span>
                            <span>Temp: <span className="text-text-secondary">{p.temperature}</span></span>
                          </div>
                          <p className="text-xs text-text-muted mt-1 font-mono">{p.baseUrl}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setEditingProvider({ ...p })}>Edit</Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "webhooks" && <WebhooksTab />}

            {activeTab === "customfields" && <CustomFieldsTab />}

            {activeTab === "prompts" && (
              <div className="space-y-4">
                {editingPrompt && (
                  <Card className="border-primary/30">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-text">Edit Prompt: {editingPrompt.name}</h2>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingPrompt(null)}>Cancel</Button>
                          <Button size="sm" onClick={savePrompt} loading={savingPrompt}>Save</Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <Input label="Description" value={editingPrompt.description} onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })} />
                      <Textarea
                        label="System Prompt"
                        value={editingPrompt.systemPrompt}
                        onChange={(e) => setEditingPrompt({ ...editingPrompt, systemPrompt: e.target.value })}
                        rows={16}
                        className="font-mono text-xs"
                      />
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-text">
                          <input type="checkbox" checked={editingPrompt.isActive} onChange={(e) => setEditingPrompt({ ...editingPrompt, isActive: e.target.checked })} className="accent-primary" />
                          Active
                        </label>
                        <label className="flex items-center gap-2 text-sm text-text">
                          <input type="checkbox" checked={editingPrompt.isDefault} onChange={(e) => setEditingPrompt({ ...editingPrompt, isDefault: e.target.checked })} className="accent-primary" />
                          Default
                        </label>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {prompts.map((p) => (
                  <Card key={p.id}>
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-text">{p.name}</h3>
                            <Badge preset="info">v{p.version}</Badge>
                            {p.isDefault && <Badge preset="production">Default</Badge>}
                            <Badge preset={p.isActive ? "reviewed" : "deprecated"}>
                              {p.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-secondary mb-1">{p.description}</p>
                          <p className="text-xs text-text-muted font-mono line-clamp-2">{p.systemPromptPreview}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setEditingPrompt({ ...p })}>Edit</Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}

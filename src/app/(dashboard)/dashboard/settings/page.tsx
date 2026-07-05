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
  apiKeySet: boolean;
  apiKeyHint: string;
  apiKey?: string;
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

interface KaliConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  isActive: boolean;
  lastUsed: string | null;
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
  const [kaliConnections, setKaliConnections] = useState<KaliConnection[]>([]);
  const [editingKali, setEditingKali] = useState<Partial<KaliConnection> | null>(null);
  const [savingKali, setSavingKali] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsRes, kaliRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/attack-lab/kali/settings"),
      ]);
      if (settingsRes.status === 403) { setLoading(false); return; }
      const data = await settingsRes.json();
      setSettings(data.settings || {});
      setProviders(data.providers || []);
      setPrompts(data.prompts || []);
      if (kaliRes.ok) {
        const kaliData = await kaliRes.json();
        setKaliConnections(kaliData.connections || []);
      }
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
          ...(editingProvider.apiKey ? { apiKey: editingProvider.apiKey } : {}),
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

  const saveKali = async () => {
    if (!editingKali || !editingKali.host) return;
    setSavingKali(true);
    try {
      const res = await fetch("/api/attack-lab/kali/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingKali),
      });
      if (!res.ok) { const d = await res.json(); addToast("error", d.error || "Failed"); return; }
      addToast("success", editingKali.id ? "Connection updated" : "Connection created");
      setEditingKali(null);
      fetchSettings();
    } catch { addToast("error", "Failed to save connection"); }
    finally { setSavingKali(false); }
  };

  const testProvider = async (providerId: string) => {
    setTestingProvider(true);
    try {
      const res = await fetch("/api/analysis/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "process.name: test", language: "kuery" }),
      });
      if (res.ok) addToast("success", "AI provider connection successful");
      else {
        const data = await res.json();
        addToast("error", `Connection test failed: ${data.error || "Unknown error"}`);
      }
    } catch { addToast("error", "Connection test failed"); }
    finally { setTestingProvider(false); }
  };

  const isJsonSetting = (key: string) => key === "analysis.scoringWeights";
  const isNumberSetting = (key: string) =>
    ["ai.temperature", "ai.maxTokens", "ai.maxRetries"].includes(key);

  const tabs = [
    { id: "general", label: "General Settings" },
    { id: "providers", label: "AI Providers" },
    { id: "connections", label: "API & Connections" },
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
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            API Key
                            {editingProvider.apiKeySet && !editingProvider.apiKey && (
                              <span className="ml-2 text-text-muted font-normal">Current: {editingProvider.apiKeyHint}</span>
                            )}
                          </label>
                          <div className="relative">
                            <input
                              type="password"
                              value={editingProvider.apiKey || ""}
                              onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                              placeholder={editingProvider.apiKeySet ? "Leave blank to keep current key" : "Enter API key"}
                              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                              autoComplete="off"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {editingProvider.apiKeySet ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-text-muted mt-1">
                            {editingProvider.apiKeySet
                              ? "Key is set and encrypted. Enter a new value to replace it."
                              : "No API key configured. AI features will not work without one."}
                          </p>
                        </div>
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
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-text-muted font-mono">{p.baseUrl}</p>
                            <span className={`text-xs flex items-center gap-1 ${p.apiKeySet ? "text-success" : "text-warning"}`}>
                              {p.apiKeySet ? (
                                <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                                  Key: {p.apiKeyHint}
                                </>
                              ) : (
                                <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                  No API key
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {p.isDefault && (
                            <Button variant="ghost" size="sm" onClick={() => testProvider(p.id)} loading={testingProvider}>Test</Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setEditingProvider({ ...p })}>Edit</Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "connections" && (
              <div className="space-y-6">
                {/* AI Provider Test */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-text">AI Provider Connection</h2>
                      <Button size="sm" onClick={() => testProvider(providers[0]?.id)} loading={testingProvider}>
                        Test Connection
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <p className="text-sm text-text-secondary mb-2">
                      Test the active AI provider connection. This sends a minimal query to verify API key and endpoint are working.
                    </p>
                    {providers.filter((p) => p.isDefault).map((p) => (
                      <div key={p.id} className="flex items-center gap-3 bg-surface-light rounded-lg px-4 py-3 border border-border">
                        <Badge preset="production">Default</Badge>
                        <span className="text-sm text-text font-medium">{p.name}</span>
                        <span className="text-xs text-text-muted">({p.model})</span>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                {/* Kali Connections */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-text">Kali Linux Connections</h2>
                      <Button size="sm" onClick={() => setEditingKali({ name: "", host: "", port: 22, username: "kali", authType: "password", isActive: true })}>
                        Add Connection
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <p className="text-xs text-text-muted mb-2">
                      Configure SSH connections to Kali Linux machines for the Attack Simulation Lab.
                    </p>

                    {editingKali && (
                      <div className="bg-surface-light border border-primary/30 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-text">
                            {editingKali.id ? "Edit Connection" : "New Connection"}
                          </h3>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingKali(null)}>Cancel</Button>
                            <Button size="sm" onClick={saveKali} loading={savingKali}>Save</Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input label="Name" value={editingKali.name || ""} onChange={(e) => setEditingKali({ ...editingKali, name: e.target.value })} placeholder="My Kali Lab" />
                          <Input label="Host" value={editingKali.host || ""} onChange={(e) => setEditingKali({ ...editingKali, host: e.target.value })} placeholder="192.168.1.100" />
                          <Input label="Port" type="number" value={String(editingKali.port || 22)} onChange={(e) => setEditingKali({ ...editingKali, port: parseInt(e.target.value) || 22 })} />
                          <Input label="Username" value={editingKali.username || "kali"} onChange={(e) => setEditingKali({ ...editingKali, username: e.target.value })} />
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm text-text">
                            <input type="checkbox" checked={editingKali.isActive !== false} onChange={(e) => setEditingKali({ ...editingKali, isActive: e.target.checked })} className="accent-primary" />
                            Active
                          </label>
                        </div>
                      </div>
                    )}

                    {kaliConnections.length === 0 && !editingKali && (
                      <p className="text-sm text-text-muted text-center py-4">No Kali connections configured. Add one to use the Attack Simulation Lab.</p>
                    )}

                    {kaliConnections.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-surface-light rounded-lg px-4 py-3 border border-border">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-text">{c.name}</span>
                            <Badge preset={c.isActive ? "reviewed" : "deprecated"}>
                              {c.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted font-mono">{c.username}@{c.host}:{c.port}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setEditingKali({ ...c })}>Edit</Button>
                      </div>
                    ))}
                  </CardBody>
                </Card>
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/loading";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToastStore } from "@/stores/toast";

interface FolderNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
  _count: { rules: number; children: number };
}

interface FolderDetail extends FolderNode {
  children: FolderNode[];
  rules: RuleItem[];
}

interface RuleItem {
  id: string;
  title: string;
  severity: string;
  status: string;
  ruleType: string;
  language: string;
  client: string;
  tags: string[];
  updatedAt: string;
  author: { id: string; name: string };
}

const FOLDER_COLORS = [
  "#4CBDFA", "#A78BFA", "#34D399", "#FBBF24", "#FB7185",
  "#F97316", "#6ED1CA", "#E879F9", "#60A5FA", "#F472B6",
];

function buildTree(folders: FolderNode[]): FolderNode[] {
  const childIds = new Set(folders.filter((f) => f.parentId).map((f) => f.id));
  return folders.filter((f) => !f.parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function getChildren(folders: FolderNode[], parentId: string): FolderNode[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function countTotalRules(folders: FolderNode[], folderId: string): number {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return 0;
  let total = folder._count.rules;
  const children = folders.filter((f) => f.parentId === folderId);
  for (const child of children) {
    total += countTotalRules(folders, child.id);
  }
  return total;
}

export default function FoldersPage() {
  const { addToast } = useToastStore();

  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderDetail, setFolderDetail] = useState<FolderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("#4CBDFA");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("#4CBDFA");

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [unassignedRules, setUnassignedRules] = useState<RuleItem[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/folders");
      const data = await res.json();
      if (res.ok) setFolders(data.folders || []);
    } catch {
      addToast("error", "Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const fetchFolderDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/folders/${id}`);
      const data = await res.json();
      if (res.ok) setFolderDetail(data.folder);
    } catch {
      addToast("error", "Failed to load folder details");
    } finally {
      setDetailLoading(false);
    }
  };

  const selectFolder = (id: string) => {
    setSelectedFolder(id);
    fetchFolderDetail(id);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription,
          color: newColor,
          parentId: createParentId,
        }),
      });
      if (res.ok) {
        addToast("success", "Folder created");
        setShowCreate(false);
        setNewName("");
        setNewDescription("");
        setNewColor("#4CBDFA");
        setCreateParentId(null);
        fetchFolders();
        if (createParentId) {
          setExpanded((prev) => new Set([...prev, createParentId]));
        }
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to create folder");
      }
    } catch {
      addToast("error", "Failed to create folder");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      const res = await fetch(`/api/folders/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDescription, color: editColor }),
      });
      if (res.ok) {
        addToast("success", "Folder updated");
        setEditingId(null);
        fetchFolders();
        if (selectedFolder === editingId) fetchFolderDetail(editingId);
      }
    } catch {
      addToast("error", "Failed to update folder");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/folders/${deleteConfirm}`, { method: "DELETE" });
      if (res.ok) {
        addToast("success", "Folder deleted");
        if (selectedFolder === deleteConfirm) {
          setSelectedFolder(null);
          setFolderDetail(null);
        }
        fetchFolders();
      }
    } catch {
      addToast("error", "Failed to delete folder");
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const openAssignModal = async () => {
    setShowAssign(true);
    setAssignSearch("");
    setAssignSelected(new Set());
    try {
      const res = await fetch("/api/rules?folderId=none&limit=100");
      const data = await res.json();
      if (res.ok) setUnassignedRules(data.rules || []);
    } catch { /* ignore */ }
  };

  const handleAssign = async () => {
    if (assignSelected.size === 0 || !selectedFolder) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/folders/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleIds: [...assignSelected], folderId: selectedFolder }),
      });
      if (res.ok) {
        addToast("success", `${assignSelected.size} rule(s) assigned`);
        setShowAssign(false);
        fetchFolders();
        fetchFolderDetail(selectedFolder);
      }
    } catch {
      addToast("error", "Failed to assign rules");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (ruleId: string) => {
    try {
      const res = await fetch("/api/folders/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleIds: [ruleId], folderId: null }),
      });
      if (res.ok) {
        addToast("success", "Rule removed from folder");
        fetchFolders();
        if (selectedFolder) fetchFolderDetail(selectedFolder);
      }
    } catch {
      addToast("error", "Failed to remove rule");
    }
  };

  const filteredUnassigned = unassignedRules.filter((r) =>
    r.title.toLowerCase().includes(assignSearch.toLowerCase())
  );

  const renderFolderNode = (folder: FolderNode, depth: number = 0) => {
    const children = getChildren(folders, folder.id);
    const isExpanded = expanded.has(folder.id);
    const isSelected = selectedFolder === folder.id;
    const totalRules = countTotalRules(folders, folder.id);

    return (
      <div key={folder.id}>
        <div
          className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
            isSelected
              ? "bg-primary/10 text-primary border border-primary/20"
              : "hover:bg-surface-light text-text-secondary hover:text-text border border-transparent"
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => selectFolder(folder.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, folderId: folder.id });
          }}
        >
          {children.length > 0 ? (
            <button
              onClick={(e) => toggleExpand(folder.id, e)}
              className="shrink-0 w-4 h-4 flex items-center justify-center text-text-muted hover:text-text"
            >
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
              >
                <path d="M3 1l4 4-4 4z" />
              </svg>
            </button>
          ) : (
            <span className="w-4" />
          )}

          <svg width="16" height="16" viewBox="0 0 24 24" fill={folder.color} className="shrink-0">
            {isExpanded && children.length > 0 ? (
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
            ) : (
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            )}
          </svg>

          <span className="truncate flex-1 font-medium">{folder.name}</span>

          {totalRules > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-light text-text-muted">
              {totalRules}
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCreateParentId(folder.id);
              setShowCreate(true);
            }}
            className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 flex items-center justify-center text-text-muted hover:text-primary transition-all"
            title="New subfolder"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        </div>

        {isExpanded && children.map((child) => renderFolderNode(child, depth + 1))}
      </div>
    );
  };

  if (loading) return <PageLoader />;

  const rootFolders = buildTree(folders);
  const deletingFolder = deleteConfirm ? folders.find((f) => f.id === deleteConfirm) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Rule Folders</h1>
          <p className="text-sm text-text-muted mt-1">Organize detection rules into categories</p>
        </div>
        <Button onClick={() => { setCreateParentId(null); setShowCreate(true); }}>
          <span className="text-base">+</span> New Folder
        </Button>
      </div>

      <div className="flex gap-6 min-h-[600px]">
        {/* Tree panel */}
        <div className="w-80 shrink-0 bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border bg-surface-light">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
              File Explorer
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {rootFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="mb-3 opacity-30">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
                <p className="text-xs">No folders yet</p>
              </div>
            ) : (
              rootFolders.map((f) => renderFolderNode(f))
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
          {!selectedFolder ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                title="Select a folder"
                description="Choose a folder from the tree to view its contents"
              />
            </div>
          ) : detailLoading ? (
            <PageLoader />
          ) : folderDetail ? (
            <>
              <div className="px-6 py-4 border-b border-border bg-surface-light flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill={folderDetail.color}>
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                  <div>
                    <h2 className="text-lg font-bold text-text">{folderDetail.name}</h2>
                    {folderDetail.description && (
                      <p className="text-xs text-text-muted mt-0.5">{folderDetail.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={openAssignModal}>
                    + Add Rules
                  </Button>
                  <button
                    onClick={() => {
                      setEditingId(folderDetail.id);
                      setEditName(folderDetail.name);
                      setEditDescription(folderDetail.description);
                      setEditColor(folderDetail.color);
                    }}
                    className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text transition-all"
                    title="Edit folder"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(folderDetail.id)}
                    className="p-2 rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-all"
                    title="Delete folder"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {folderDetail.children.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Subfolders</p>
                    <div className="grid grid-cols-2 gap-2">
                      {folderDetail.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => {
                            selectFolder(child.id);
                            setExpanded((prev) => new Set([...prev, folderDetail.id]));
                          }}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-bg hover:border-primary/30 hover:bg-surface-light transition-all text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={child.color}>
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                          </svg>
                          <span className="text-sm text-text truncate">{child.name}</span>
                          <span className="text-[10px] text-text-muted ml-auto">{child._count.rules}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {folderDetail.rules.length === 0 && folderDetail.children.length === 0 ? (
                  <EmptyState
                    title="Empty folder"
                    description="Add rules to this folder to organize your detection arsenal"
                    actionLabel="Add Rules"
                    onAction={openAssignModal}
                  />
                ) : folderDetail.rules.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Rules ({folderDetail.rules.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {folderDetail.rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-bg hover:border-primary/20 transition-all group"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-muted">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/dashboard/rules/${rule.id}`}
                              className="text-sm font-medium text-primary hover:underline truncate block"
                            >
                              {rule.title}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge preset={rule.severity as "low" | "medium" | "high" | "critical"} />
                              <span className="text-[10px] text-text-muted">{rule.language.toUpperCase()}</span>
                              {rule.client && (
                                <span className="text-[10px] text-text-muted">{rule.client}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnassign(rule.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                            title="Remove from folder"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 13H5v-2h14v2z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setCreateParentId(contextMenu.folderId);
              setShowCreate(true);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface-light w-full text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
            New Subfolder
          </button>
          <button
            onClick={() => {
              const f = folders.find((f) => f.id === contextMenu.folderId);
              if (f) {
                setEditingId(f.id);
                setEditName(f.name);
                setEditDescription(f.description);
                setEditColor(f.color);
              }
              setContextMenu(null);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface-light w-full text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
            Rename
          </button>
          <button
            onClick={() => {
              setDeleteConfirm(contextMenu.folderId);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger/10 w-full text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            Delete
          </button>
        </div>
      )}

      {/* Create folder modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-text mb-4">
              {createParentId ? "New Subfolder" : "New Folder"}
            </h2>
            {createParentId && (
              <p className="text-xs text-text-muted mb-3">
                Inside: {folders.find((f) => f.id === createParentId)?.name}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Credential Access, Network Monitoring..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Color</label>
                <div className="flex gap-2">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        newColor === c ? "border-white scale-110" : "border-transparent hover:scale-105"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => { setShowCreate(false); setNewName(""); setNewDescription(""); setCreateParentId(null); }}>Cancel</Button>
              <Button loading={creating} disabled={!newName.trim()} onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit folder modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-text mb-4">Edit Folder</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Color</label>
                <div className="flex gap-2">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        editColor === c ? "border-white scale-110" : "border-transparent hover:scale-105"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button disabled={!editName.trim()} onClick={handleEdit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign rules modal */}
      {showAssign && selectedFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-semibold text-text mb-1">Add Rules to Folder</h2>
            <p className="text-xs text-text-muted mb-4">Select unassigned rules to add to this folder</p>
            <input
              type="text"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Search rules..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
            />
            <div className="flex-1 overflow-y-auto border border-border rounded-lg">
              {filteredUnassigned.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No unassigned rules found</p>
              ) : (
                filteredUnassigned.map((rule) => (
                  <label
                    key={rule.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-light cursor-pointer border-b border-border last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={assignSelected.has(rule.id)}
                      onChange={() => {
                        setAssignSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(rule.id)) next.delete(rule.id); else next.add(rule.id);
                          return next;
                        });
                      }}
                      className="rounded border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{rule.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge preset={rule.severity as "low" | "medium" | "high" | "critical"} />
                        <span className="text-[10px] text-text-muted">{rule.status}</span>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="text-xs text-text-muted">
                {assignSelected.size} selected
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Button>
                <Button loading={assigning} disabled={assignSelected.size === 0} onClick={handleAssign}>
                  Add to Folder
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Folder"
        message={`Delete "${deletingFolder?.name}"? ${
          (deletingFolder?._count.children ?? 0) > 0
            ? "All subfolders will also be deleted. "
            : ""
        }Rules will be unassigned but not deleted.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

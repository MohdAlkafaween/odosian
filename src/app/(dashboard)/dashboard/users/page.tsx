"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageLoader } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  _count: { rules: number; analyses: number };
  [key: string]: unknown;
}

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "ANALYST", label: "Analyst" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const { addToast } = useToastStore();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [currentUser, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (role) params.set("role", role);
      if (status) params.set("isActive", status === "active" ? "true" : "false");

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
      }
    } catch {
      addToast("error", "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search, role, status, addToast]);

  useEffect(() => {
    if (currentUser?.role === "ADMIN") fetchUsers();
  }, [fetchUsers, currentUser]);

  const handleToggleRole = async (u: UserRow) => {
    const newRole = u.role === "ADMIN" ? "ANALYST" : "ADMIN";
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      addToast("success", `Role changed to ${newRole}`);
      fetchUsers();
    } else {
      const err = await res.json();
      addToast("error", err.error || "Failed to update role");
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      addToast("success", u.isActive ? "User deactivated" : "User activated");
      fetchUsers();
    } else {
      const err = await res.json();
      addToast("error", err.error || "Failed to update status");
    }
  };

  const handleUnlock = async (u: UserRow) => {
    const res = await fetch(`/api/users/${u.id}/unlock`, { method: "POST" });
    if (res.ok) {
      addToast("success", "User unlocked");
      fetchUsers();
    } else {
      addToast("error", "Failed to unlock user");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      addToast("success", "User deleted");
      fetchUsers();
    } else {
      const err = await res.json();
      addToast("error", err.error || "Failed to delete user");
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const isLocked = (u: UserRow) => u.lockedUntil && new Date(u.lockedUntil) > new Date();
  const isSelf = (u: UserRow) => u.id === currentUser?.id;

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never";

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (row: Record<string, unknown>) => {
        const u = row as unknown as UserRow;
        return (
          <div>
            <p className="font-medium text-text">{u.name}</p>
            <p className="text-xs text-text-muted">{u.email}</p>
          </div>
        );
      },
    },
    {
      key: "role",
      header: "Role",
      render: (row: Record<string, unknown>) => {
        const u = row as unknown as UserRow;
        return <Badge preset={u.role === "ADMIN" ? "critical" : "info"}>{u.role}</Badge>;
      },
    },
    {
      key: "isActive",
      header: "Status",
      render: (row: Record<string, unknown>) => {
        const u = row as unknown as UserRow;
        if (isLocked(u)) return <Badge preset="high">Locked</Badge>;
        return u.isActive ? <Badge preset="production">Active</Badge> : <Badge preset="deprecated">Inactive</Badge>;
      },
    },
    {
      key: "stats",
      header: "Rules / Analyses",
      render: (row: Record<string, unknown>) => {
        const u = row as unknown as UserRow;
        return <span className="text-text-secondary text-sm">{u._count.rules} / {u._count.analyses}</span>;
      },
    },
    {
      key: "lastLoginAt",
      header: "Last Login",
      render: (row: Record<string, unknown>) => {
        const u = row as unknown as UserRow;
        return <span className="text-text-secondary text-xs">{formatDate(u.lastLoginAt)}</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: Record<string, unknown>) => {
        const u = row as unknown as UserRow;
        if (isSelf(u)) return <span className="text-text-muted text-xs">You</span>;
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => handleToggleRole(u)}>
              {u.role === "ADMIN" ? "Demote" : "Promote"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
              {u.isActive ? "Deactivate" : "Activate"}
            </Button>
            {isLocked(u) && (
              <Button variant="ghost" size="sm" onClick={() => handleUnlock(u)}>Unlock</Button>
            )}
            <Button variant="danger" size="sm" onClick={() => setDeleteTarget(u)}>Delete</Button>
          </div>
        );
      },
    },
  ];

  if (currentUser?.role !== "ADMIN") return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Shield Defenders</h1>
          <p className="text-sm text-text-secondary mt-1">Manage platform users and their roles</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchInput onSearch={(q) => { setSearch(q); setPage(1); }} placeholder="Search users..." />
        </div>
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} options={ROLE_OPTIONS} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_OPTIONS} />
      </div>

      {loading ? (
        <PageLoader />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" description="Try adjusting your filters" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={users as unknown as Record<string, unknown>[]}
            keyField="id"
          />
          <div className="flex justify-center mt-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

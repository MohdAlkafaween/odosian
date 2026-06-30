"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      addToast("error", "All password fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("error", "New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      addToast("error", "Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      addToast("error", "Password must contain uppercase, lowercase, number, and special character");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (res.ok) {
        addToast("success", "Password changed successfully");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to change password");
      }
    } catch {
      addToast("error", "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold text-text">Defender Profile</h1>
        <p className="text-sm text-text-secondary mt-1">View your account info and change your password</p>
      </div>

      <Card className="mb-6">
        <CardHeader><h2 className="font-semibold text-text">Account Information</h2></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-muted mb-1">Name</p>
              <p className="text-sm text-text font-medium">{user.name}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Email</p>
              <p className="text-sm text-text">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Role</p>
              <Badge preset={user.role as "ADMIN" | "ANALYST"}>{user.role}</Badge>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Email Verified</p>
              <Badge preset={user.emailVerified ? "production" : "high"}>
                {user.emailVerified ? "Verified" : "Not Verified"}
              </Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-text">Change Password</h2></CardHeader>
        <CardBody>
          <div className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <p className="text-xs text-text-muted">
              Must be at least 8 characters with uppercase, lowercase, number, and special character.
            </p>
            <Button onClick={handleChangePassword} loading={saving}>
              Change Password
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

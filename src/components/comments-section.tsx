"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function UserInitial({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
      {initial}
    </div>
  );
}

export function CommentsSection({ ruleId }: { ruleId: string }) {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/rules/${ruleId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [ruleId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/rules/${ruleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        setContent("");
        fetchComments();
        addToast("success", "Comment added");
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to add comment");
      }
    } catch {
      addToast("error", "Failed to add comment");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/rules/${ruleId}/comments/${commentId}`, { method: "DELETE" });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        addToast("success", "Comment deleted");
      } else {
        addToast("error", "Failed to delete comment");
      }
    } catch {
      addToast("error", "Failed to delete comment");
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
        </svg>
        Comments
        {comments.length > 0 && (
          <span className="text-sm font-normal text-text-muted">({comments.length})</span>
        )}
      </h2>

      <div className="mb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          maxLength={2000}
          rows={3}
          className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-border-focus resize-none"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-text-muted">{content.length}/2000</span>
          <Button size="sm" onClick={handlePost} loading={posting} disabled={!content.trim()}>
            Post Comment
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-6">No comments yet. Be the first to comment.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 p-3 rounded-lg bg-surface-light/50 border border-border/50">
              <UserInitial name={c.user.name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-text">{c.user.name}</span>
                  <span className="text-xs text-text-muted">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{c.content}</p>
              </div>
              {(user?.id === c.user.id || user?.role === "ADMIN") && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="shrink-0 p-1 text-text-muted hover:text-danger transition-colors self-start"
                  title="Delete comment"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

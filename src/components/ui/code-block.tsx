"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  maxHeight?: string;
  formatQuery?: boolean;
}

function formatDetectionQuery(code: string): string {
  if (!code || code.length < 40) return code;
  return code
    .replace(/\s+(and|or|not)\s+/gi, (_, kw) => `\n  ${kw} `)
    .replace(/\s*\|\s*/g, "\n| ")
    .replace(/\s*(from|where|stats|eval|keep|drop|sort|limit|rename|dissect|grok|enrich|mv_expand)\s+/gi, (_, kw) => `\n${kw} `);
}

export function CodeBlock({
  code,
  language = "yaml",
  maxHeight = "400px",
  formatQuery = false,
}: CodeBlockProps) {
  const displayCode = formatQuery ? formatDetectionQuery(code) : code;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-xl border border-border bg-bg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-light">
        <span className="text-xs text-text-muted font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-text-secondary hover:text-text transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre
        className="p-4 overflow-auto font-mono text-sm text-text"
        style={{ maxHeight }}
      >
        <code>{displayCode}</code>
      </pre>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

let monacoStatus: "pending" | "ready" | "failed" = "pending";
let monacoPromise: Promise<typeof import("monaco-editor")> | null = null;

function initMonaco() {
  if (monacoPromise) return monacoPromise;
  monacoPromise = import("monaco-editor").then((monaco) => {
    self.MonacoEnvironment = {
      getWorker: () =>
        new Worker(
          new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
        ),
    };
    monacoStatus = "ready";
    return monaco;
  }).catch((err) => {
    monacoStatus = "failed";
    throw err;
  });
  return monacoPromise;
}

const LANGUAGE_MAP: Record<string, string> = {
  kuery: "plaintext",
  eql: "plaintext",
  lucene: "plaintext",
  esql: "sql",
};

interface MonacoQueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: number;
}

export function MonacoQueryEditor({
  value,
  onChange,
  language = "kuery",
  readOnly = false,
  height = 200,
}: MonacoQueryEditorProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [ready, setReady] = useState(monacoStatus === "ready");
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  useEffect(() => {
    if (monacoStatus === "ready") { setReady(true); return; }
    if (monacoStatus === "failed") { setUseFallback(true); return; }
    initMonaco().then((monaco) => {
      monacoRef.current = monaco;
      setReady(true);
    }).catch(() => {
      setUseFallback(true);
    });
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || editorRef.current) return;

    const getMonaco = async () => {
      const monaco = monacoRef.current || await initMonaco();
      monacoRef.current = monaco;

      monaco.editor.defineTheme("odosian", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#0D1117",
          "editor.foreground": "#E6EDF3",
          "editor.lineHighlightBackground": "#161B22",
          "editorCursor.foreground": "#4CBDFA",
          "editor.selectionBackground": "#4CBDFA33",
        },
      });

      const editor = monaco.editor.create(containerRef.current!, {
        value,
        language: LANGUAGE_MAP[language] || "plaintext",
        theme: "odosian",
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbers: "on",
        wordWrap: "on",
        tabSize: 2,
        padding: { top: 8, bottom: 8 },
        renderLineHighlight: "line",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { vertical: "auto", horizontal: "auto" },
        automaticLayout: true,
      });

      editor.onDidChangeModelContent(() => {
        onChange(editor.getValue());
      });

      editorRef.current = editor;
    };

    getMonaco();

    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (!editorRef.current) return;
    const currentValue = editorRef.current.getValue();
    if (value !== currentValue) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (model) {
      monacoRef.current.editor.setModelLanguage(model, LANGUAGE_MAP[language] || "plaintext");
    }
  }, [language]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  if (useFallback) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(5, Math.ceil(height / 24))}
        className="font-mono text-sm"
        readOnly={readOnly}
      />
    );
  }

  if (!ready) {
    return <div className="bg-bg border border-border rounded-lg animate-pulse" style={{ height }} />;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div ref={containerRef} style={{ height }} />
      <button
        type="button"
        onClick={() => {
          editorRef.current?.dispose();
          editorRef.current = null;
          setUseFallback(true);
        }}
        className="block w-full text-center text-xs text-text-muted py-1 hover:text-text-secondary bg-surface-light border-t border-border"
      >
        Switch to plain editor
      </button>
    </div>
  );
}

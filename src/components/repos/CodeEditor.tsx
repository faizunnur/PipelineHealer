"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { getLanguage } from "@/lib/repo-browser/lang";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface CodeEditorProps {
  filename: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export function CodeEditor({ filename, value, onChange, readOnly = false }: CodeEditorProps) {
  const language = getLanguage(filename);

  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      onChange={(val) => onChange?.(val ?? "")}
      options={{
        readOnly,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        fontLigatures: true,
        minimap: { enabled: true, scale: 1 },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        renderLineHighlight: "all",
        cursorBlinking: "smooth",
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 },
        tabSize: 2,
        wordWrap: "off",
        bracketPairColorization: { enabled: true },
        formatOnPaste: false,
        automaticLayout: true,
      }}
    />
  );
}

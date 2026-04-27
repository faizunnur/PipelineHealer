"use client";

import { useState, useCallback } from "react";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  FileText, FileCode, FileJson, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  sha?: string;
}

interface FileTreeProps {
  integrationId: string;
  repo: string;
  ref: string;
  rootItems: TreeItem[];
  selectedFile: string | null;
  onFileClick: (path: string) => void;
  refreshKey?: number;
}

export function FileTree({
  integrationId, repo, ref, rootItems, selectedFile, onFileClick,
}: FileTreeProps) {
  return (
    <div className="py-1 select-none">
      {rootItems.map((item) => (
        <TreeNode
          key={item.path}
          item={item}
          depth={0}
          integrationId={integrationId}
          repo={repo}
          ref={ref}
          selectedFile={selectedFile}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  item: TreeItem;
  depth: number;
  integrationId: string;
  repo: string;
  ref: string;
  selectedFile: string | null;
  onFileClick: (path: string) => void;
}

function TreeNode({ item, depth, integrationId, repo, ref, selectedFile, onFileClick }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggle = useCallback(async () => {
    if (item.type !== "dir") return;
    if (!expanded && children.length === 0) {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/repos/tree?integrationId=${integrationId}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(item.path)}&ref=${encodeURIComponent(ref)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setChildren(data.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  }, [expanded, children.length, integrationId, repo, ref, item.path, item.type]);

  const indent = depth * 12;

  if (item.type === "file") {
    const isSelected = selectedFile === item.path;
    return (
      <button
        onClick={() => onFileClick(item.path)}
        className={cn(
          "flex items-center gap-1.5 w-full text-left py-0.5 pr-2 text-xs rounded hover:bg-muted/60 transition-colors group",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${8 + indent}px` }}
        title={item.path}
      >
        <FileIcon name={item.name} className={cn("w-3.5 h-3.5 flex-shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
        <span className="truncate">{item.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 w-full text-left py-0.5 pr-2 text-xs rounded hover:bg-muted/60 transition-colors"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        <span className="w-3 flex-shrink-0 flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
        </span>
        {expanded ? (
          <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-yellow-400" />
        ) : (
          <Folder className="w-3.5 h-3.5 flex-shrink-0 text-yellow-400" />
        )}
        <span className="truncate font-medium">{item.name}</span>
      </button>

      {error && (
        <p className="text-xs text-destructive pl-10 py-0.5">{error}</p>
      )}

      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              item={child}
              depth={depth + 1}
              integrationId={integrationId}
              repo={repo}
              ref={ref}
              selectedFile={selectedFile}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon({ name, className }: { name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["json", "jsonc"].includes(ext)) return <FileJson className={className} />;
  if (["ts", "tsx", "js", "jsx", "py", "go", "rs", "rb", "java", "cs", "cpp", "c"].includes(ext))
    return <FileCode className={className} />;
  return <FileText className={className} />;
}

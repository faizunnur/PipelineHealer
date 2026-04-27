export function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const base = filename.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    py: "python", rb: "ruby", go: "go", rs: "rust",
    java: "java", kt: "kotlin", swift: "swift",
    cs: "csharp", cpp: "cpp", cc: "cpp", cxx: "cpp", c: "c", h: "c", hpp: "cpp",
    json: "json", yaml: "yaml", yml: "yaml", toml: "ini", ini: "ini",
    md: "markdown", mdx: "markdown",
    html: "html", htm: "html", xml: "xml", svg: "xml",
    css: "css", scss: "scss", sass: "scss", less: "less",
    sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
    sql: "sql", graphql: "graphql",
    tf: "hcl", hcl: "hcl",
    php: "php", lua: "lua", r: "r",
    vue: "html", svelte: "html",
  };
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return "dockerfile";
  if (base === "makefile") return "shell";
  if (base === ".env" || base.startsWith(".env.")) return "shell";
  if (base === "jenkinsfile") return "groovy";
  return map[ext] ?? "plaintext";
}

export function isBinaryExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "gif", "webp", "ico", "svg", "pdf", "zip", "tar", "gz",
    "exe", "bin", "wasm", "ttf", "otf", "woff", "woff2", "mp4", "mp3", "wav"].includes(ext);
}

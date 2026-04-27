const GH = "https://api.github.com";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface GHRepo {
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  pushed_at: string;
  description: string | null;
}

export interface GHTreeItem {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size?: number;
  sha: string;
}

export interface GHFile {
  content: string;
  sha: string;
  size: number;
  name: string;
  path: string;
  isBinary: boolean;
}

export async function ghListRepos(token: string): Promise<GHRepo[]> {
  const all: GHRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `${GH}/user/repos?per_page=100&sort=updated&page=${page}&affiliation=owner,collaborator,organization_member`,
      { headers: headers(token) }
    );
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    const batch: GHRepo[] = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export async function ghListBranches(token: string, owner: string, repo: string) {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/branches?per_page=100`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data: { name: string; protected: boolean }[] = await res.json();
  return data;
}

export async function ghGetTree(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<GHTreeItem[]> {
  const p = path === "" || path === "." ? "" : path;
  const res = await fetch(
    `${GH}/repos/${owner}/${repo}/contents/${p}?ref=${encodeURIComponent(ref)}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Not a directory");
  return (data as Array<{ name: string; path: string; type: string; size?: number; sha: string }>).map((item) => ({
    name: item.name,
    path: item.path,
    type: (item.type === "dir" ? "dir" : "file") as "file" | "dir",
    size: item.size,
    sha: item.sha,
  }));
}

export async function ghGetFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<GHFile> {
  const res = await fetch(
    `${GH}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.type !== "file") throw new Error("Not a file");
  if (!data.content) {
    return { content: "", sha: data.sha, size: data.size, name: data.name, path: data.path, isBinary: false };
  }
  const raw = Buffer.from(data.content.replace(/\n/g, ""), "base64");
  const isBinary = raw.includes(0);
  const content = isBinary ? "" : raw.toString("utf8");
  return { content, sha: data.sha, size: data.size, name: data.name, path: data.path, isBinary };
}

export async function ghCommitFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  sha: string,
  message: string,
  branch: string
) {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub commit ${res.status}: ${await res.text()}`);
}

export async function ghCreateFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
) {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), branch }),
  });
  if (!res.ok) throw new Error(`GitHub create ${res.status}: ${await res.text()}`);
}

export async function ghDeleteFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  sha: string,
  message: string,
  branch: string
) {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/contents/${path}`, {
    method: "DELETE",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub delete ${res.status}: ${await res.text()}`);
}

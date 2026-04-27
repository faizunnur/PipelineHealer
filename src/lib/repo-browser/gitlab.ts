const GL = "https://gitlab.com/api/v4";

function headers(token: string) {
  return { "PRIVATE-TOKEN": token, "Content-Type": "application/json" };
}

export interface GLProject {
  id: number;
  name: string;
  path_with_namespace: string;
  visibility: "public" | "private" | "internal";
  default_branch: string;
  last_activity_at: string;
  description: string | null;
}

export async function glListProjects(token: string): Promise<GLProject[]> {
  const res = await fetch(
    `${GL}/projects?membership=true&per_page=100&order_by=last_activity_at`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`GitLab ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function glGetProjectId(token: string, fullPath: string): Promise<number> {
  const res = await fetch(`${GL}/projects/${encodeURIComponent(fullPath)}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`GitLab ${res.status}`);
  const data = await res.json();
  return data.id as number;
}

export async function glListBranches(token: string, projectId: number) {
  const res = await fetch(`${GL}/projects/${projectId}/repository/branches?per_page=100`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`GitLab ${res.status}`);
  const data: { name: string; protected: boolean }[] = await res.json();
  return data;
}

export async function glGetTree(
  token: string,
  projectId: number,
  path: string,
  ref: string
) {
  const pathParam = path && path !== "." ? `&path=${encodeURIComponent(path)}` : "";
  const res = await fetch(
    `${GL}/projects/${projectId}/repository/tree?ref=${encodeURIComponent(ref)}&per_page=100${pathParam}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`GitLab ${res.status}: ${await res.text()}`);
  const data: { id: string; name: string; type: "blob" | "tree"; path: string; mode: string }[] = await res.json();
  return data.map((item) => ({
    name: item.name,
    path: item.path,
    type: (item.type === "tree" ? "dir" : "file") as "file" | "dir",
    sha: item.id,
  }));
}

export async function glGetFile(token: string, projectId: number, filePath: string, ref: string) {
  const encoded = encodeURIComponent(filePath);
  const res = await fetch(
    `${GL}/projects/${projectId}/repository/files/${encoded}?ref=${encodeURIComponent(ref)}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`GitLab ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = Buffer.from(data.content, "base64");
  const isBinary = raw.includes(0);
  const content = isBinary ? "" : raw.toString("utf8");
  return {
    content,
    sha: data.blob_id as string,
    size: data.size as number,
    name: data.file_name as string,
    path: data.file_path as string,
    isBinary,
  };
}

export async function glCommitFile(
  token: string,
  projectId: number,
  filePath: string,
  content: string,
  message: string,
  branch: string
) {
  const encoded = encodeURIComponent(filePath);
  const res = await fetch(`${GL}/projects/${projectId}/repository/files/${encoded}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify({ branch, content, commit_message: message, encoding: "text" }),
  });
  if (!res.ok) throw new Error(`GitLab commit ${res.status}: ${await res.text()}`);
}

export async function glCreateFile(
  token: string,
  projectId: number,
  filePath: string,
  content: string,
  message: string,
  branch: string
) {
  const encoded = encodeURIComponent(filePath);
  const res = await fetch(`${GL}/projects/${projectId}/repository/files/${encoded}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ branch, content, commit_message: message, encoding: "text" }),
  });
  if (!res.ok) throw new Error(`GitLab create ${res.status}: ${await res.text()}`);
}

export async function glDeleteFile(
  token: string,
  projectId: number,
  filePath: string,
  message: string,
  branch: string
) {
  const encoded = encodeURIComponent(filePath);
  const res = await fetch(`${GL}/projects/${projectId}/repository/files/${encoded}`, {
    method: "DELETE",
    headers: headers(token),
    body: JSON.stringify({ branch, commit_message: message }),
  });
  if (!res.ok) throw new Error(`GitLab delete ${res.status}: ${await res.text()}`);
}

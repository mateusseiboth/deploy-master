import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import type { GitLabBranch, GitLabCommit, Project } from "@/lib/types";

const KEY = ["projects"];

export function useProjects() {
  return useQuery({ queryKey: KEY, queryFn: () => unwrap<Project[]>(api.get("/projects")) });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => unwrap<Project>(api.get(`/projects/${id}`)),
    enabled: !!id,
  });
}

export interface CreateProjectInput {
  name: string;
  gitlabProjectId: string;
  repositoryUrl: string;
  gitlabToken: string;
  dockerfilePath?: string;
  databaseStrategy?: "UPLOAD_SQL" | "COPY_PRODUCTION";
  baseDomain?: string;
  variables?: { key: string; required?: boolean; defaultValue?: string }[];
  deadline?: { defaultDays?: number; maxDays?: number; maxRenewals?: number };
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => unwrap<Project>(api.post("/projects", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Navegação GitLab (branch → commit) ──────────────────────────────────────

export function useBranches(projectId: string) {
  return useQuery({
    queryKey: [...KEY, projectId, "branches"],
    queryFn: () => unwrap<GitLabBranch[]>(api.get(`/projects/${projectId}/gitlab/branches`)),
    enabled: !!projectId,
  });
}

export function useCommits(projectId: string, branch: string) {
  return useQuery({
    queryKey: [...KEY, projectId, "commits", branch],
    queryFn: () => unwrap<GitLabCommit[]>(api.get(`/projects/${projectId}/gitlab/commits`, { params: { branch } })),
    enabled: !!projectId && !!branch,
  });
}

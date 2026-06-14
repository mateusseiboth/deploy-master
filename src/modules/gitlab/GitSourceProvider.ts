import { join } from "path";
import { rm, mkdir } from "fs/promises";
import { env } from "@config/env";
import { exec } from "@core/process/exec";
import { Injectable } from "@di/Injectable";
import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { ISourceProvider } from "@modules/deploy/domain/ports";

/**
 * Implementação de `ISourceProvider` via git CLI, autenticando na URL com o
 * token do projeto. Responsabilidade única: obter o código no commit desejado.
 */
@Injectable()
export class GitSourceProvider implements ISourceProvider {
  private workdirFor(ctx: DeployContext): string {
    return join(env.docker.workspaceDir, ctx.slug);
  }

  /** Injeta o token na URL https do GitLab (oauth2). */
  private authenticatedUrl(ctx: DeployContext): string {
    const url = new URL(ctx.project.repositoryUrl);
    url.username = "oauth2";
    url.password = ctx.project.gitlabToken;
    return url.toString();
  }

  async clone(ctx: DeployContext): Promise<void> {
    const workdir = this.workdirFor(ctx);
    await rm(workdir, { recursive: true, force: true });
    await mkdir(workdir, { recursive: true });

    await exec("git", [
      "clone",
      "--branch", ctx.request.branch,
      "--no-single-branch",
      this.authenticatedUrl(ctx),
      workdir,
    ]);
    ctx.workdir = workdir;
  }

  async checkout(ctx: DeployContext): Promise<void> {
    if (!ctx.workdir) throw new Error("clone deve ocorrer antes do checkout");
    await exec("git", ["checkout", ctx.request.commitHash], { cwd: ctx.workdir });
  }

  async cleanup(ctx: DeployContext): Promise<void> {
    if (ctx.workdir) await rm(ctx.workdir, { recursive: true, force: true });
  }
}

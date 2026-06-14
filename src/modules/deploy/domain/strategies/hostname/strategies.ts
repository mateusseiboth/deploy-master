import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import { slugifySegment, type IHostnameStrategy } from "./IHostnameStrategy";

/** {projeto}-{hash} */
export class ProjectHashHostnameStrategy implements IHostnameStrategy {
  build(ctx: DeployContext): string {
    const project = slugifySegment(ctx.project.name);
    const hash = ctx.request.commitHash.slice(0, 7);
    return `${project}-${hash}`;
  }
}

/** {projeto}-{branch} */
export class ProjectBranchHostnameStrategy implements IHostnameStrategy {
  build(ctx: DeployContext): string {
    const project = slugifySegment(ctx.project.name);
    const branch = slugifySegment(ctx.request.branch);
    return `${project}-${branch}`;
  }
}

/** {projeto}-{usuario}-{hash} */
export class ProjectUserHashHostnameStrategy implements IHostnameStrategy {
  build(ctx: DeployContext): string {
    const project = slugifySegment(ctx.project.name);
    const user = slugifySegment(ctx.request.creatorUsername);
    const hash = ctx.request.commitHash.slice(0, 7);
    return `${project}-${user}-${hash}`;
  }
}

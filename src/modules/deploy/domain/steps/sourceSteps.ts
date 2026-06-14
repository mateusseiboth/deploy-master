import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { ISourceProvider } from "@modules/deploy/domain/ports";
import { DeployStep } from "./IDeployStep";

export class CloneRepositoryStep extends DeployStep {
  readonly name = "CloneRepository";
  constructor(private readonly source: ISourceProvider) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    ctx.log(`Clonando ${ctx.project.repositoryUrl} (branch ${ctx.request.branch})`);
    await this.source.clone(ctx);
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    await this.source.cleanup(ctx);
  }
}

export class CheckoutCommitStep extends DeployStep {
  readonly name = "CheckoutCommit";
  constructor(private readonly source: ISourceProvider) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    ctx.log(`Checkout no commit ${ctx.request.commitHash}`);
    await this.source.checkout(ctx);
  }
}

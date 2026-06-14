import type { IDeployStep } from "@modules/deploy/domain/steps/IDeployStep";
import { DeployPipeline } from "./DeployPipeline";

/**
 * Builder fluente do pipeline. Responsável apenas pela ORDEM e composição dos
 * steps — a construção de cada step (com suas dependências/estratégias) é da
 * `DeployPipelineFactory`. Separação Builder × Factory mantém SRP.
 */
export class DeployPipelineBuilder {
  private readonly steps: IDeployStep[] = [];

  add(step: IDeployStep): this {
    this.steps.push(step);
    return this;
  }

  addAll(steps: IDeployStep[]): this {
    this.steps.push(...steps);
    return this;
  }

  build(): DeployPipeline {
    const pipeline = new DeployPipeline([...this.steps]);
    pipeline.assertNotEmpty();
    return pipeline;
  }
}

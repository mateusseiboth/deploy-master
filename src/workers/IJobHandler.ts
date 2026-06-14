import type { JobType } from "@core/queue/IJobQueue";

/**
 * Strategy de processamento de um tipo de job. O Worker seleciona o handler
 * pelo `type` (Strategy/Factory), mantendo o runtime agnóstico ao job (OCP).
 */
export interface IJobHandler<TPayload = unknown> {
  readonly type: JobType;
  handle(payload: TPayload): Promise<void>;
}

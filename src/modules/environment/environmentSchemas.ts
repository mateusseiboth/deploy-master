import { z } from "zod";
import { BackupSource } from "@prisma-generated/enums";
import type { CreateEnvironmentDTO } from "./EnvironmentService";

/** Schemas compartilhados entre rota (validateBody) e controller. */
export const createEnvironmentSchema: z.ZodType<CreateEnvironmentDTO> = z.object({
  projectId: z.string().min(1),
  branch: z.string().min(1),
  commitHash: z.string().min(7),
  commitAuthor: z.string().optional(),
  commitMessage: z.string().optional(),
  commitDate: z.string().optional(),
  variableOverrides: z.record(z.string(), z.string()).optional(),
  // Opcional: projetos que não dependem de banco não enviam origem de backup.
  backup: z
    .object({
      source: z.nativeEnum(BackupSource),
      filePath: z.string().optional(),
    })
    .optional(),
  dockerfilePath: z.string().optional(),
});

export const renewSchema = z.object({ days: z.number().int().positive().max(30) });
export type RenewDTO = z.infer<typeof renewSchema>;

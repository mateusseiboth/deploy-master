import { z } from "zod";
import { BackupFrequency } from "@prisma-generated/enums";

/** Agendamento de backup de um banco (validado na rota PUT /production/config/:db). */
export const backupConfigSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.nativeEnum(BackupFrequency),
    hourOfDay: z.number().int().min(0).max(23),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
  })
  .refine((v) => v.frequency !== "WEEKLY" || v.dayOfWeek != null, {
    message: "dayOfWeek é obrigatório para frequência semanal",
    path: ["dayOfWeek"],
  })
  .refine((v) => v.frequency !== "MONTHLY" || v.dayOfMonth != null, {
    message: "dayOfMonth é obrigatório para frequência mensal",
    path: ["dayOfMonth"],
  });

export type BackupConfigDTO = z.infer<typeof backupConfigSchema>;

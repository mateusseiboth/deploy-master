import { z } from "zod";

export const updateSettingsSchema = z.object({
  // Pi-hole v6 (senha do admin, sem API token)
  piholeBaseUrl: z.string().optional(),
  piholePassword: z.string().optional(),
  reverseProxyIp: z.string().optional(),
  traefikNetwork: z.string().optional(),
  baseDomain: z.string().optional(),
  // GitLab global (token geral)
  gitlabBaseUrl: z.string().optional(),
  gitlabApiToken: z.string().optional(),
  // Backup automático de produção
  prodBackupDbUrl: z.string().optional(),
  prodBackupDir: z.string().optional(),
  prodBackupIntervalHours: z.number().int().positive().optional(),
  prodBackupEnabled: z.boolean().optional(),
});

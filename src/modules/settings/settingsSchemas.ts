import { z } from "zod";

export const updateSettingsSchema = z.object({
  // Pi-hole v6 (senha do admin, sem API token)
  // Lista de servidores DNS balanceados (cada um com URL+senha).
  piholeServers: z
    .array(z.object({ baseUrl: z.string(), password: z.string() }))
    .optional(),
  piholeBaseUrl: z.string().optional(),
  piholePassword: z.string().optional(),
  reverseProxyIp: z.string().optional(),
  traefikNetwork: z.string().optional(),
  baseDomain: z.string().optional(),
  // GitLab global (token geral)
  gitlabBaseUrl: z.string().optional(),
  gitlabApiToken: z.string().optional(),
  // Conexões globais de origem para cópia de banco (produção/homologação)
  prodDbUrl: z.string().optional(),
  homologDbUrl: z.string().optional(),
  // Backup automático de produção
  prodBackupDbUrl: z.string().optional(),
  prodBackupDir: z.string().optional(),
  prodBackupEnabled: z.boolean().optional(),
});

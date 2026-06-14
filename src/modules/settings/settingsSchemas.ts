import { z } from "zod";

export const updateSettingsSchema = z.object({
  piholeBaseUrl: z.string().optional(),
  piholeApiToken: z.string().optional(),
  reverseProxyIp: z.string().optional(),
  traefikNetwork: z.string().optional(),
  baseDomain: z.string().optional(),
});

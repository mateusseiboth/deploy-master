import { z } from "zod";
import {
  CertificateProvider,
  DatabaseStrategy,
  HostnameFormat,
  ReverseProxyProvider,
} from "@prisma-generated/enums";
import type { CreateProjectDTO } from "./ProjectService";

export const createProjectSchema: z.ZodType<CreateProjectDTO> = z.object({
  name: z.string().min(1),
  gitlabProjectId: z.string().min(1),
  repositoryUrl: z.string().url(),
  gitlabToken: z.string().min(1),
  dockerfilePath: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  productionDbUrl: z.string().optional(),
  databaseStrategy: z.nativeEnum(DatabaseStrategy).optional(),
  hostnameFormat: z.nativeEnum(HostnameFormat).optional(),
  certificateProvider: z.nativeEnum(CertificateProvider).optional(),
  reverseProxy: z.nativeEnum(ReverseProxyProvider).optional(),
  baseDomain: z.string().optional(),
  variables: z
    .array(
      z.object({
        key: z.string().min(1),
        type: z.string().optional(),
        required: z.boolean().optional(),
        defaultValue: z.string().optional(),
      }),
    )
    .optional(),
  deadline: z
    .object({
      defaultDays: z.number().int().positive().optional(),
      maxDays: z.number().int().positive().optional(),
      maxRenewals: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const addVariableSchema = z.object({
  key: z.string().min(1),
  type: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().optional(),
});
export type AddVariableDTO = z.infer<typeof addVariableSchema>;

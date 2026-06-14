import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { Prisma, Project, ProjectVariable } from "@prisma-generated/client";

/** Project com seus relacionamentos de configuração carregados. */
export type ProjectWithConfig = Prisma.ProjectGetPayload<{
  include: { variables: true; deadline: true };
}>;

/** Persistência de Projetos e sua configuração de deploy. */
@Injectable()
export class ProjectDAO extends BaseDAO {
  async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.tx.project.create({ data });
  }

  async list(): Promise<Project[]> {
    return this.tx.project.findMany({ where: { enabled: true }, orderBy: { name: "asc" } });
  }

  async findById(id: string): Promise<ProjectWithConfig | null> {
    return this.tx.project.findUnique({
      where: { id },
      include: { variables: true, deadline: true },
    });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return this.tx.project.update({ where: { id }, data });
  }

  async addVariable(
    projectId: string,
    data: { key: string; type: string; required: boolean; defaultValue?: string },
  ): Promise<ProjectVariable> {
    return this.tx.projectVariable.create({
      data: { projectId, key: data.key, type: data.type, required: data.required, defaultValue: data.defaultValue },
    });
  }

  async removeVariable(projectId: string, key: string): Promise<number> {
    const result = await this.tx.projectVariable.deleteMany({ where: { projectId, key } });
    return result.count;
  }
}

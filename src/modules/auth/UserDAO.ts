import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { Prisma, User } from "@prisma-generated/client";

/** Persistência de usuários. */
@Injectable()
export class UserDAO extends BaseDAO {
  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.tx.user.create({ data });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.tx.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.tx.user.findUnique({ where: { id } });
  }
}

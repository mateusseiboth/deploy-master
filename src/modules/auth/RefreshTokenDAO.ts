import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { RefreshToken } from "@prisma-generated/client";

/** Persistência dos refresh tokens (rotação/revogação). */
@Injectable()
export class RefreshTokenDAO extends BaseDAO {
  create(data: { token: string; userId: string; expiresAt: Date }): Promise<RefreshToken> {
    return this.tx.refreshToken.create({ data });
  }

  findByToken(token: string): Promise<RefreshToken | null> {
    return this.tx.refreshToken.findUnique({ where: { token } });
  }

  revoke(id: string): Promise<unknown> {
    return this.tx.refreshToken.update({ where: { id }, data: { revoked: true } });
  }

  revokeAllForUser(userId: string): Promise<unknown> {
    return this.tx.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
  }
}

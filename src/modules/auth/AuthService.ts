import bcrypt from "bcryptjs";
import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import { ConflictError, UnauthorizedError } from "@core/errors/AppError";
import type { AuthUser } from "@core/context/requestContext";
import type { UserRole } from "@prisma-generated/enums";
import type { User } from "@prisma-generated/client";
import { UserDAO } from "./UserDAO";
import { RefreshTokenDAO } from "./RefreshTokenDAO";
import { TokenService } from "./TokenService";

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: UserRole };
}

/**
 * Regras de autenticação: hash de senha, login, rotação de refresh token e
 * logout. Stateless no access (JWT) + revogável no refresh (persistido).
 */
@Injectable()
export class AuthService extends BaseService {
  constructor(
    private readonly users: UserDAO,
    private readonly refreshTokens: RefreshTokenDAO,
    private readonly tokens: TokenService,
  ) {
    super();
  }

  async register(dto: RegisterDTO): Promise<{ id: string; email: string }> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictError("E-mail já cadastrado");

    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      password: await bcrypt.hash(dto.password, 10),
      role: dto.role,
    });
    return { id: user.id, email: user.email };
  }

  async login(credentials: Credentials): Promise<AuthTokens> {
    const user = await this.users.findByEmail(credentials.email);
    if (!user || !user.enabled) throw new UnauthorizedError("Credenciais inválidas");

    const valid = await bcrypt.compare(credentials.password, user.password);
    if (!valid) throw new UnauthorizedError("Credenciais inválidas");

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.refreshTokens.findByToken(refreshToken);
    if (!stored || stored.revoked || stored.expiresAt <= new Date()) {
      throw new UnauthorizedError("Refresh token inválido");
    }
    const user = await this.users.findById(stored.userId);
    if (!user || !user.enabled) throw new UnauthorizedError("Usuário inválido");

    // Rotação: revoga o token usado e emite um novo par.
    await this.refreshTokens.revoke(stored.id);
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByToken(refreshToken);
    if (stored && !stored.revoked) await this.refreshTokens.revoke(stored.id);
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const authUser: AuthUser = { id: user.id, role: user.role, email: user.email };
    const accessToken = this.tokens.signAccess(authUser);
    const { token: refreshToken, expiresAt } = this.tokens.issueRefresh();
    await this.refreshTokens.create({ token: refreshToken, userId: user.id, expiresAt });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}

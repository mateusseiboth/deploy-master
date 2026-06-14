import "reflect-metadata";
import { container } from "@di/container";
import { runInTransaction } from "@core/transaction/withTransaction";
import { AuthService } from "@modules/auth/AuthService";
import { UserDAO } from "@modules/auth/UserDAO";

/**
 * Cria o primeiro usuário ADMIN (bootstrap). Idempotente: não recria se o e-mail
 * já existir. Uso: `bun run seed` (variáveis ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME).
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? "admin@deploy.local";
  const password = process.env.ADMIN_PASSWORD ?? "admin12345";
  const name = process.env.ADMIN_NAME ?? "Administrador";

  await runInTransaction(async () => {
    const users = container.get(UserDAO);
    if (await users.findByEmail(email)) {
      console.log(`Admin já existe: ${email}`);
      return;
    }
    const auth = container.get(AuthService);
    const created = await auth.register({ name, email, password, role: "ADMIN" });
    console.log(`Admin criado: ${created.email} (id ${created.id})`);
  });

  process.exit(0);
}

void main();

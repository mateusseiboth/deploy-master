FROM oven/bun:1.2-alpine

WORKDIR /app

# Ferramentas usadas pelo pipeline dentro do container (git, clientes pg).
RUN apk add --no-cache git postgresql-client

# Dependências (cacheável)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Código
COPY . .
RUN bunx prisma generate

EXPOSE 3000

# Sobe API por padrão; o serviço de worker sobrescreve o command.
CMD ["bun", "src/index.ts"]

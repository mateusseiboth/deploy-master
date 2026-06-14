# Sistema de Deploy Temporário para Ambientes de QA

Desenvolva uma aplicação web completa para gerenciamento de ambientes temporários de testes (Ephemeral Environments), integrada ao GitLab.

## Objetivo

Permitir que o setor de Qualidade (QA) realize deploys isolados de qualquer branch ou commit do GitLab sem depender da equipe de desenvolvimento ou infraestrutura.

Cada ambiente criado deve possuir:

- Deploy isolado em container
- Banco de dados próprio
- Backup restaurado automaticamente
- Renovação de validade
- Remoção automática após expiração
- Auditoria completa

O sistema deve ser multiusuário e possuir controle administrativo.

---

# Fluxo Principal

## Criação de Ambiente

Usuário QA:

1. Seleciona um projeto

2. Seleciona uma branch

3. Seleciona um commit específico

4. Visualiza:
   - Hash do commit
   - Autor
   - Data
   - Mensagem do commit (obtida via API do GitLab)

5. Define:
   - Backup de banco (envia o .sql ou seleciona baixar banco de produção agora e o banco de produção é copiado)
   - Envs que podem ser alteradas, exemplo um backend que ele subiu anteriormente, coloca-se a URL aqui.

6. Aciona Deploy

O sistema então:

1. Clona o código da branch
2. Checkout no commit selecionado
3. Executa build da imagem Docker
4. Cria rede isolada
5. Provisiona banco temporário
6. Restaura backup
7. Sobrescreve variáveis de ambiente configuradas
8. Executa container
9. Disponibiliza URL de acesso

---

# Integração GitLab

Utilizar API do GitLab.

Funcionalidades:

- Listar projetos
- Listar branches
- Listar commits
- Obter detalhes do commit
- Obter mensagem do commit
- Obter autor
- Obter pipeline associado
- Validar acesso via Token

Identificador principal do deploy:

COMMIT_HASH

Exemplo:

feature-auth
↓
a84c19f
↓
env-a84c19f

---

# Gerenciamento de Banco

Ao criar ambiente:

Opção 1:

Selecionar backup existente

Opção 2:

Enviar arquivo SQL

Formatos:

- .sql
- .sql.gz

Fluxo:

1. Criar banco isolado
2. Restaurar backup
3. Configurar URL automaticamente
4. Injetar DATABASE_URL no container

Cada ambiente deve possuir seu próprio banco.

Nenhum ambiente deve compartilhar banco.

---

# Sobrescrita de Variáveis

Administrador configura previamente quais variáveis podem ser alteradas.

Exemplo:

API_URL
FEATURE_FLAG_X
EMAIL_ENABLED
S3_BUCKET

Usuário QA poderá informar valores apenas para variáveis autorizadas.

Variáveis bloqueadas:

- Secrets
- Tokens
- Chaves privadas
- Credenciais de infraestrutura

---

# Painel Administrativo

## Cadastro de Projetos

Campos:

- Nome
- Projeto GitLab
- URL do repositório
- Token GitLab
- Dockerfile Path
- Build Command
- Start Command
- URL banco produção
- Estratégia de banco

---

## Configuração de Variáveis

Lista de variáveis editáveis.

Exemplo:

Nome
Tipo
Obrigatória
Valor padrão

---

## Configuração de Prazo

Definir:

- Prazo padrão
- Prazo máximo
- Limite de renovações

Exemplo:

Padrão: 7 dias
Máximo: 30 dias

---

# Painel de Ambientes

Listagem em tempo real.

Exibir:

- Nome do ambiente
- Projeto
- Branch
- Commit
- Hash
- Autor
- Mensagem do commit
- Criador
- Data de criação
- Data de expiração
- Tempo restante
- Status
- URL

Ações:

- Renovar
- Reiniciar
- Ver logs
- Abrir ambiente
- Excluir

---

# Renovação

Quando faltar menos de X dias:

Exibir aviso visual.

Permitir:

Renovar por:

- 1 dia
- 3 dias
- 7 dias
- prazo personalizado

Respeitando limite definido pelo administrador.

---

# Expiração Automática

Job agendado.

Ao expirar:

1. Parar containers
2. Remover containers
3. Remover volumes
4. Remover banco
5. Remover rede
6. Remover imagens órfãs
7. Atualizar auditoria

Sem intervenção manual.

---

# Exclusão Manual

Usuário pode marcar ambiente para exclusão.

Fluxo:

1. Confirmar ação
2. Encerrar ambiente
3. Limpar recursos
4. Registrar auditoria

---

# Auditoria

Registrar:

- Criação
- Renovação
- Reinício
- Exclusão
- Expiração automática

Dados:

- Usuário
- Data
- IP
- Projeto
- Commit
- Ambiente

---

# Controle de Acesso

Perfis:

## Administrador

Pode:

- Configurar projetos
- Configurar variáveis
- Configurar limites
- Excluir qualquer ambiente

## QA

Pode:

- Criar ambiente
- Renovar ambiente
- Excluir ambiente próprio

## Visualizador

Pode apenas consultar.

---

# Dashboard

Indicadores:

- Ambientes ativos
- Ambientes expirando
- Ambientes expirados
- Consumo de recursos
- Deploys por projeto
- Deploys por usuário

---

# Infraestrutura

Backend:

- BunJS
- TypeScript
- Express (Ou Elysa)
- Prisma

Frontend:

- React
- TypeScript
- ShadCN
- TanStack Query

Banco:

- PostgreSQL

Infra:

- Docker
- Docker Compose

Fila:

- BullMQ

Autenticação:

- JWT + Refresh Token

---

# Requisitos Não Funcionais

- Multi-tenant
- Auditoria completa
- Logs centralizados
- Observabilidade
- Deploy idempotente
- Retry automático em falhas
- Cleanup automático
- Isolamento entre ambientes
- Controle de concorrência
- Rate limit
- RBAC

---

# Diferenciais

- Preview URLs automáticas
- Logs em tempo real
- Console web do container

# DNS Automático e Proxy Reverso

## Objetivo

Todo ambiente criado deve receber automaticamente uma URL única acessível pela rede corporativa.

O usuário não deve precisar conhecer:

- IP do container
- Porta do container
- Nome do host Docker

A URL deve ser criada automaticamente durante o deploy.

Exemplo:

frontend-a84c19f.qa.local

backend-a84c19f.qa.local

api-feature-auth.qa.local

---

# Integração com Pi-hole

O sistema deve integrar com a API do Pi-hole para gerenciamento automático de DNS.

Durante a criação do ambiente:

1. Gerar hostname único
2. Registrar entrada DNS no Pi-hole
3. Apontar para IP previamente configurado do servidor de Proxy Reverso
4. Validar propagação do registro

Exemplo:

frontend-a84c19f.qa.local
↓
10.10.10.5

Onde:

10.10.10.5 = servidor Traefik ou Caddy

---

# Proxy Reverso

Utilizar:

- Traefik (preferencial)
  ou
- Caddy

Responsabilidades:

- Descoberta automática dos containers
- Roteamento HTTP
- Roteamento HTTPS
- Geração automática de certificados
- Renovação automática de certificados
- Health Checks

Fluxo:

DNS
↓
Traefik/Caddy
↓
Container do ambiente

---

# Exposição Automática

Ao concluir o deploy:

1. Criar container
2. Registrar DNS no Pi-hole
3. Registrar rota no proxy reverso
4. Validar disponibilidade
5. Exibir URL ao usuário

Exemplo:

https://frontend-a84c19f.qa.local

https://backend-a84c19f.qa.local

---

# Certificados

Todos os ambientes devem possuir HTTPS habilitado.

Possibilidades:

## Ambiente Interno

- CA interna corporativa
- Certificados próprios confiáveis na rede

ou

## Ambiente Público

- Let's Encrypt
- Renovação automática

O sistema deve suportar ambas as estratégias.

---

# Configuração de Domínio

Administrador poderá definir:

Domínio base:

qa.local

preview.empresa.local

sandbox.empresa.local

Formato do hostname:

{projeto}-{hash}

ou

{projeto}-{branch}

ou

{projeto}-{usuario}-{hash}

Exemplos:

erp-a84c19f.qa.local

portal-feature-login.qa.local

api-mateus-a84c19f.qa.local

---

# Remoção Automática

Quando o ambiente for removido:

1. Excluir container
2. Excluir banco
3. Excluir volumes
4. Excluir rede
5. Excluir rota do proxy reverso
6. Excluir registro DNS do Pi-hole
7. Atualizar auditoria

Nenhum recurso deve permanecer órfão.

---

# Health Check

Após deploy:

O sistema deve validar:

- DNS resolvendo corretamente
- Certificado válido
- Proxy respondendo
- Aplicação respondendo
- Banco conectado

Somente após todas as verificações o ambiente será marcado como:

STATUS = READY

Caso contrário:

STATUS = FAILED

com logs detalhados para diagnóstico.

---

# URLs Relacionadas

Um ambiente poderá possuir múltiplos serviços.

Exemplo:

Frontend:
https://frontend-a84c19f.qa.local

Backend:
https://api-a84c19f.qa.local

Swagger:
https://swagger-a84c19f.qa.local

Admin:
https://admin-a84c19f.qa.local

Todos gerenciados automaticamente pelo proxy reverso.

Objetivo final: permitir que qualquer analista de QA consiga criar, utilizar, renovar e remover ambientes temporários de testes baseados em branches ou commits específicos do GitLab sem depender da equipe de desenvolvimento ou infraestrutura.

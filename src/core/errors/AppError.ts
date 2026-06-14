/**
 * Hierarquia de erros da aplicação. Carregam o status HTTP para que o
 * errorHandler traduza sem `if/else` por tipo concreto (OCP).
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400;
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
}

export class UnprocessableError extends AppError {
  readonly statusCode = 422;
}

/** Falha durante o pipeline de deploy (provisionamento de ambiente). */
export class DeployError extends AppError {
  readonly statusCode = 500;
  constructor(
    message: string,
    readonly step?: string,
    details?: unknown,
  ) {
    super(message, details);
  }
}

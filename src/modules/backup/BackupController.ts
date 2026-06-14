import type { Request, Response } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { BadRequestError } from "@core/errors/AppError";

/**
 * Recebe o upload do backup (.sql/.sql.gz) e devolve o caminho persistido, que o
 * QA informa ao criar o ambiente (`backup.filePath`). Sem transação/DB: apenas
 * armazenamento do arquivo.
 */
@Injectable()
export class BackupController extends BaseController {
  upload(req: Request, res: Response): void {
    const file = req.file;
    if (!file) throw new BadRequestError("Arquivo de backup ausente ou formato inválido (.sql/.sql.gz)");
    this.created(res, { filePath: file.path, sizeBytes: file.size, originalName: file.originalname });
  }
}

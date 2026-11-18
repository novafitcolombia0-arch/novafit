import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { jwtSecret } from "../config/security";
import { User } from "../entities";

export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * Exige una sesión válida de administrador. Además de la firma, comprueba en la base que
 * el usuario sigue existiendo, que es admin y que la sesión no se invalidó al cambiar la contraseña.
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  let decoded: { id: number; v?: number };
  try {
    decoded = jwt.verify(header.slice(7), jwtSecret(), { algorithms: ["HS256"] }) as { id: number; v?: number };
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }

  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: decoded.id },
      select: ["id", "role", "tokenVersion"],
    });
    if (!user || user.role !== "admin" || (decoded.v ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ message: "Token inválido" });
    }
    req.userId = user.id;
    next();
  } catch (err) {
    next(err);
  }
};

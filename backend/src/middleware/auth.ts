import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { jwtSecret } from "../config/security";
import { User } from "../entities";

/**
 * Roles del panel:
 *  - admin:    todo
 *  - finanzas: solo consulta Finanzas (resumen, ventas, gastos, cierres, exportar); no registra
 *              ni anula ventas, no edita gastos ni costos y no ve el resto del panel
 */
export const ROLES = ["admin", "finanzas"] as const;
export type Role = (typeof ROLES)[number];

export interface AuthRequest extends Request {
  userId?: number;
  role?: Role;
}

/**
 * Exige una sesión válida con uno de los roles indicados. Además de la firma, comprueba en la
 * base que el usuario sigue existiendo, su rol y que la sesión no se invalidó al cambiar la contraseña.
 * Sesión inválida → 401 (el panel cierra la sesión). Rol sin permiso → 403 (la sesión sigue abierta).
 */
export const requireRole = (...roles: Role[]) => async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    if (!user || !ROLES.includes(user.role as Role) || (decoded.v ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ message: "Token inválido" });
    }
    if (!roles.includes(user.role as Role)) {
      return res.status(403).json({ message: "Tu usuario no tiene permiso para esta acción" });
    }
    req.userId = user.id;
    req.role = user.role as Role;
    next();
  } catch (err) {
    next(err);
  }
};

/** Solo administradores (todo el panel salvo lo que se abra explícitamente a otros roles) */
export const authMiddleware = requireRole("admin");

/** Cualquier usuario del panel (admin o finanzas) */
export const staffMiddleware = requireRole("admin", "finanzas");

/** Para usar después de staffMiddleware en rutas de escritura: solo admin */
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) =>
  req.role === "admin" ? next() : res.status(403).json({ message: "Tu usuario solo puede consultar Finanzas" });

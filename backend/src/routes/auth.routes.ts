import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities";
import { AuthRequest, staffMiddleware } from "../middleware/auth";
import { jwtSecret, loginLimiter, passwordLimiter } from "../config/security";

const router = createRouter();
const userRepo = () => AppDataSource.getRepository(User);

// La versión (v) invalida las sesiones anteriores cuando se cambia la contraseña
const signToken = (user: User) =>
  jwt.sign({ id: user.id, role: user.role, v: user.tokenVersion }, jwtSecret(), { expiresIn: "24h", algorithm: "HS256" });

// Hash de relleno: si el correo no existe se compara igual, para no revelar por el tiempo qué correos existen
const DUMMY_HASH = bcrypt.hashSync("nova-no-user", 10);

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    return res.status(400).json({ message: "Email y contraseña requeridos" });
  }

  const user = await userRepo()
    .createQueryBuilder("u")
    .where("LOWER(u.email) = :email", { email })
    .getOne();
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !valid) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  res.json({ token: signToken(user), user: { id: user.id, email: user.email, role: user.role } });
});

router.get("/me", staffMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await userRepo().findOne({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
  res.json({ id: user.id, email: user.email, role: user.role });
});

/** Cambiar la contraseña del admin: cierra todas las demás sesiones abiertas */
router.put("/password", passwordLimiter, staffMiddleware, async (req: AuthRequest, res: Response) => {
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  const user = await userRepo().findOne({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ message: "La contraseña actual no es correcta" });
  }
  if (newPassword.length < 12) {
    return res.status(400).json({ message: "La nueva contraseña debe tener al menos 12 caracteres" });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ message: "La nueva contraseña debe ser distinta de la actual" });
  }
  if (/^(admin|password|contraseña|nova|novafit)/i.test(newPassword) || /(.)\1{5,}/.test(newPassword)) {
    return res.status(400).json({ message: "Elige una contraseña menos predecible" });
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.tokenVersion += 1;
  await userRepo().save(user);
  res.json({ message: "Contraseña actualizada. Las demás sesiones se cerraron.", token: signToken(user) });
});

export default router;

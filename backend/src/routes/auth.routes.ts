import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = createRouter();
const userRepo = () => AppDataSource.getRepository(User);

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email y contraseña requeridos" });
  }

  const user = await userRepo().findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "24h" }
  );

  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await userRepo().findOne({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
  res.json({ id: user.id, email: user.email, role: user.role });
});

export default router;

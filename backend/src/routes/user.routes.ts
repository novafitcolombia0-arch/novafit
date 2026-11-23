import { Response } from "express";
import bcrypt from "bcryptjs";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities";
import { authMiddleware, AuthRequest, ROLES, Role } from "../middleware/auth";

// Usuarios del panel: solo un administrador los crea, cambia o elimina
const router = createRouter();
router.use(authMiddleware);
const repo = () => AppDataSource.getRepository(User);

const publicUser = (u: User) => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt });

/** Mismas reglas que al cambiar la contraseña propia */
function passwordProblem(password: string): string | null {
  if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres";
  if (/^(admin|password|contraseña|nova|novafit)/i.test(password) || /(.)\1{5,}/.test(password)) {
    return "Elige una contraseña menos predecible";
  }
  return null;
}

const parseRole = (value: unknown): Role | null => (ROLES.includes(value as Role) ? (value as Role) : null);

router.get("/", async (_req: AuthRequest, res: Response) => {
  const users = await repo().find({ order: { createdAt: "ASC" } });
  res.json(users.map(publicUser));
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 120);
  const password = String(req.body?.password ?? "");
  const role = parseRole(req.body?.role);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Correo no válido" });
  if (!role) return res.status(400).json({ message: "Selecciona el tipo de usuario" });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ message: problem });

  const exists = await repo().createQueryBuilder("u").where("LOWER(u.email) = :email", { email }).getOne();
  if (exists) return res.status(409).json({ message: "Ya existe un usuario con ese correo" });

  const user = await repo().save(repo().create({ email, password: await bcrypt.hash(password, 12), role }));
  res.status(201).json(publicUser(user));
});

/** Cambiar el tipo de usuario o ponerle una contraseña nueva (cierra sus sesiones abiertas) */
router.put("/:id", async (req: AuthRequest, res: Response) => {
  const user = await repo().findOne({ where: { id: parseInt(req.params.id as string, 10) } });
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  if (req.body?.role !== undefined) {
    const role = parseRole(req.body.role);
    if (!role) return res.status(400).json({ message: "Tipo de usuario no válido" });
    if (user.id === req.userId && role !== "admin") {
      return res.status(400).json({ message: "No puedes quitarle el acceso de administrador a tu propio usuario" });
    }
    if (role !== user.role) user.tokenVersion += 1;
    user.role = role;
  }
  if (req.body?.password) {
    const password = String(req.body.password);
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });
    user.password = await bcrypt.hash(password, 12);
    user.tokenVersion += 1;
  }
  await repo().save(user);
  res.json(publicUser(user));
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (id === req.userId) return res.status(400).json({ message: "No puedes eliminar tu propio usuario" });
  const user = await repo().findOne({ where: { id } });
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
  if (user.role === "admin" && (await repo().count({ where: { role: "admin" } })) <= 1) {
    return res.status(400).json({ message: "Debe quedar al menos un administrador" });
  }
  await repo().delete(id);
  res.json({ message: "Usuario eliminado" });
});

export default router;

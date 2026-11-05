import { Router, Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 no captura errores de handlers async: un rechazo sin manejar
// tumba el proceso. Este Router envuelve cada handler para enviarlo a next().
export function createRouter() {
  const router = Router();
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    const original = router[method].bind(router) as (...args: any[]) => any;
    (router as any)[method] = (path: any, ...handlers: RequestHandler[]) =>
      original(
        path,
        ...handlers.map(
          (h) => (req: Request, res: Response, next: NextFunction) =>
            Promise.resolve(h(req, res, next)).catch(next)
        )
      );
  }
  return router;
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // 23505 = unique_violation en PostgreSQL
  if (err?.code === "23505") {
    return res.status(409).json({ message: "Ya existe un registro con ese valor (slug duplicado)" });
  }
  console.error(err?.message ?? err);
  res.status(500).json({ message: "Error interno del servidor" });
}

export function slugify(value: string) {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

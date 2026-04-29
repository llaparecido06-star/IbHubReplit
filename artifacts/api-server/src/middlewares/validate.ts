import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

/**
 * Generic Zod validation middleware.
 *
 * Usage:
 *   const Body = z.object({ name: z.string().min(1).max(120) });
 *   router.post("/foo", validateBody(Body), (req, res) => {
 *     const data = req.body as z.infer<typeof Body>;  // safe & typed
 *   });
 *
 * On failure responds with 400 and a structured list of issues so the client
 * can show field-level errors. Errors are logged at `info` level (not error)
 * because they're caused by client input, not server bugs.
 */

function fail(res: Response, where: "body" | "params" | "query", error: unknown) {
  const issues =
    typeof error === "object" && error !== null && "issues" in error
      ? (error as { issues: { path: (string | number)[]; message: string }[] }).issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      : [{ field: "", message: "Invalid request" }];

  res.status(400).json({
    error: `Invalid request ${where}`,
    issues,
  });
}

export function validateBody<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return fail(res, "body", result.error);
    (req as Request & { body: ZodInfer<S> }).body = result.data;
    next();
  };
}

export function validateParams<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return fail(res, "params", result.error);
    (req as unknown as { params: ZodInfer<S> }).params = result.data;
    next();
  };
}

export function validateQuery<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return fail(res, "query", result.error);
    (req as unknown as { query: ZodInfer<S> }).query = result.data;
    next();
  };
}

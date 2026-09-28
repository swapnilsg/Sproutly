import type { Request } from 'express';
import type { z } from 'zod';
import { HttpError } from './errors.js';

/** Parse the request body against a schema, throwing 422 with field-level errors. */
export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    throw new HttpError(422, 'validation_failed', { fields });
  }
  return result.data;
}

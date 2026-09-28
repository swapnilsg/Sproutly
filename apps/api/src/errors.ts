import type { ErrorRequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

export function errorHandler(isProduction: boolean): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, ...err.details });
      return;
    }
    // Malformed JSON bodies from express.json()
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }
    console.error(err);
    res
      .status(500)
      .json(
        isProduction
          ? { error: 'internal_error' }
          : { error: 'internal_error', message: String(err) },
      );
  };
}

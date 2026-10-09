import { NextFunction, Request, Response } from 'express';

const DEFAULT_SLOW_REQUEST_MS = 1000;

export const requestPerformance = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const configuredThreshold = Number(process.env.SLOW_REQUEST_MS);
    const thresholdMs = Number.isFinite(configuredThreshold) && configuredThreshold > 0
      ? configuredThreshold
      : DEFAULT_SLOW_REQUEST_MS;

    if (durationMs >= thresholdMs) {
      console.warn(
        `[slow-request] ${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
      );
    }
  });

  next();
};

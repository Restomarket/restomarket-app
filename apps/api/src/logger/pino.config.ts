import type { IncomingMessage } from 'http';
import type { Request, Response } from 'express';
import { type Params } from 'nestjs-pino';

export function getPinoConfig(): Params {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          }
        : undefined,
      serializers: {
        req: (req: Request) => ({
          id: req.id as string,
          method: req.method,
          url: req.url,
          query: req.query,
          params: req.params,
          headers: {
            host: req.headers.host,
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
          },
        }),
        res: (res: Response) => ({
          statusCode: res.statusCode,
        }),
      },
      redact: {
        paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
        remove: true,
      },
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          const url = req.url ?? '';
          return url === '/health' || url === '/metrics';
        },
      },
    },
  };
}

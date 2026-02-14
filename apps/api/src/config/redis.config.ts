import { registerAs } from '@nestjs/config';
import type { RedisConfig } from './config.types';

export default registerAs('redis', (): RedisConfig => {
  return {
    url: process.env.REDIS_URL!,
  };
});

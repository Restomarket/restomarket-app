import { registerAs } from '@nestjs/config';
import type { SyncConfig } from './config.types';

export default registerAs('sync', (): SyncConfig => {
  return {
    agentSecret: process.env.AGENT_SECRET,
    apiSecret: process.env.API_SECRET,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    bullmqConcurrency: parseInt(process.env.BULLMQ_CONCURRENCY ?? '5', 10),
  };
});

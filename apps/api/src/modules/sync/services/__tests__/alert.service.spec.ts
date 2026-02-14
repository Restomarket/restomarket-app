import { PinoLogger } from 'nestjs-pino';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AlertService } from '../alert.service';

describe('AlertService', () => {
  let logger: jest.Mocked<PinoLogger>;
  let httpService: jest.Mocked<HttpService>;

  const mockLogger = {
    setContext: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockLogger as any;
    httpService = mockHttpService as any;
  });

  describe('sendAlert', () => {
    it('should log alert without Slack when webhook URL not configured', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const service = new AlertService(mockConfigService as any, logger, httpService);

      await service.sendAlert('agent_offline', 'Test alert message', { vendorId: 'vendor123' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_offline',
          message: 'Test alert message',
          context: { vendorId: 'vendor123' },
        }),
        'Alert: agent_offline',
      );

      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should send Slack notification when webhook URL is configured', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/TEST/WEBHOOK/URL';
      const mockConfigService = {
        get: jest.fn().mockReturnValue(webhookUrl),
      };

      const service = new AlertService(mockConfigService as any, logger, httpService);

      httpService.post.mockReturnValue(
        of({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config: {} } as any),
      );

      await service.sendAlert('dlq_entries_found', 'DLQ has entries', { count: 5 });

      expect(logger.warn).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'warning',
              title: expect.stringContaining('Dlq Entries Found'),
              text: 'DLQ has entries',
            }),
          ]),
        }),
        { timeout: 5000 },
      );
    });

    it('should handle Slack notification errors gracefully', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/TEST/WEBHOOK/URL';
      const mockConfigService = {
        get: jest.fn().mockReturnValue(webhookUrl),
      };

      const service = new AlertService(mockConfigService as any, logger, httpService);

      httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

      await service.sendAlert('circuit_breaker_open', 'Circuit breaker opened', {
        vendorId: 'vendor123',
      });

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Network error' },
        'Failed to send Slack notification',
      );
    });

    it('should format context fields correctly for Slack', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/TEST/WEBHOOK/URL';
      const mockConfigService = {
        get: jest.fn().mockReturnValue(webhookUrl),
      };

      const service = new AlertService(mockConfigService as any, logger, httpService);

      httpService.post.mockReturnValue(
        of({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config: {} } as any),
      );

      await service.sendAlert('reconciliation_drift', 'Drift detected', {
        vendorId: 'vendor123',
        count: 10,
        threshold: 5,
      });

      expect(httpService.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              fields: expect.arrayContaining([
                { title: 'Vendor ID', value: 'vendor123', short: true },
                { title: 'Count', value: '10', short: true },
                { title: 'Threshold', value: '5', short: true },
              ]),
            }),
          ]),
        }),
        { timeout: 5000 },
      );
    });

    it('should use correct emoji and color for each alert type', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/TEST/WEBHOOK/URL';
      const mockConfigService = {
        get: jest.fn().mockReturnValue(webhookUrl),
      };

      const service = new AlertService(mockConfigService as any, logger, httpService);

      httpService.post.mockReturnValue(
        of({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config: {} } as any),
      );

      // Test agent_offline (danger/red)
      await service.sendAlert('agent_offline', 'Agent offline', {});
      expect(httpService.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'danger',
              title: expect.stringContaining('🔴'),
            }),
          ]),
        }),
        { timeout: 5000 },
      );

      // Test dlq_entries_found (warning/yellow)
      await service.sendAlert('dlq_entries_found', 'DLQ entries', {});
      expect(httpService.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'warning',
              title: expect.stringContaining('⚠️'),
            }),
          ]),
        }),
        { timeout: 5000 },
      );

      // Test circuit_breaker_open (danger/red)
      await service.sendAlert('circuit_breaker_open', 'Circuit breaker', {});
      expect(httpService.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'danger',
              title: expect.stringContaining('⚡'),
            }),
          ]),
        }),
        { timeout: 5000 },
      );

      // Test reconciliation_drift (warning/yellow)
      await service.sendAlert('reconciliation_drift', 'Drift detected', {});
      expect(httpService.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'warning',
              title: expect.stringContaining('🔄'),
            }),
          ]),
        }),
        { timeout: 5000 },
      );
    });

    it('should include timestamp in Slack payload', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/TEST/WEBHOOK/URL';
      const mockConfigService = {
        get: jest.fn().mockReturnValue(webhookUrl),
      };

      const service = new AlertService(mockConfigService as any, logger, httpService);

      httpService.post.mockReturnValue(
        of({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config: {} } as any),
      );

      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await service.sendAlert('agent_offline', 'Test message', {});

      expect(httpService.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              ts: Math.floor(now / 1000),
            }),
          ]),
        }),
        { timeout: 5000 },
      );

      jest.restoreAllMocks();
    });
  });
});

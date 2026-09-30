import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AiProviderError } from '../../ai/ai.errors';
import { AiErrorDto } from '../dto/ai-error.dto';
import { AiErrorException } from '../errors/ai-error.exception';
import { AiExceptionFilter } from './ai-exception.filter';

function buildHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

function firstBody(json: jest.Mock): AiErrorDto {
  return (json.mock.calls[0] as [AiErrorDto])[0];
}

describe('AiExceptionFilter', () => {
  const filter = new AiExceptionFilter();

  it('serializes AiErrorException with its status and code', () => {
    const { host, status, json } = buildHost();

    filter.catch(
      new AiErrorException(
        503,
        'AI_ENDPOINTS_DISABLED',
        'AI endpoints are disabled',
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(firstBody(json)).toMatchObject({
      statusCode: 503,
      code: 'AI_ENDPOINTS_DISABLED',
      message: 'AI endpoints are disabled',
    });
  });

  it('maps provider errors to HTTP statuses', () => {
    const { host, status, json } = buildHost();

    filter.catch(new AiProviderError('RATE_LIMITED', 'quota exceeded'), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(firstBody(json)).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('maps validation pipe errors to VALIDATION_FAILED with details', () => {
    const { host, status, json } = buildHost();

    filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: ['protagonist should not be empty'],
        error: 'Bad Request',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(firstBody(json)).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      details: ['protagonist should not be empty'],
    });
  });

  it('maps throttler errors to RATE_LIMITED', () => {
    const { host, status, json } = buildHost();

    filter.catch(new ThrottlerException(), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(firstBody(json)).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps unknown HTTP exceptions by status', () => {
    const { host, status, json } = buildHost();

    filter.catch(new NotFoundException('Job not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(firstBody(json)).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Job not found',
    });
  });

  it('falls back to INTERNAL for unexpected errors', () => {
    const { host, status, json } = buildHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(firstBody(json)).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL',
    });
  });
});

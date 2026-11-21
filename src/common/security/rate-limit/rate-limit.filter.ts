import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { RateLimitedException } from './rate-limit.exception';

/**
 * Exception filter ensuring that HTTP 429 responses always include
 * standard 'Retry-After' header and JSON payload { statusCode: 429, code: 'RATE_LIMITED', retryAfter: <sec> }.
 */
@Catch(RateLimitedException)
export class RateLimitedExceptionFilter implements ExceptionFilter {
  catch(exception: RateLimitedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = HttpStatus.TOO_MANY_REQUESTS;
    const retryAfter = exception.retryAfter;

    response.setHeader('Retry-After', String(retryAfter));
    response.status(status).json({
      statusCode: status,
      code: 'RATE_LIMITED',
      retryAfter,
      message: exception.message || 'Quá nhiều yêu cầu, vui lòng thử lại sau.',
    });
  }
}

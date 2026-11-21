import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Standard 429 Too Many Requests Exception for ERP4U Rate Limiting.
 *
 * Serializes to:
 * {
 *   statusCode: 429,
 *   code: 'RATE_LIMITED',
 *   retryAfter: <seconds>,
 *   message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.'
 * }
 */
export class RateLimitedException extends HttpException {
  public readonly retryAfter: number;

  constructor(
    retryAfter: number,
    message = 'Quá nhiều yêu cầu, vui lòng thử lại sau.',
  ) {
    const normalizedRetryAfter = Math.max(1, Math.ceil(retryAfter));
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'RATE_LIMITED',
        retryAfter: normalizedRetryAfter,
        message,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.retryAfter = normalizedRetryAfter;
  }
}

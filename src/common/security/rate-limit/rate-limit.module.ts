import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { RATE_LIMIT_STORE } from './rate-limit.types';
import { MemoryRateLimitStore } from './memory-rate-limit.store';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard, LoginRateLimitGuard } from './rate-limit.guard';
import { RateLimitedExceptionFilter } from './rate-limit.filter';

@Global()
@Module({
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      useClass: MemoryRateLimitStore,
    },
    RateLimitService,
    RateLimitGuard,
    LoginRateLimitGuard,
    {
      provide: APP_FILTER,
      useClass: RateLimitedExceptionFilter,
    },
  ],
  exports: [RATE_LIMIT_STORE, RateLimitService, RateLimitGuard, LoginRateLimitGuard],
})
export class RateLimitModule {}

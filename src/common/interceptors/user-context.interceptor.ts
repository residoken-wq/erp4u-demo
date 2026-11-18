import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserContextService } from '../services/user-context.service';

/**
 * Interceptor to wrap each request with UserContext.
 * This runs AFTER AuthGuard, so req.user is populated.
 * This allows ActivitySubscriber to access user info via AsyncLocalStorage.
 */
@Injectable()
export class UserContextInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const user = request.user; // Populated by JwtAuthGuard

        if (user) {
            // Wrap the handler in AsyncLocalStorage context
            return new Observable((subscriber) => {
                UserContextService.runWithUser(user, () => {
                    next.handle().subscribe({
                        next: (value) => subscriber.next(value),
                        error: (err) => subscriber.error(err),
                        complete: () => subscriber.complete(),
                    });
                });
            });
        }

        return next.handle();
    }
}

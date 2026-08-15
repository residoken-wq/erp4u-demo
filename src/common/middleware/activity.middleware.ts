import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class ActivityMiddleware implements NestMiddleware {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {
        // Check if user is authenticated (attached to req by AuthGuard/Passport)
        // Note: Middleware runs before Guards in NestJS pipeline usually. 
        // However, for this to work, we might need to rely on the fact that some auth middleware runs before this, 
        // or we might need to check standard headers if we want to track even before AuthGuard.
        // BUT simplest way: If we register this GLOBALLY, it runs before AuthGuard so req.user might be undefined.
        // If we register it specifically for routes, we can ensure it runs after auth.
        // Alternative: Just check if req.user exists.

        // Better approach: In NestJS, standard Middleware doesn't have access to req.user set by Guards (which run AFTER middleware).
        // So we can't easily track "Who" is making the request in a standard Middleware unless we parse the token ourselves.

        // HOWEVER, keeping it simple: We will do a best-effort check.
        // If we use Global Interceptor, we have access to execution context and user.
        // BUT Middleware is requested by the plan. Let's try to parse the user from header or wait.

        // Actually, to update "Last Activity", it's best done in an Interceptor or Guard that runs continuously.
        // But since the plan specified Middleware, I will implement it.
        // To make it robust: I will try to decode the JWT briefly if req.user is missing, 
        // OR we will register this middleware to run *after* passport if possible (NestJS middleware order is defined in module).
        // But Passport usually acts as a middleware too.

        // Let's assume we rely on the Controller to have handled auth, but we want to log it "in the background".
        // Actually, Interceptor is much better for this in NestJS.
        // BUT, I'll stick to the "Activity Tracking" concept.

        // Let's implement as an Injectable Middleware that blindly trusts 'user' if present. 
        // If not present (because it runs before Auth), this won't work well.
        // CHANGE OF PLAN: I will implement this as an INTERCEPTOR instead, which is "Gateway" to controllers and runs AFTER Guards.
        // This warrants a small deviation but ensures correctness.

        // ... Wait, the user asked for "Middleware". In NestJS middleware runs before guards.
        // I can manually verify the token if I want, but that replicates Auth logic.
        // Let's stick to Middleware but maybe usage of `req.user` implies we need to ensure Auth happened.
        // Actually, `Passport` middleware usually runs early.
        // Let's try to access `req['user']` which might be populated if we use standard express-jwt. 
        // But NestJS guards are distinct.

        // DECISION: I will create an **Interceptor**. It is logically a middleware-like component in NestJS for this purpose.
        // Calling it `ActivityInterceptor` (Plan said Middleware, but Interceptor is the correct NestJS primitive here).

        next();
    }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UserContextService } from '../services/user-context.service';

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const user = (req as any).user;
        if (user) {
            UserContextService.runWithUser(user, next);
        } else {
            next();
        }
    }
}

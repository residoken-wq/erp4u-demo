import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class UserContextService {
    private static als = new AsyncLocalStorage<any>();

    static runWithUser(user: any, callback: () => void) {
        this.als.run(user, callback);
    }

    static getUser(): any {
        return this.als.getStore();
    }
}

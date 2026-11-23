import { Injectable } from '@nestjs/common';
import {
  SubscriptionInfo,
  SubscriptionInfoProvider,
} from './subscription-info.interface';

@Injectable()
export class NullSubscriptionInfoProvider implements SubscriptionInfoProvider {
  async getCurrent(): Promise<SubscriptionInfo | null> {
    return null;
  }
}

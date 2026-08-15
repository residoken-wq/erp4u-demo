import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiMessage } from './ai-message.entity';
import { AiFeedback } from './ai-feedback.entity';

@Injectable()
export class AiAnalyticsService {
    constructor(
        @InjectRepository(AiMessage) private messageRepo: Repository<AiMessage>,
        @InjectRepository(AiFeedback) private feedbackRepo: Repository<AiFeedback>
    ) {}

    async getUsageStats() {
        const totalMessages = await this.messageRepo.count();
        const activeUsersCount = await this.messageRepo.createQueryBuilder('msg')
            .select('msg.user_id')
            .distinct(true)
            .getCount();

        const recentFeedbacks = await this.feedbackRepo.find({ order: { created_at: 'DESC' }, take: 10 });
        const positiveFeedbacks = await this.feedbackRepo.count({ where: { rating: 'GOOD' } });
        const totalFeedbacks = await this.feedbackRepo.count();
        const accuracy = totalFeedbacks > 0 ? (positiveFeedbacks / totalFeedbacks) * 100 : 100;

        return {
            totalRequests: totalMessages,
            activeUsers: activeUsersCount,
            accuracy: accuracy.toFixed(2) + '%',
            recentFeedbacks
        };
    }
}

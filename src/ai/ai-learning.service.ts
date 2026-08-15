import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiFeedback } from './ai-feedback.entity';
import { AiLearnedExample } from './ai-learned-example.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiLearningService {
    private readonly logger = new Logger(AiLearningService.name);

    constructor(
        @InjectRepository(AiFeedback) private feedbackRepo: Repository<AiFeedback>,
        @InjectRepository(AiLearnedExample) private learnedExampleRepo: Repository<AiLearnedExample>,
        private configService: ConfigService
    ) {}

    async saveFeedback(data: { userId: string, messageId: string, rating: 'GOOD' | 'BAD', correction?: string, question: string, answer: string, toolUsed?: string }) {
        const feedback = this.feedbackRepo.create({
            user_id: data.userId,
            message_id: data.messageId,
            rating: data.rating,
            user_correction: data.correction,
            original_question: data.question,
            original_answer: data.answer,
            tool_used: data.toolUsed
        });
        await this.feedbackRepo.save(feedback);

        if (data.rating === 'GOOD' && data.toolUsed) {
            // Update effectiveness score of a learned example if it was used
            // This is a simplified logic. In a real system, we'd track exactly which example was used.
            this.logger.log(`Positive feedback received for tool ${data.toolUsed}`);
        }

        return { success: true };
    }

    async getTopExamples(limit: number = 10): Promise<AiLearnedExample[]> {
        return this.learnedExampleRepo.find({
            order: { effectiveness_score: 'DESC', usage_count: 'DESC' },
            take: limit
        });
    }

    async incrementExampleUsage(id: number) {
        await this.learnedExampleRepo.increment({ id }, 'usage_count', 1);
    }
}

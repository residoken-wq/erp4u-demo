import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { ReviewQuestion } from './entities/review-question.entity';
import { TenantSeeder } from '../common/tenancy/tenant-seeder.interface';
import { resolveCoreAsset } from '../common/utils/asset-path.util';

@Injectable()
export class HrReviewQuestionsSeedService implements TenantSeeder {
  readonly name = 'hr-review-questions-seed';
  private readonly logger = new Logger(HrReviewQuestionsSeedService.name);

  constructor(
    @InjectRepository(ReviewQuestion)
    private readonly reviewQuestionRepo: Repository<ReviewQuestion>,
  ) {}

  async seed(): Promise<void> {
    try {
      const count = await this.reviewQuestionRepo.count();
      if (count > 0) {
        this.logger.log(`Review questions already seeded (${count} existing). Skipping.`);
        return;
      }

      const dataPath = resolveCoreAsset('parsed_questions.json', __dirname);
      if (fs.existsSync(dataPath)) {
        const raw = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            const q = this.reviewQuestionRepo.create({
              content: item.content,
              category: item.category,
              type: item.type as any,
            });
            await this.reviewQuestionRepo.save(q);
          }
          this.logger.log(`Seeded ${data.length} review questions successfully.`);
        }
      } else {
        this.logger.warn(`parsed_questions.json not found at ${dataPath}. Skipping questions seed.`);
      }
    } catch (e: any) {
      this.logger.error(`Error auto-seeding review questions: ${e?.message}`, e?.stack);
      throw e;
    }
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityInspection } from './quality-inspection.entity';
import { QCDefectItem } from './qc-defect-item.entity';
import { QCService } from './qc.service';
import { QCController } from './qc.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([QualityInspection, QCDefectItem]),
  ],
  controllers: [QCController],
  providers: [QCService],
  exports: [QCService],
})
export class QCModule { }

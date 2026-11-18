import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BOM } from './bom.entity';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';

@Module({
  imports: [TypeOrmModule.forFeature([BOM])],
  controllers: [BomController],
  providers: [BomService],
})
export class BomModule {}

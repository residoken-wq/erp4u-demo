import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';
import { CustomerLogo } from './entities/customer-logo.entity';
import { PrintDesign } from './entities/print-design.entity';
import { PrintSample } from './entities/print-sample.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerLogo, PrintDesign, PrintSample]),
    AuthModule
  ],
  controllers: [DesignsController],
  providers: [DesignsService],
  exports: [DesignsService]
})
export class DesignsModule {}

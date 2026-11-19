import { Module } from '@nestjs/common';
import { Erp4uCoreModule } from './erp4u-core.module';

@Module({
  imports: [Erp4uCoreModule.forRoot()],
})
export class AppModule {}

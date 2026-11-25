import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthOnly } from '../auth/permissions.decorator';
import { CorePackage } from '../common/packages/requires-package.decorator';
import { LookupsService } from './lookups.service';

@Controller('lookups')
@CorePackage()
@UseGuards(JwtAuthGuard)
@AuthOnly()
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get('users')
  getUsers(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.lookupsService.getUsers(q, limit ? Number(limit) : undefined);
  }

  @Get('products')
  getProducts(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.lookupsService.getProducts(q, limit ? Number(limit) : undefined);
  }

  @Get('customers')
  getCustomers(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.lookupsService.getCustomers(q, limit ? Number(limit) : undefined);
  }

  @Get('suppliers')
  getSuppliers(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.lookupsService.getSuppliers(q, limit ? Number(limit) : undefined, type);
  }

  @Get('warehouses')
  getWarehouses(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.lookupsService.getWarehouses(q, limit ? Number(limit) : undefined);
  }

  @Get('employees')
  getEmployees(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.lookupsService.getEmployees(q, limit ? Number(limit) : undefined);
  }

  @Get('categories')
  getCategories(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.lookupsService.getCategories(q, limit ? Number(limit) : undefined);
  }

  @Get('materials')
  getMaterials(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.lookupsService.getMaterials(q, limit ? Number(limit) : undefined);
  }

  @Get('projects')
  getProjects(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.lookupsService.getProjects(q, limit ? Number(limit) : undefined);
  }
}

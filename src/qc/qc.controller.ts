import { Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { QCService } from './qc.service';

@Controller('qc')
export class QCController {
  constructor(private readonly qcService: QCService) { }

  // --- CRUD ---
  @Perm('PRODUCTION', 'create')
  @Post()
  create(@Body() body: any) {
    return this.qcService.createInspection(body);
  }

  @Perm('PRODUCTION', 'view')
  @Get()
  getAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('supplier_id') supplierId?: string,
    @Query('po_id') poId?: string
  ) {
    const query: any = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (supplierId) query.supplier_id = Number(supplierId);
    if (poId) query.po_id = Number(poId);
    return this.qcService.getAll(query);
  }

  @Perm('PRODUCTION', 'view')
  @Get('summary')
  getSummary() {
    return this.qcService.getQCSummary();
  }

  @Perm('PRODUCTION', 'view')
  @Get('supplier/:id/report')
  getSupplierReport(@Param('id') id: string) {
    return this.qcService.getSupplierQualityReport(Number(id));
  }

  @Perm('PRODUCTION', 'view')
  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.qcService.getDetail(Number(id));
  }

  // --- WORKFLOW ---
  @Perm('PRODUCTION', 'create')
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.qcService.startInspection(Number(id));
  }

  @Perm('PRODUCTION', 'create')
  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() body: any) {
    return this.qcService.completeInspection(Number(id), body);
  }

  // --- DEFECTS ---
  @Perm('PRODUCTION', 'create')
  @Post(':id/defects')
  addDefect(@Param('id') id: string, @Body() body: any) {
    return this.qcService.addDefect(Number(id), body);
  }

  @Perm('PRODUCTION', 'delete')
  @Delete('defects/:defectId')
  removeDefect(@Param('defectId') defectId: string) {
    return this.qcService.removeDefect(Number(defectId));
  }

  @Perm('PRODUCTION', 'delete')
  @Delete(':id')
  deleteInspection(@Param('id') id: string) {
    return this.qcService.deleteInspection(Number(id));
  }
}

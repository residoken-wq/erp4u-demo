import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { QCService } from './qc.service';

@Controller('qc')
export class QCController {
  constructor(private readonly qcService: QCService) { }

  // --- CRUD ---
  @Post()
  create(@Body() body: any) {
    return this.qcService.createInspection(body);
  }

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

  @Get('summary')
  getSummary() {
    return this.qcService.getQCSummary();
  }

  @Get('supplier/:id/report')
  getSupplierReport(@Param('id') id: string) {
    return this.qcService.getSupplierQualityReport(Number(id));
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.qcService.getDetail(Number(id));
  }

  // --- WORKFLOW ---
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.qcService.startInspection(Number(id));
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() body: any) {
    return this.qcService.completeInspection(Number(id), body);
  }

  // --- DEFECTS ---
  @Post(':id/defects')
  addDefect(@Param('id') id: string, @Body() body: any) {
    return this.qcService.addDefect(Number(id), body);
  }

  @Delete('defects/:defectId')
  removeDefect(@Param('defectId') defectId: string) {
    return this.qcService.removeDefect(Number(defectId));
  }

  @Delete(':id')
  deleteInspection(@Param('id') id: string) {
    return this.qcService.deleteInspection(Number(id));
  }
}

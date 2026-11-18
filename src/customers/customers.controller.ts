import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomerType } from './customer.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission, Perm } from '../auth/permissions.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly s: CustomersService) { }

  @Post() @RequirePermission('SALES', 'can_create') create(@Body() b: any) { return this.s.create(b); }
  @Get() @RequirePermission('SALES', 'can_view') findAll(
    @Query('type') type?: CustomerType,
    @Query('limit') limit?: string,
    @Query('compact') compact?: string,
  ) {
    return this.s.findAll({
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
      compact: compact === 'true',
    });
  }
  @Get(':id') @RequirePermission('SALES', 'can_view') findOne(@Param('id') id: number) { return this.s.findOne(id); }
  @Put(':id') @RequirePermission('SALES', 'can_update') update(@Param('id') id: number, @Body() b: any) { return this.s.update(id, b); }
  @Delete(':id') @RequirePermission('SALES', 'can_delete') remove(@Param('id') id: number) { return this.s.remove(id); }

  @Post(':id/impersonate')
  @RequirePermission('SALES', 'can_view')
  async impersonate(@Param('id') id: number) {
    return this.s.impersonate(id);
  }


  @Perm('SALES', 'create')
  @Post(':id/follow')
  addHistory(@Param('id') id: number, @Body('note') note: string) {
    return this.s.addHistory(id, note);
  }

  @Perm('SALES', 'view')
  @Get(':id/orders')
  getOrders(@Param('id') id: number) {
    return this.s.getOrders(id);
  }

  @Perm('SALES', 'update')
  @Put(':id/bod-follow-up')
  updateBodFollowUp(@Param('id') id: number, @Body() b: any) {
    return this.s.updateBodFollowUp(id, b);
  }

  // --- LEAD CARE: COMMENTS ---
  @Perm('SALES', 'view')
  @Get(':id/comments')
  getComments(@Param('id') id: number) {
    return this.s.getComments(id);
  }

  @Perm('SALES', 'create')
  @Post(':id/comment')
  addComment(@Param('id') id: number, @Body() body: any) {
    return this.s.addComment(id, body.content, body.sender, body.name, body.comment_type, body.mentioned_user_ids);
  }

  // --- CUSTOMER CREDIT ---
  @Perm('SALES', 'view')
  @Get(':id/credits')
  getCredits(@Param('id') id: number) {
    return this.s.getCreditHistory(id);
  }

  @Perm('SALES', 'create')
  @Post(':id/credits')
  addCredit(@Param('id') id: number, @Body() body: any) {
    return this.s.addCredit(id, body.amount, body.type, body.note, body.reference_code);
  }

  // --- CUSTOMER 360 PORTRAIT ---
  @Perm('SALES', 'view')
  @Get(':id/portrait-360')
  getPortrait360(@Param('id') id: number) {
    return this.s.getPortrait360Data(id);
  }

  @Perm('SALES', 'update')
  @Put(':id/portrait-notes')
  updatePortraitNotes(@Param('id') id: number, @Body('notes') notes: string) {
    return this.s.updatePortraitNotes(id, notes || '');
  }
}
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DesignsService } from './designs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission, AnyPerm } from '../auth/permissions.decorator';

@Controller('designs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DesignsController {
    constructor(private readonly designsService: DesignsService) {}

    // --- Customer Logos ---
    @Get('logos')
    @RequirePermission('PRODUCT', 'can_view')
    @AnyPerm(['PRODUCT', 'view'], ['PRODUCTION', 'view'])
    getLogos(@Query('customer_id') customerId?: number) {
        return this.designsService.getLogos(customerId);
    }

    @Post('logos')
    @RequirePermission('PRODUCT', 'can_create')
    @AnyPerm(['PRODUCT', 'create'], ['PRODUCTION', 'create'])
    createLogo(@Body() data: any) {
        return this.designsService.createLogo(data);
    }

    @Put('logos/:id')
    @RequirePermission('PRODUCT', 'can_update')
    @AnyPerm(['PRODUCT', 'update'], ['PRODUCTION', 'update'])
    updateLogo(@Param('id') id: string, @Body() data: any) {
        return this.designsService.updateLogo(+id, data);
    }

    @Delete('logos/:id')
    @RequirePermission('PRODUCT', 'can_delete')
    @AnyPerm(['PRODUCT', 'delete'], ['PRODUCTION', 'delete'])
    deleteLogo(@Param('id') id: string) {
        return this.designsService.deleteLogo(+id);
    }

    // --- Print Designs ---
    @Get('print-designs')
    @RequirePermission('PRODUCT', 'can_view')
    @AnyPerm(['PRODUCT', 'view'], ['PRODUCTION', 'view'])
    getPrintDesigns(@Query('customer_id') customerId?: number, @Query('product_id') productId?: number, @Query('category_id') categoryId?: number) {
        return this.designsService.getPrintDesigns(customerId, productId, categoryId);
    }

    @Get('print-designs/:id')
    @RequirePermission('PRODUCT', 'can_view')
    @AnyPerm(['PRODUCT', 'view'], ['PRODUCTION', 'view'])
    getPrintDesignById(@Param('id') id: string) {
        return this.designsService.getPrintDesignById(+id);
    }

    @Post('print-designs')
    @RequirePermission('PRODUCT', 'can_create')
    @AnyPerm(['PRODUCT', 'create'], ['PRODUCTION', 'create'])
    createPrintDesign(@Body() data: any) {
        return this.designsService.createPrintDesign(data);
    }

    @Put('print-designs/:id')
    @RequirePermission('PRODUCT', 'can_update')
    @AnyPerm(['PRODUCT', 'update'], ['PRODUCTION', 'update'])
    updatePrintDesign(@Param('id') id: string, @Body() data: any) {
        return this.designsService.updatePrintDesign(+id, data);
    }

    @Delete('print-designs/:id')
    @RequirePermission('PRODUCT', 'can_delete')
    @AnyPerm(['PRODUCT', 'delete'], ['PRODUCTION', 'delete'])
    deletePrintDesign(@Param('id') id: string) {
        return this.designsService.deletePrintDesign(+id);
    }

    // --- Print Samples ---
    @Get('print-samples')
    @RequirePermission('PRODUCT', 'can_view')
    @AnyPerm(['PRODUCT', 'view'], ['PRODUCTION', 'view'])
    getPrintSamples(@Query('po_id') poId: number) {
        return this.designsService.getSamplesByPo(poId);
    }

    @Post('print-samples')
    @RequirePermission('PRODUCT', 'can_create')
    @AnyPerm(['PRODUCT', 'create'], ['PRODUCTION', 'create'])
    createPrintSample(@Body() data: any) {
        return this.designsService.createPrintSample(data);
    }

    @Put('print-samples/:id/status')
    @RequirePermission('PRODUCT', 'can_update')
    @AnyPerm(['PRODUCT', 'update'], ['PRODUCTION', 'update'])
    updatePrintSampleStatus(@Param('id') id: string, @Body() data: { status: string, feedback?: string }) {
        return this.designsService.updatePrintSampleStatus(+id, data.status, data.feedback);
    }

    // --- Design Orders ---
    @Get('orders')
    @RequirePermission('PRODUCT', 'can_view')
    @AnyPerm(['PRODUCT', 'view'], ['PRODUCTION', 'view'])
    getDesignOrders(@Query('customer_id') customerId?: number, @Query('product_id') productId?: number, @Query('status') status?: string) {
        return this.designsService.getDesignOrders({ customer_id: customerId, product_id: productId, status });
    }

    @Get('orders/:id')
    @RequirePermission('PRODUCT', 'can_view')
    @AnyPerm(['PRODUCT', 'view'], ['PRODUCTION', 'view'])
    getDesignOrderById(@Param('id') id: string) {
        return this.designsService.getDesignOrderById(+id);
    }

    @Post('orders')
    @RequirePermission('PRODUCT', 'can_create')
    @AnyPerm(['PRODUCT', 'create'], ['PRODUCTION', 'create'])
    createDesignOrder(@Body() data: any) {
        return this.designsService.createDesignOrder(data);
    }

    @Put('orders/:id')
    @RequirePermission('PRODUCT', 'can_update')
    @AnyPerm(['PRODUCT', 'update'], ['PRODUCTION', 'update'])
    updateDesignOrder(@Param('id') id: string, @Body() data: any) {
        return this.designsService.updateDesignOrder(+id, data);
    }

    @Put('orders/:id/status')
    @RequirePermission('PRODUCT', 'can_update')
    @AnyPerm(['PRODUCT', 'update'], ['PRODUCTION', 'update'])
    updateDesignOrderStatus(@Param('id') id: string, @Body() data: { status: string }) {
        return this.designsService.updateDesignOrderStatus(+id, data.status);
    }

    @Delete('orders/:id')
    @RequirePermission('PRODUCT', 'can_delete')
    @AnyPerm(['PRODUCT', 'delete'], ['PRODUCTION', 'delete'])
    deleteDesignOrder(@Param('id') id: string) {
        return this.designsService.deleteDesignOrder(+id);
    }

    // --- Design Order Items ---
    @Post('orders/:id/items')
    @RequirePermission('PRODUCT', 'can_create')
    @AnyPerm(['PRODUCT', 'create'], ['PRODUCTION', 'create'])
    addDesignOrderItem(@Param('id') id: string, @Body() data: any) {
        return this.designsService.addDesignOrderItem(+id, data);
    }

    @Put('order-items/:itemId')
    @RequirePermission('PRODUCT', 'can_update')
    @AnyPerm(['PRODUCT', 'update'], ['PRODUCTION', 'update'])
    updateDesignOrderItem(@Param('itemId') itemId: string, @Body() data: any) {
        return this.designsService.updateDesignOrderItem(+itemId, data);
    }

    @Delete('order-items/:itemId')
    @RequirePermission('PRODUCT', 'can_delete')
    @AnyPerm(['PRODUCT', 'delete'], ['PRODUCTION', 'delete'])
    deleteDesignOrderItem(@Param('itemId') itemId: string) {
        return this.designsService.deleteDesignOrderItem(+itemId);
    }
}

import { Controller, Post, Get, Put, Delete, Body, Param, Query, Req, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission, Perm } from '../auth/permissions.decorator';

@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
    constructor(
        private readonly s: SalesService
    ) { }

    // ============================================================
    // 1. CÁC API TĨNH (STATIC ROUTES) - ĐẶT LÊN ĐẦU ĐỂ TRÁNH CONFLICT
    // ============================================================

    @Post('price-lists')
    @RequirePermission('SALES', 'can_create')
    createPriceList(@Body() body: any) { return this.s.createPriceList(body); }

    @Get('price-lists')
    @RequirePermission('SALES', 'can_view')
    getAllPriceLists() { return this.s.getAllPriceLists(); }

    @Post('price-lists/:id/rules')
    @RequirePermission('SALES', 'can_create')
    createRule(@Param('id') id: number, @Body() body: any) { return this.s.createPriceListRule(id, body); }

    @Perm('SALES', 'view')
    @Get('price-lists/:id/rules')
    getRules(@Param('id') id: number) { return this.s.getPriceListRules(id); }

    @Perm('SALES', 'view')
    @Get('validate-price')
    async validatePrice(@Query('sku') sku: string, @Query('unitPrice') unitPrice: number, @Query('userId') userId: number) {
        return this.s.validatePriceAgainstPriceList(sku, Number(unitPrice), Number(userId));
    }

    @Perm('SALES', 'view')
    @Get('samples/all')
    getAllSamples() { return this.s.sampleRepo.find({ order: { created_at: 'DESC' } }); }

    // --- ANALYTICS DASHBOARD ---
    @Get('analytics')
    @RequirePermission('SALES', 'can_view')
    getAnalytics(@Query() query: any) {
        return this.s.getAnalyticsDashboard({
            startDate: query.startDate,
            endDate: query.endDate,
            assignedToId: query.assignedToId ? Number(query.assignedToId) : undefined,
            productType: query.productType,
        });
    }

    @Post('analytics/push-reminder')
    @RequirePermission('SALES', 'can_view')
    pushReminder(@Body() body: any) {
        return this.s.sendPushReminder(body);
    }

    // --- SALES TARGETS ---
    @Get('targets')
    @RequirePermission('SALES', 'can_view')
    getTargets(@Query('year') year: number) {
        return this.s.getTargets(Number(year) || new Date().getFullYear());
    }

    @Post('targets')
    @RequirePermission('SALES', 'can_update')
    upsertTarget(@Body() body: any) {
        return this.s.upsertTarget(body);
    }

    // --- PROMOTIONS ---
    @Perm('SALES', 'view')
    @Get('promotions')
    getAllPromotions() { return this.s.getAllPromotions(); }

    @Perm('SALES', 'view')
    @Get('promotions/active')
    getActivePromotions() { return this.s.getActivePromotions(); }

    @Perm('SALES', 'view')
    @Get('promotions/for-customer/:customerId')
    getPromotionsForCustomer(@Param('customerId') customerId: number) {
        return this.s.getActivePromotionsForCustomer(Number(customerId));
    }

    @Post('promotions')
    @RequirePermission('SALES', 'can_create')
    createPromotion(@Body() body: any) { return this.s.createPromotion(body); }

    @Put('promotions/:id')
    @RequirePermission('SALES', 'can_update')
    updatePromotion(@Param('id') id: number, @Body() body: any) {
        return this.s.updatePromotion(Number(id), body);
    }

    @Delete('promotions/:id')
    @RequirePermission('SALES', 'can_delete')
    deletePromotion(@Param('id') id: number) {
        return this.s.deletePromotion(Number(id));
    }

    // ============================================================
    // 2. CÁC API CON (SUB-RESOURCES)
    // ============================================================

    @Perm('SALES', 'view')
    @Get(':id/comments')
    getComments(@Param('id') id: number) { return this.s.getComments(id); }

    @Perm('SALES', 'create')
    @Post(':id/comment')
    addComment(@Param('id') id: number, @Body() body: any) {
        return this.s.addComment(id, body.content, body.sender, body.name, body.comment_type, body.mentioned_user_ids);
    }

    @Perm('SALES', 'update')
    @Put('comment/:id')
    updateComment(@Param('id') id: number, @Body() body: any) { return this.s.updateComment(id, body.content); }

    @Perm('SALES', 'create')
    @Post('comment/:id/toggle')
    toggleComment(@Param('id') id: number) { return this.s.toggleCommentVisibility(id); }

    @Perm('SALES', 'delete')
    @Delete('comment/:id')
    softDeleteComment(@Param('id') id: number, @Body() body: any) {
        return this.s.softDeleteComment(id, body?.deletedBy || 'Khách hàng');
    }

    @Perm('SALES', 'view')
    @Get(':id/activities')
    getActivities(@Param('id') id: number) {
        return this.s.getActivities(id);
    }

    @Perm('SALES', 'view')
    @Get(':id/deliveries')
    getDeliveries(@Param('id') id: number) { return this.s.getDeliveryHistory(id); }

    @Perm('SALES', 'create')
    @Post(':id/delivery')
    createDelivery(@Param('id') id: number, @Body() b: any) { return this.s.createDelivery(id, b); }

    @Perm('SALES', 'update')
    @Put('delivery/:deliveryId')
    updateDelivery(@Param('deliveryId') deliveryId: number, @Body() b: any) { return this.s.updateDelivery(deliveryId, b); }

    @Perm('SALES', 'view')
    @Get(':code/payments')
    getPayments(@Param('code') code: string) { return this.s.getPaymentHistory(code); }

    @Perm('SALES', 'view')
    @Get(':code/payment-history')
    getPaymentHistory(@Param('code') code: string) { return this.s.getPaymentHistory(code); }

    // --- EASYINVOICE APIS ---
    @Post(':id/issue-vat-invoice')
    @RequirePermission('SALES', 'can_update')
    issueVatInvoice(@Param('id') id: number, @Body() body?: { items?: any[] }) {
        return this.s.issueVatInvoice(Number(id), body);
    }

    @Get(':id/vat-invoice-status')
    @RequirePermission('SALES', 'can_view')
    getVatInvoiceStatus(@Param('id') id: number, @Query('ikey') ikey?: string) {
        return this.s.getVatInvoiceStatus(Number(id), ikey);
    }

    @Get(':id/vat-invoice-preview')
    @RequirePermission('SALES', 'can_view')
    previewVatInvoice(@Param('id') id: number, @Query('ikey') ikey?: string) {
        return this.s.previewVatInvoice(Number(id), ikey);
    }

    @Post(':id/vat-invoice-email')
    @RequirePermission('SALES', 'can_update')
    sendVatInvoiceEmail(@Param('id') id: number, @Body() body: { email: string; ikey?: string }) {
        return this.s.sendVatInvoiceEmail(Number(id), body.email, body.ikey);
    }

    @Delete(':id/vat-invoice/:ikey')
    @RequirePermission('SALES', 'can_update')
    deleteDraftVatInvoice(@Param('id') id: number, @Param('ikey') ikey: string) {
        return this.s.deleteDraftVatInvoice(Number(id), ikey);
    }

    @Get(':id/easyinvoice-pdf')
    @RequirePermission('SALES', 'can_view')
    async downloadEasyInvoicePdf(@Param('id') id: number, @Query('ikey') ikey: string, @Res() res: Response) {
        try {
            const order = await this.s.findOne(Number(id));
            if (!order || !order.vat_invoice_data) {
                return res.status(404).send('Không tìm thấy hóa đơn hoặc chưa tạo Hóa đơn nháp.');
            }

            const invoices = this.s.normalizeVatInvoices(order.vat_invoice_data);
            const targetInvoice = ikey ? invoices.find(i => i.ikey === ikey) : invoices[invoices.length - 1];

            if (!targetInvoice || !targetInvoice.ikey) {
                return res.status(404).send('Không tìm thấy hóa đơn cần tải.');
            }
            
            const pdfBuffer = await this.s.downloadEasyInvoicePdfRaw(targetInvoice.ikey);
            
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="hoadon_${targetInvoice.ikey}.pdf"`,
                'Content-Length': pdfBuffer.length,
            });
            
            res.send(pdfBuffer);
        } catch (error: any) {
            return res.status(500).send(`Lỗi tải Hóa đơn: ${error.message}`);
        }
    }


    // Portal APIs
    @Perm('SALES', 'view')
    @Get('portal/:uuid') getPortal(@Param('uuid') uuid: string) { return this.s.getQuoteByUuid(uuid); }
    @Perm('SALES', 'update')
    @Post('portal/:uuid/action')
    customerAction(@Param('uuid') uuid: string, @Body() body: any, @Req() req: any) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const metadata = { ip, userAgent };
        return this.s.customerAction(uuid, body.action, metadata);
    }

    // ============================================================
    // 3. API ĐƠN HÀNG (DYNAMIC ROUTES)
    // ============================================================

    @Post()
    @RequirePermission('SALES', 'can_create')
    create(@Body() b: any) { return this.s.createOrder(b); }

    @Get()
    @RequirePermission('SALES', 'can_view')
    findAll() { return this.s.findAll(); }

    // --- QUAN TRỌNG: FIX LỖI 500 ---
    // Dùng chung 1 API để tìm theo ID hoặc CODE
    @Perm('SALES', 'view')
    @Get(':idOrCode')
    findOne(@Param('idOrCode') idOrCode: string) {
        console.log('--- GET /sales/:idOrCode ---', idOrCode); // Debug
        return this.s.findOne(idOrCode);
    }

    // --- QUAN TRỌNG: FIX LỖI 404 CANNOT PUT ---
    @Put(':id')
    @RequirePermission('SALES', 'can_update')
    update(@Param('id') id: number, @Body() b: any) {
        return this.s.update(Number(id), b);
    }
    // ------------------------------------------

    @Perm('SALES', 'create')
    @Post(':id/convert')
    convert(@Param('id') id: number, @Body('accepted') accepted: boolean) { return this.s.convertQuoteToSo(id, accepted); }

    // --- BOD FOLLOW UP ---
    @Perm('SALES', 'update')
    @Put(':id/bod-follow-up')
    updateBodFollowUp(@Param('id') id: number, @Body() body: any) {
        return this.s.updateBodFollowUp(Number(id), body);
    }

    @Perm('SALES', 'update')
    @Put('quote/:id')
    updateQuote(@Param('id') id: number, @Body() b: any) { return this.s.updateQuote(id, b); }

    @Perm('SALES', 'delete')
    @Delete('quote/:id')
    deleteQuote(@Param('id') id: number, @Query('cascade') cascade?: boolean) { 
        return this.s.deleteQuote(id, String(cascade) === 'true'); 
    }

    @Perm('SALES', 'create')
    @Post(':id/approve-samples')
    approveSamples(@Param('id') id: number) { return this.s.approveAllSamples(id); }

    @Perm('SALES', 'create')
    @Post(':id/complete')
    complete(@Param('id') id: number) { return this.s.completeOrder(id); }

    @Perm('SALES', 'create')
    @Post(':id/cancel')
    cancel(@Param('id') id: number, @Body('reason') reason: string) { return this.s.cancelOrder(id, reason); }

    // --- REVISIONS ---
    @Perm('SALES', 'create')
    @Post(':id/revision')
    createRevision(@Param('id') id: number, @Body() body: any) {
        return this.s.createRevision(id, body.userId, body.username);
    }

    @Perm('SALES', 'view')
    @Get(':id/revisions')
    getRevisions(@Param('id') id: number) { return this.s.getRevisions(id); }

    @Perm('SALES', 'delete')
    @Delete('delivery/:deliveryId')
    deleteDelivery(@Param('deliveryId') deliveryId: number) {
        return this.s.deleteDelivery(deliveryId);
    }

    // --- DELETE ORDER (Only SO_PENDING status allowed) ---
    @Delete(':id')
    @RequirePermission('SALES', 'can_delete')
    deleteOrder(@Param('id') id: number, @Query('cascade') cascade?: boolean) {
        return this.s.deleteOrder(Number(id), String(cascade) === 'true');
    }

    // --- BOOK ITEMS ---
    @Perm('SALES', 'create')
    @Post(':id/book-items')
    bookItems(@Param('id') id: number, @Body() body: any) {
        return this.s.bookItems(Number(id), body.items || []);
    }


    // ============================================================
    // 4. CHECKLIST APIS
    // ============================================================

    @Perm('SALES', 'view')
    @Get(':id/checklist')
    getChecklist(@Param('id') id: number) { return this.s.getChecklist(id); }

    @Perm('SALES', 'view')
    @Post(':id/checklist/init')
    initChecklist(@Param('id') id: number, @Body() body: any) {
        return this.s.initChecklist(id, body.status || 'QUOTATION');
    }

    @Perm('SALES', 'view')
    @Post(':id/checklist/toggle/:itemId')
    toggleChecklistItem(@Param('id') id: number, @Param('itemId') itemId: number, @Body() body: any) {
        return this.s.toggleChecklistItem(itemId, body.username);
    }

    @Perm('SALES', 'view')
    @Post(':id/checklist/add')
    addChecklistItem(@Param('id') id: number, @Body() body: any) {
        return this.s.addCustomChecklistItem(id, body.task_name, body.due_date);
    }

    @Perm('SALES', 'update')
    @Put(':id/checklist/:itemId/note')
    updateChecklistNote(@Param('itemId') itemId: number, @Body() body: any) {
        return this.s.updateChecklistItemNote(itemId, body.note);
    }

    @Perm('SALES', 'delete')
    @Delete(':id/checklist/:itemId')
    deleteChecklistItem(@Param('itemId') itemId: number) {
        return this.s.deleteChecklistItem(itemId);
    }

    @Perm('SALES', 'view')
    @Post(':id/checklist/sync')
    syncChecklist(@Param('id') id: number, @Body() body: any) {
        return this.s.syncChecklistWithStatus(id, body.status);
    }
}

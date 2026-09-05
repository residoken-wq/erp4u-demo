import { Controller, Post, Get, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { GhtkService, GhtkFeeDto } from './carriers/ghtk.service';
import { Response } from 'express';

@Controller('shipping')
export class ShippingController {
    constructor(private readonly ghtkService: GhtkService) {}

    @Get('config')
    async getConfig() {
        const cfg = await this.ghtkService.getConfig();
        return {
            apiUrl: cfg.apiUrl,
            isConfigured: !!cfg.token,
            isSandbox: cfg.isSandbox,
            partnerCode: cfg.partnerCode ? `${cfg.partnerCode.slice(0, 4)}***` : '',
        };
    }

    @Post('ghtk/parse-address')
    async parseAddress(@Body('address') address: string) {
        return this.ghtkService.parseAddress(address);
    }

    @Get('ghtk/pick-addresses')
    async getPickAddresses() {
        return this.ghtkService.getPickAddresses();
    }

    @Post('ghtk/estimate-fee')
    async estimateFee(@Body() body: GhtkFeeDto) {
        return this.ghtkService.calculateFee(body);
    }

    @Post('delivery/:deliveryId/push-ghtk')
    async pushDeliveryToGhtk(
        @Param('deliveryId') deliveryId: string,
        @Body() options: any,
    ) {
        return this.ghtkService.pushDeliveryToGhtk(Number(deliveryId), options);
    }

    @Post('delivery/:deliveryId/cancel-ghtk')
    async cancelGhtkOrder(@Param('deliveryId') deliveryId: string) {
        return this.ghtkService.cancelGhtkOrder(Number(deliveryId));
    }

    @Get('delivery/:deliveryId/tracking')
    async getTracking(@Param('deliveryId') deliveryId: string) {
        return this.ghtkService.getTracking(Number(deliveryId));
    }

    @Get('delivery/:deliveryId/label')
    async getLabelUrl(
        @Param('deliveryId') deliveryId: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const url = await this.ghtkService.getLabelUrl(Number(deliveryId), pageSize || 'A6');
        return { url };
    }

    /**
     * Webhook nhận cập nhật trạng thái từ GHTK
     */
    @Post('webhook/ghtk')
    async handleGhtkWebhook(@Body() body: any) {
        return this.ghtkService.handleWebhook(body);
    }
}

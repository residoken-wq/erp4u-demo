import { Controller, Post, Get, Body, Param, Query, Res, UseGuards, HttpCode } from '@nestjs/common';
import { GhtkService, GhtkFeeDto } from './carriers/ghtk.service';
import { LalamoveService, LalamoveQuotationDto, LalamovePushOrderOptions, LALAMOVE_VIETNAM_VEHICLES } from './carriers/lalamove.service';
import { Response } from 'express';

@Controller('shipping')
export class ShippingController {
    constructor(
        private readonly ghtkService: GhtkService,
        private readonly lalamoveService: LalamoveService,
    ) {}

    // ==========================================
    // CẤU HÌNH GHTK
    // ==========================================

    @Get('config')
    async getConfig() {
        const cfg = await this.ghtkService.getConfig();
        return {
            apiUrl: cfg.apiUrl,
            isConfigured: !!cfg.token,
            isSandbox: cfg.isSandbox,
            partnerCode: cfg.partnerCode || '',
            maskedToken: cfg.token ? `${cfg.token.slice(0, 6)}...${cfg.token.slice(-4)}` : '',
            hasToken: !!cfg.token,
            defaultPickAddressId: cfg.defaultPickAddressId || '',
        };
    }

    @Post('config')
    async saveConfig(@Body() body: any) {
        return this.ghtkService.saveConfig(body);
    }

    @Post('test-connection')
    async testConnection(@Body() body: any) {
        return this.ghtkService.testConnection(body);
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

    @Post('webhook/ghtk')
    @HttpCode(200)
    async handleGhtkWebhook(@Body() body: any) {
        return this.ghtkService.handleWebhook(body);
    }

    // ==========================================
    // CẤU HÌNH & TÍCH HỢP LALAMOVE API v3
    // ==========================================

    @Get('lalamove/config')
    async getLalamoveConfig() {
        const cfg = await this.lalamoveService.getConfig();
        return {
            apiUrl: cfg.apiUrl,
            isConfigured: !!(cfg.apiKey && cfg.apiSecret),
            isSandbox: cfg.isSandbox,
            market: cfg.market,
            hasApiKey: !!cfg.apiKey,
            hasApiSecret: !!cfg.apiSecret,
            maskedApiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}...${cfg.apiKey.slice(-4)}` : '',
            maskedApiSecret: cfg.apiSecret ? `${cfg.apiSecret.slice(0, 4)}...${cfg.apiSecret.slice(-4)}` : '',
            defaultPickAddress: cfg.defaultPickAddress,
            defaultPickLat: cfg.defaultPickLat,
            defaultPickLng: cfg.defaultPickLng,
            defaultSenderName: cfg.defaultSenderName,
            defaultSenderPhone: cfg.defaultSenderPhone,
            supportedVehicles: LALAMOVE_VIETNAM_VEHICLES,
        };
    }

    @Post('lalamove/config')
    async saveLalamoveConfig(@Body() body: any) {
        return this.lalamoveService.saveConfig(body);
    }

    @Post('lalamove/test-connection')
    async testLalamoveConnection(@Body() body: any) {
        return this.lalamoveService.testConnection(body);
    }

    @Get('lalamove/vehicles')
    getLalamoveVehicles() {
        return LALAMOVE_VIETNAM_VEHICLES;
    }

    @Post('lalamove/geocode')
    async geocodeLalamoveAddress(@Body('address') address: string) {
        return this.lalamoveService.geocodeAddress(address);
    }

    @Post('lalamove/quotation')
    async getLalamoveQuotation(@Body() body: LalamoveQuotationDto) {
        return this.lalamoveService.getQuotation(body);
    }

    @Post('lalamove/estimate-fee')
    async estimateLalamoveFee(@Body() body: any) {
        return this.lalamoveService.estimateFee(body);
    }

    @Post('delivery/:deliveryId/push-lalamove')
    async pushDeliveryToLalamove(
        @Param('deliveryId') deliveryId: string,
        @Body() options: LalamovePushOrderOptions,
    ) {
        return this.lalamoveService.pushDeliveryToLalamove(Number(deliveryId), options);
    }

    @Post('delivery/:deliveryId/sync-lalamove')
    async syncLalamoveStatus(@Param('deliveryId') deliveryId: string) {
        return this.lalamoveService.syncDeliveryStatus(Number(deliveryId));
    }

    @Get('delivery/:deliveryId/lalamove-order/:orderId')
    async getLalamoveOrderDetails(
        @Param('deliveryId') deliveryId: string,
        @Param('orderId') orderId: string,
    ) {
        return this.lalamoveService.getOrderDetails(orderId);
    }

    @Get('delivery/:deliveryId/lalamove-driver/:driverId')
    async getLalamoveDriverDetails(
        @Param('deliveryId') deliveryId: string,
        @Param('driverId') driverId: string,
    ) {
        return this.lalamoveService.getDriverDetails(deliveryId, driverId);
    }

    @Post('delivery/:deliveryId/lalamove-priority-fee')
    async addLalamovePriorityFee(
        @Param('deliveryId') deliveryId: string,
        @Body('priorityFee') priorityFee: number,
    ) {
        return this.lalamoveService.addPriorityFee(Number(deliveryId), Number(priorityFee));
    }

    @Post('delivery/:deliveryId/cancel-lalamove')
    async cancelLalamoveOrder(@Param('deliveryId') deliveryId: string) {
        return this.lalamoveService.cancelOrder(Number(deliveryId));
    }

    @Get('webhook/lalamove')
    @HttpCode(200)
    async verifyLalamoveWebhook() {
        return { success: true, message: 'Lalamove Webhook endpoint is active' };
    }

    @Post('webhook/lalamove')
    @HttpCode(200)
    async handleLalamoveWebhook(@Body() body: any) {
        return this.lalamoveService.handleWebhook(body);
    }
}

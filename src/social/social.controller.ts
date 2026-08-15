import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialChannel, SocialPlatform, ChannelStatus } from './entities/social-channel.entity';
import { SocialOrder, SocialOrderStatus } from './entities/social-order.entity';
import { SocialProductMapping } from './entities/social-product-mapping.entity';

@Controller('social')
export class SocialController {
    constructor(private readonly socialService: SocialService) { }

    // ===================== CHANNELS =====================

    @Get('channels')
    async getAllChannels(): Promise<SocialChannel[]> {
        return this.socialService.findAllChannels();
    }

    @Get('channels/:id')
    async getChannel(@Param('id', ParseIntPipe) id: number): Promise<SocialChannel> {
        return this.socialService.findChannelById(id);
    }

    @Get('channels/:id/stats')
    async getChannelStats(@Param('id', ParseIntPipe) id: number) {
        return this.socialService.getChannelStats(id);
    }

    @Post('channels')
    async createChannel(@Body() data: Partial<SocialChannel>): Promise<SocialChannel> {
        return this.socialService.createChannel(data);
    }

    @Put('channels/:id')
    async updateChannel(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: Partial<SocialChannel>,
    ): Promise<SocialChannel> {
        return this.socialService.updateChannel(id, data);
    }

    @Delete('channels/:id')
    async deleteChannel(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        await this.socialService.deleteChannel(id);
        return { message: 'Channel deleted successfully' };
    }

    // ===================== ORDERS =====================

    @Get('orders')
    async getAllOrders(
        @Query('platform') platform?: SocialPlatform,
        @Query('status') status?: SocialOrderStatus,
    ): Promise<SocialOrder[]> {
        return this.socialService.findAllOrders({ platform, status });
    }

    @Get('orders/:id')
    async getOrder(@Param('id', ParseIntPipe) id: number): Promise<SocialOrder> {
        return this.socialService.findOrderById(id);
    }

    @Post('orders/:id/sync')
    async syncOrderToSalesOrder(@Param('id', ParseIntPipe) id: number) {
        return this.socialService.syncOrderToSalesOrder(id);
    }

    // ===================== PRODUCT MAPPINGS =====================

    @Get('mappings')
    async getAllMappings(@Query('channel_id') channelId?: string): Promise<SocialProductMapping[]> {
        return this.socialService.findAllMappings(channelId ? parseInt(channelId) : undefined);
    }

    @Post('mappings')
    async createMapping(@Body() data: Partial<SocialProductMapping>): Promise<SocialProductMapping> {
        return this.socialService.createMapping(data);
    }

    @Put('mappings/:id')
    async updateMapping(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: Partial<SocialProductMapping>,
    ): Promise<SocialProductMapping> {
        return this.socialService.updateMapping(id, data);
    }

    @Delete('mappings/:id')
    async deleteMapping(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        await this.socialService.deleteMapping(id);
        return { message: 'Mapping deleted successfully' };
    }
}

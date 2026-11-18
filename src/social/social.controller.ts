import { Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialChannel, SocialPlatform, ChannelStatus } from './entities/social-channel.entity';
import { SocialOrder, SocialOrderStatus } from './entities/social-order.entity';
import { SocialProductMapping } from './entities/social-product-mapping.entity';

@Controller('social')
export class SocialController {
    constructor(private readonly socialService: SocialService) { }

    // ===================== CHANNELS =====================

    @Perm('MARKETING', 'view')
    @Get('channels')
    async getAllChannels(): Promise<SocialChannel[]> {
        return this.socialService.findAllChannels();
    }

    @Perm('MARKETING', 'view')
    @Get('channels/:id')
    async getChannel(@Param('id', ParseIntPipe) id: number): Promise<SocialChannel> {
        return this.socialService.findChannelById(id);
    }

    @Perm('MARKETING', 'view')
    @Get('channels/:id/stats')
    async getChannelStats(@Param('id', ParseIntPipe) id: number) {
        return this.socialService.getChannelStats(id);
    }

    @Perm('MARKETING', 'create')
    @Post('channels')
    async createChannel(@Body() data: Partial<SocialChannel>): Promise<SocialChannel> {
        return this.socialService.createChannel(data);
    }

    @Perm('MARKETING', 'update')
    @Put('channels/:id')
    async updateChannel(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: Partial<SocialChannel>,
    ): Promise<SocialChannel> {
        return this.socialService.updateChannel(id, data);
    }

    @Perm('MARKETING', 'delete')
    @Delete('channels/:id')
    async deleteChannel(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        await this.socialService.deleteChannel(id);
        return { message: 'Channel deleted successfully' };
    }

    // ===================== ORDERS =====================

    @Perm('MARKETING', 'view')
    @Get('orders')
    async getAllOrders(
        @Query('platform') platform?: SocialPlatform,
        @Query('status') status?: SocialOrderStatus,
    ): Promise<SocialOrder[]> {
        return this.socialService.findAllOrders({ platform, status });
    }

    @Perm('MARKETING', 'view')
    @Get('orders/:id')
    async getOrder(@Param('id', ParseIntPipe) id: number): Promise<SocialOrder> {
        return this.socialService.findOrderById(id);
    }

    @Perm('MARKETING', 'create')
    @Post('orders/:id/sync')
    async syncOrderToSalesOrder(@Param('id', ParseIntPipe) id: number) {
        return this.socialService.syncOrderToSalesOrder(id);
    }

    // ===================== PRODUCT MAPPINGS =====================

    @Perm('MARKETING', 'view')
    @Get('mappings')
    async getAllMappings(@Query('channel_id') channelId?: string): Promise<SocialProductMapping[]> {
        return this.socialService.findAllMappings(channelId ? parseInt(channelId) : undefined);
    }

    @Perm('MARKETING', 'create')
    @Post('mappings')
    async createMapping(@Body() data: Partial<SocialProductMapping>): Promise<SocialProductMapping> {
        return this.socialService.createMapping(data);
    }

    @Perm('MARKETING', 'update')
    @Put('mappings/:id')
    async updateMapping(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: Partial<SocialProductMapping>,
    ): Promise<SocialProductMapping> {
        return this.socialService.updateMapping(id, data);
    }

    @Perm('MARKETING', 'delete')
    @Delete('mappings/:id')
    async deleteMapping(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        await this.socialService.deleteMapping(id);
        return { message: 'Mapping deleted successfully' };
    }
}

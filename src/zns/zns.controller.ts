import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ZaloZnsService } from './zns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';

@Controller('zns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ZnsController {
  constructor(private readonly znsService: ZaloZnsService) {}

  @Get('config')
  @RequirePermission('SYSTEM', 'can_view')
  async getConfig() {
    const config = await this.znsService.getConfig();
    const now = Date.now();
    const tokenExp = config.access_token_expires_at ? new Date(config.access_token_expires_at).getTime() : 0;
    const refreshExp = config.refresh_token_expires_at ? new Date(config.refresh_token_expires_at).getTime() : 0;

    const tokenHoursLeft = tokenExp > now ? Math.round(((tokenExp - now) / (1000 * 3600)) * 10) / 10 : 0;
    const refreshDaysLeft = refreshExp > now ? Math.round((refreshExp - now) / (1000 * 3600 * 24)) : 0;

    return {
      ...config,
      tokenHoursLeft,
      refreshDaysLeft,
      isTokenExpired: tokenExp <= now,
      isRefreshTokenExpired: refreshExp <= now,
    };
  }

  @Post('config')
  @RequirePermission('SYSTEM', 'can_update')
  saveConfig(@Body() body: any) {
    return this.znsService.saveConfig(body);
  }

  @Post('refresh-token')
  @RequirePermission('SYSTEM', 'can_update')
  refreshToken() {
    return this.znsService.refreshAccessToken();
  }

  @Post('test-connection')
  @RequirePermission('SYSTEM', 'can_view')
  testConnection(@Body('phone') phone: string, @Body('template_id') templateId?: string) {
    return this.znsService.testConnection(phone, templateId);
  }

  @Get('logs')
  @RequirePermission('SALES', 'can_view')
  getLogs(@Query('order_id') orderId?: string, @Query('delivery_id') deliveryId?: string, @Query('limit') limit?: string) {
    return this.znsService.getLogs({
      order_id: orderId ? Number(orderId) : undefined,
      delivery_id: deliveryId ? Number(deliveryId) : undefined,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('orders/:orderId/latest-log')
  @RequirePermission('SALES', 'can_view')
  getLatestOrderLog(@Param('orderId') orderId: number) {
    return this.znsService.getLatestLogForOrder(Number(orderId));
  }

  @Get('deliveries/:deliveryId/latest-log')
  @RequirePermission('SALES', 'can_view')
  getLatestDeliveryLog(@Param('deliveryId') deliveryId: number) {
    return this.znsService.getLatestLogForDelivery(Number(deliveryId));
  }

  @Post('orders/:orderId/send-confirmation')
  @RequirePermission('SALES', 'can_update')
  sendOrderConfirmation(@Param('orderId') orderId: number, @Body() body: any, @Req() req: any) {
    const user = req.user;
    const sentBy = user?.full_name || user?.username || 'User';
    return this.znsService.sendOrderConfirmation(Number(orderId), {
      phone: body?.phone,
      recipientName: body?.recipient_name,
      sentBy,
    });
  }

  @Post('deliveries/:deliveryId/send-notice')
  @RequirePermission('SALES', 'can_update')
  sendDeliveryNotice(@Param('deliveryId') deliveryId: number, @Body() body: any, @Req() req: any) {
    const user = req.user;
    const sentBy = user?.full_name || user?.username || 'User';
    return this.znsService.sendDeliveryNotice(Number(deliveryId), {
      phone: body?.phone,
      recipientName: body?.recipient_name,
      templateId: body?.template_id,
      templateData: body?.template_data,
      sentBy,
    });
  }
}

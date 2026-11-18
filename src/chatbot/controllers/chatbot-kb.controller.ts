import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermission, Perm } from '../../auth/permissions.decorator';
import { ChatbotKbService } from '../kb/chatbot-kb.service';
import { ChatbotToolsService } from '../tools/chatbot-tools.service';

@Controller('chatbot/admin/kb')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatbotKbController {
  constructor(
    private readonly kbService: ChatbotKbService,
    private readonly toolsService: ChatbotToolsService,
  ) {}

  // --- Static Routes first to avoid being captured by /:type ---

  // CB-108: GET /conflicts
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get('conflicts')
  async getConflicts() {
    return this.kbService.getConflicts();
  }

  // CB-109: PUT /conflicts/:code
  @RequirePermission('CHATBOT_KB', 'can_delete')
  @Perm('CHATBOT_KB', 'delete')
  @Put('conflicts/:code')
  async resolveConflict(@Param('code') code: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.kbService.resolveConflict(code, body, userId);
  }

  // CB-110: GET /website-products
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get('website-products')
  async getWebsiteProducts(@Query('q') q?: string) {
    return this.kbService.getWebsiteProducts(q);
  }

  // CB-111: GET /version
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get('version')
  async getVersion() {
    return this.kbService.getVersion();
  }

  // CB-112: POST /preview
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Post('preview')
  async previewTool(@Body() body: any) {
    if (!body || !body.tool) {
      throw new BadRequestException({ code: 'INVALID_TOOL', message: 'Tool name is required' });
    }

    let result: any;
    switch (body.tool) {
      case 'searchKnowledge':
        result = await this.toolsService.searchKnowledge(body.args || {});
        break;
      case 'searchCatalog':
        result = await this.toolsService.searchCatalog(body.args || {});
        break;
      case 'getProductDetails':
        result = await this.toolsService.getProductDetails(body.args || {});
        break;
      case 'compareProducts':
        result = await this.toolsService.compareProducts(body.args || {});
        break;
      case 'getPriceEstimate':
        result = await this.toolsService.getPriceEstimate(body.args || {}, body.ignore_feature_flag);
        break;
      default:
        throw new BadRequestException({ code: 'INVALID_TOOL', message: `Unknown tool: ${body.tool}` });
    }

    return { result };
  }

  // CB-113: GET /sources
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get('sources')
  async getSources() {
    return this.kbService.getSources();
  }

  // CB-120: POST /import
  @RequirePermission('CHATBOT_KB', 'can_create')
  @Perm('CHATBOT_KB', 'create')
  @HttpCode(HttpStatus.OK)
  @Post('import')
  async importKb(@Body() body: any, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.kbService.importKb(body, userId);
  }

  // CB-121: GET /gaps
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get('gaps')
  async getGaps(@Query() query: any) {
    return this.kbService.getGaps(query);
  }

  // CB-122: PUT /gaps/:id
  @RequirePermission('CHATBOT_KB', 'can_update')
  @Perm('CHATBOT_KB', 'update')
  @Put('gaps/:id')
  async updateGap(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.kbService.updateGap(id, body, userId);
  }

  // --- Dynamic /:type Routes ---

  // CB-101: GET /:type
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get(':type')
  async findAll(@Param('type') type: string, @Query() query: any) {
    return this.kbService.findList(type, query);
  }

  // CB-102: GET /:type/:id
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get(':type/:id')
  async findOne(@Param('type') type: string, @Param('id') id: string) {
    return this.kbService.findOne(type, id);
  }

  // CB-103: POST /:type (201 Created)
  @RequirePermission('CHATBOT_KB', 'can_create')
  @Perm('CHATBOT_KB', 'create')
  @Post(':type')
  @HttpCode(HttpStatus.CREATED)
  async create(@Param('type') type: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.kbService.create(type, body, userId);
  }

  // CB-104: PUT /:type/:id
  @RequirePermission('CHATBOT_KB', 'can_update')
  @Perm('CHATBOT_KB', 'update')
  @Put(':type/:id')
  async update(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.kbService.update(type, id, body, userId);
  }

  // CB-105: POST /:type/:id/submit
  @RequirePermission('CHATBOT_KB', 'can_update')
  @Perm('CHATBOT_KB', 'update')
  @HttpCode(HttpStatus.OK)
  @Post(':type/:id/submit')
  async submit(@Param('type') type: string, @Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.kbService.submit(type, id, userId);
  }

  // CB-106: POST /:type/:id/publish
  @RequirePermission('CHATBOT_KB', 'can_delete')
  @Perm('CHATBOT_KB', 'delete')
  @HttpCode(HttpStatus.OK)
  @Post(':type/:id/publish')
  async publish(@Param('type') type: string, @Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.kbService.publish(type, id, userId);
  }

  // CB-107: POST /:type/:id/retire
  @RequirePermission('CHATBOT_KB', 'can_delete')
  @Perm('CHATBOT_KB', 'delete')
  @HttpCode(HttpStatus.OK)
  @Post(':type/:id/retire')
  async retire(@Param('type') type: string, @Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.kbService.retire(type, id, userId);
  }
}

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AgentApiService } from './agent-api.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('api/v1/agent')
export class AgentApiController {
    constructor(private agentApiService: AgentApiService) {}

    @Get('orders')
    getOrders(
        @Query('status') status?: string,
        @Query('deadline_from') deadline_from?: string,
        @Query('deadline_to') deadline_to?: string
    ) {
        return this.agentApiService.getOrders({ status, deadline_from, deadline_to });
    }

    @Get('orders/:id')
    getOrderDetail(@Param('id') id: string) {
        return this.agentApiService.getOrderDetail(Number(id));
    }

    @Get('inventory')
    getInventory(
        @Query('type') type?: string,
        @Query('low_stock') low_stock?: string
    ) {
        return this.agentApiService.getInventory({ type, low_stock });
    }

    @Get('mrp/needs')
    getMrpNeeds(
        @Query('pfo_id') pfo_id?: string,
        @Query('plan_status') plan_status?: string
    ) {
        return this.agentApiService.getMrpNeeds({ 
            pfo_id: pfo_id ? Number(pfo_id) : undefined, 
            plan_status 
        });
    }

    @Get('customers')
    getCustomers(
        @Query('type') type?: string,
        @Query('search') search?: string
    ) {
        return this.agentApiService.getCustomers({ type, search });
    }
}

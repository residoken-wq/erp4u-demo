export const DESIGN_ORDER_HOOKS = 'DESIGN_ORDER_HOOKS';

export interface DesignOrderHooks {
  createDesignOrder(data: any): Promise<any>;
  getDesignOrderByUuid(uuid: string): Promise<any>;
  updateDesignOrderStatus(id: number, status: string): Promise<any>;
}

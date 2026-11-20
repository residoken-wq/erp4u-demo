export const WEBSITE_SERVICE = 'WEBSITE_SERVICE';

export interface WebsiteProductConfigBridge {
  getProductWebsiteConfig(productId: number): Promise<{ customization_config?: any } | null>;
  saveProductWebsiteConfig(productId: number, config: any): Promise<any>;
}

export interface WebsiteMediaUsageBridge {
  getMediaUsageSources(): Promise<{
    productConfigs: Array<{ product_id: number; customization_config: any }>;
    blogs: Array<{ id: number; title: string; featured_image: string; content: string; content_blocks: any }>;
    projects: Array<{ id: number; title: string; image_url: string; content: string; content_blocks: any }>;
  }>;
}

export interface WebsiteServiceBridge
  extends WebsiteProductConfigBridge,
    WebsiteMediaUsageBridge {}

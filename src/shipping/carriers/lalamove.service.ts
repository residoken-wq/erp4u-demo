import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { SystemConfig } from '../../system/system-config.entity';
import { SalesDelivery } from '../../sales/sales-delivery.entity';
import { SalesOrder } from '../../sales/sales-order.entity';

export interface LalamoveConfig {
    apiUrl: string;
    apiKey: string;
    apiSecret: string;
    market: string;
    isSandbox: boolean;
    defaultPickAddress?: string;
    defaultPickLat?: number;
    defaultPickLng?: number;
    defaultSenderName?: string;
    defaultSenderPhone?: string;
}

export interface LalamoveCoordinate {
    lat: string;
    lng: string;
}

export interface LalamoveStopInput {
    coordinates: LalamoveCoordinate;
    address: string;
}

export interface LalamoveItemInput {
    quantity?: string;
    weight?: string;
    categories?: string[];
    handlingInstructions?: string[];
}

export interface LalamoveQuotationDto {
    serviceType: string; // MOTORCYCLE, VAN_500KG, VAN_1000KG, TRUCK_1000KG, TRUCK_1500KG, TRUCK_2000KG
    stops: LalamoveStopInput[];
    language?: string; // vi_VN | en_VN
    scheduleAt?: string; // ISO 8601 UTC
    specialRequests?: string[];
    item?: LalamoveItemInput;
    isRouteOptimized?: boolean;
}

export interface LalamovePushOrderOptions {
    serviceType?: string; // Mặc định VAN_500KG hoặc lấy theo hàng hóa
    senderName?: string;
    senderPhone?: string;
    senderAddress?: string;
    senderLat?: number | string;
    senderLng?: number | string;
    recipientName?: string;
    recipientPhone?: string;
    recipientAddress?: string;
    recipientLat?: number | string;
    recipientLng?: number | string;
    remarks?: string;
    specialRequests?: string[];
    isPODEnabled?: boolean;
    scheduleAt?: string;
    priorityFee?: string | number;
}

// Danh mục loại xe phổ biến tại Việt Nam (TP.HCM & Hà Nội)
export const LALAMOVE_VIETNAM_VEHICLES = [
    {
        key: 'MOTORCYCLE',
        name: 'Xe máy',
        description: 'Bìa giáo án, mẫu vải, phụ kiện nhỏ gọn (< 30kg)',
        maxWeightKg: 30,
        dimensions: '50 x 40 x 50 cm',
        icon: '🛵'
    },
    {
        key: 'VAN_500KG',
        name: 'Xe bán tải 500kg (Van)',
        description: 'Phù hợp 20 - 40 nệm mầm non, tránh mưa ướt tuyệt đối',
        maxWeightKg: 500,
        dimensions: '160 x 120 x 100 cm',
        icon: '🚐'
    },
    {
        key: 'VAN_1000KG',
        name: 'Xe bán tải 1 tấn (Van)',
        description: 'Phù hợp 50 - 80 nệm mầm non, combo bàn ghế tháo lắp',
        maxWeightKg: 1000,
        dimensions: '210 x 130 x 120 cm',
        icon: '🚐'
    },
    {
        key: 'TRUCK_1000KG',
        name: 'Xe tải 1 tấn',
        description: 'Đơn hàng dự án trường học, kiện cồng kềnh, chuyển kho',
        maxWeightKg: 1000,
        dimensions: '300 x 160 x 160 cm',
        icon: '🚚'
    },
    {
        key: 'TRUCK_1500KG',
        name: 'Xe tải 1.5 tấn',
        description: 'Giao sỉ ra Chành xe Bến xe Miền Đông / Bến xe Miền Tây',
        maxWeightKg: 1500,
        dimensions: '340 x 170 x 170 cm',
        icon: '🚚'
    },
    {
        key: 'TRUCK_2000KG',
        name: 'Xe tải 2 tấn',
        description: 'Đơn hàng lớn các trường liên cấp, số lượng nệm và nội thất lớn',
        maxWeightKg: 2000,
        dimensions: '420 x 180 x 180 cm',
        icon: '🚛'
    }
];

@Injectable()
export class LalamoveService {
    private readonly logger = new Logger(LalamoveService.name);

    constructor(
        @InjectRepository(SystemConfig)
        private readonly configRepo: Repository<SystemConfig>,
        @InjectRepository(SalesDelivery)
        private readonly deliveryRepo: Repository<SalesDelivery>,
        @InjectRepository(SalesOrder)
        private readonly orderRepo: Repository<SalesOrder>,
    ) {}

    /**
     * Lấy cấu hình Lalamove (ưu tiên bảng system_configs, fallback sang .env)
     */
    async getConfig(): Promise<LalamoveConfig> {
        const configs = await this.configRepo.find();
        const configMap = new Map(configs.map(c => [c.key, c.value]));

        const apiKey = (configMap.get('LALAMOVE_API_KEY') || process.env.LALAMOVE_API_KEY || '').trim();
        const apiSecret = (configMap.get('LALAMOVE_API_SECRET') || process.env.LALAMOVE_API_SECRET || '').trim();

        const envSandbox = (process.env.LALAMOVE_SANDBOX || '').toLowerCase() === 'true' || 
                           (process.env.LALAMOVE_ENVIRONMENT || '').toUpperCase() === 'SANDBOX';
        
        // Tự động suy đoán môi trường dựa trên tiền tố API Key nếu chưa từng được lưu trong DB
        const defaultSandbox = apiKey.startsWith('pk_prod_') ? false : (envSandbox || true);
        const isSandbox = configMap.has('LALAMOVE_SANDBOX')
            ? (configMap.get('LALAMOVE_SANDBOX') || '').toLowerCase() === 'true'
            : defaultSandbox;

        const defaultUrl = isSandbox 
            ? 'https://rest.sandbox.lalamove.com/v3' 
            : 'https://rest.lalamove.com/v3';

        const apiUrl = (configMap.get('LALAMOVE_API_URL') || process.env.LALAMOVE_API_URL || defaultUrl).replace(/\/+$/, '');
        const market = configMap.get('LALAMOVE_MARKET') || process.env.LALAMOVE_MARKET || 'VN';

        // Thông tin điểm lấy hàng mặc định (Kho ERP4U)
        const defaultPickAddress = configMap.get('LALAMOVE_DEFAULT_PICK_ADDRESS') || 
                                   process.env.LALAMOVE_DEFAULT_PICK_ADDRESS || 
                                   'Kho ERP4U, Tân Thới Nhất, Quận 12, TP. Hồ Chí Minh';
        const defaultPickLat = Number(configMap.get('LALAMOVE_DEFAULT_PICK_LAT') || process.env.LALAMOVE_DEFAULT_PICK_LAT || 10.8230989);
        const defaultPickLng = Number(configMap.get('LALAMOVE_DEFAULT_PICK_LNG') || process.env.LALAMOVE_DEFAULT_PICK_LNG || 106.6296638);
        const defaultSenderName = configMap.get('LALAMOVE_DEFAULT_SENDER_NAME') || process.env.LALAMOVE_DEFAULT_SENDER_NAME || 'Kho ERP4U';
        const defaultSenderPhone = configMap.get('LALAMOVE_DEFAULT_SENDER_PHONE') || process.env.LALAMOVE_DEFAULT_SENDER_PHONE || '+84901234567';

        return {
            apiUrl,
            apiKey,
            apiSecret,
            market,
            isSandbox,
            defaultPickAddress,
            defaultPickLat,
            defaultPickLng,
            defaultSenderName,
            defaultSenderPhone,
        };
    }

    /**
     * Lưu cấu hình Lalamove vào system_configs
     */
    async saveConfig(data: {
        apiKey?: string;
        apiSecret?: string;
        isSandbox?: boolean;
        apiUrl?: string;
        market?: string;
        defaultPickAddress?: string;
        defaultPickLat?: number;
        defaultPickLng?: number;
        defaultSenderName?: string;
        defaultSenderPhone?: string;
    }) {
        const setConfigValue = async (key: string, value: string, description: string) => {
            let item = await this.configRepo.findOne({ where: { key } });
            if (!item) {
                item = this.configRepo.create({ key, value, description });
            } else {
                item.value = value;
                if (description) item.description = description;
            }
            return this.configRepo.save(item);
        };

        if (data.apiKey !== undefined) {
            await setConfigValue('LALAMOVE_API_KEY', data.apiKey.trim(), 'Lalamove API Key');
        }
        if (data.apiSecret !== undefined) {
            await setConfigValue('LALAMOVE_API_SECRET', data.apiSecret.trim(), 'Lalamove API Secret');
        }
        if (data.isSandbox !== undefined) {
            await setConfigValue('LALAMOVE_SANDBOX', data.isSandbox ? 'true' : 'false', 'Lalamove Môi trường Sandbox');
            const targetUrl = data.apiUrl?.trim() || (data.isSandbox ? 'https://rest.sandbox.lalamove.com/v3' : 'https://rest.lalamove.com/v3');
            await setConfigValue('LALAMOVE_API_URL', targetUrl, 'Lalamove API Base URL');
        }
        if (data.apiUrl !== undefined) {
            await setConfigValue('LALAMOVE_API_URL', data.apiUrl.trim(), 'Lalamove API Base URL');
        }
        if (data.market !== undefined) {
            await setConfigValue('LALAMOVE_MARKET', data.market.trim(), 'Lalamove Thị trường (Mặc định: VN)');
        }
        if (data.defaultPickAddress !== undefined) {
            await setConfigValue('LALAMOVE_DEFAULT_PICK_ADDRESS', data.defaultPickAddress.trim(), 'Địa chỉ kho xuất hàng mặc định Lalamove');
        }
        if (data.defaultPickLat !== undefined) {
            await setConfigValue('LALAMOVE_DEFAULT_PICK_LAT', String(data.defaultPickLat), 'Tọa độ Vĩ độ (Latitude) kho ERP4U');
        }
        if (data.defaultPickLng !== undefined) {
            await setConfigValue('LALAMOVE_DEFAULT_PICK_LNG', String(data.defaultPickLng), 'Tọa độ Kinh độ (Longitude) kho ERP4U');
        }
        if (data.defaultSenderName !== undefined) {
            await setConfigValue('LALAMOVE_DEFAULT_SENDER_NAME', data.defaultSenderName.trim(), 'Tên người gửi / Thủ kho mặc định');
        }
        if (data.defaultSenderPhone !== undefined) {
            await setConfigValue('LALAMOVE_DEFAULT_SENDER_PHONE', data.defaultSenderPhone.trim(), 'Số điện thoại người gửi mặc định (E.164)');
        }

        return { success: true, message: 'Đã lưu cấu hình Lalamove thành công' };
    }

    /**
     * Sinh chữ ký HMAC SHA-256 và các header theo chuẩn Lalamove v3
     */
    private createAuthHeaders(
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
        path: string,
        bodyStr: string,
        config: LalamoveConfig,
    ): Record<string, string> {
        const apiKey = (config.apiKey || '').trim();
        const apiSecret = (config.apiSecret || '').trim();
        const time = Date.now().toString();
        // Cấu trúc ký tự: time\r\nmethod\r\npath\r\n\r\nbody
        const rawSignature = `${time}\r\n${method}\r\n${path}\r\n\r\n${bodyStr}`;

        const signature = crypto
            .createHmac('sha256', apiSecret)
            .update(rawSignature)
            .digest('hex');

        const token = `${apiKey}:${time}:${signature}`;
        const requestId = crypto.randomUUID();

        return {
            'Authorization': `hmac ${token}`,
            'Market': config.market || 'VN',
            'Request-ID': requestId,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Kiểm tra kết nối tới Lalamove API (gọi GET /v3/cities)
     */
    async testConnection(customConfig?: Partial<LalamoveConfig>) {
        const baseConfig = await this.getConfig();

        const apiKey = (customConfig?.apiKey ?? baseConfig.apiKey ?? '').trim();
        const apiSecret = (customConfig?.apiSecret ?? baseConfig.apiSecret ?? '').trim();

        // Môi trường: ưu tiên customConfig nếu truyền vào, ngược lại lấy baseConfig
        const isSandbox = customConfig?.isSandbox !== undefined 
            ? Boolean(customConfig.isSandbox) 
            : baseConfig.isSandbox;

        const defaultUrl = isSandbox 
            ? 'https://rest.sandbox.lalamove.com/v3' 
            : 'https://rest.lalamove.com/v3';

        const config: LalamoveConfig = {
            ...baseConfig,
            ...customConfig,
            apiKey,
            apiSecret,
            isSandbox,
            apiUrl: (customConfig?.apiUrl || defaultUrl).replace(/\/+$/, ''),
        };

        if (!config.apiKey || !config.apiSecret) {
            return {
                success: false,
                message: 'Chưa điền API Key hoặc API Secret của Lalamove',
            };
        }

        try {
            const path = '/v3/cities';
            const headers = this.createAuthHeaders('GET', path, '', config);
            const res = await axios.get(`${config.apiUrl}${path}`, { headers, timeout: 10000 });

            if (res.status === 200 && res.data?.data) {
                const vnCities = res.data.data.filter((c: any) => c.locode?.startsWith('VN'));
                return {
                    success: true,
                    message: `Kết nối thành công! Môi trường: ${isSandbox ? 'Thử nghiệm (Sandbox)' : 'Thực tế (Production)'}. Đã tải ${vnCities.length || res.data.data.length} khu vực hoạt động.`,
                    cities: vnCities.length ? vnCities : res.data.data,
                };
            }
            return {
                success: false,
                message: 'Phản hồi từ Lalamove không hợp lệ',
                data: res.data,
            };
        } catch (e: any) {
            this.logger.error(`Lalamove test connection failed: ${e.message}`);
            let errorMsg = e.response?.data?.message || e.response?.data?.errors?.[0]?.detail || e.message;

            // Chẩn đoán chi tiết khi gặp mã 401 Unauthorized
            if (e.response?.status === 401) {
                if (config.apiKey.startsWith('pk_prod_') && isSandbox) {
                    errorMsg = `Lỗi 401 Unauthorized: Bạn đang dùng API Key Production (bắt đầu bằng 'pk_prod_') nhưng đang chọn Môi trường 'Thử nghiệm (Sandbox)'. Vui lòng chuyển Môi trường kết nối sang 'Thực tế (Production)' rồi bấm Lưu & Thử lại.`;
                } else if (config.apiKey.startsWith('pk_test_') && !isSandbox) {
                    errorMsg = `Lỗi 401 Unauthorized: Bạn đang dùng API Key Sandbox (bắt đầu bằng 'pk_test_') nhưng đang chọn Môi trường 'Thực tế (Production)'. Vui lòng chuyển Môi trường kết nối sang 'Thử nghiệm (Sandbox)' rồi bấm Lưu & Thử lại.`;
                } else {
                    errorMsg = `Lỗi 401 Unauthorized: Lalamove từ chối xác thực. Vui lòng kiểm tra lại API Key và API Secret xem có bị sai hoặc thừa khoảng trắng không.`;
                }
            }

            return {
                success: false,
                message: `Kiểm tra kết nối thất bại: ${errorMsg}`,
                status: e.response?.status,
                detail: e.response?.data,
            };
        }
    }

    /**
     * Dịch vụ Geocoding phân giải địa chỉ thành tọa độ Lat / Lng
     * Sử dụng OpenStreetMap Nominatim miễn phí hoặc fallback về tọa độ trung tâm thành phố
     */
    async geocodeAddress(address: string): Promise<LalamoveCoordinate> {
        if (!address || !address.trim()) {
            return { lat: '10.8230989', lng: '106.6296638' }; // Default TP.HCM
        }

        try {
            const clean = address.trim();
            // Thử gọi Nominatim OpenStreetMap
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean + ', Việt Nam')}&format=json&limit=1`;
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'ERP4UERP-Shipping/1.0' },
                timeout: 5000,
            });

            if (res.data && res.data.length > 0) {
                const item = res.data[0];
                return {
                    lat: String(Number(item.lat).toFixed(7)),
                    lng: String(Number(item.lon).toFixed(7)),
                };
            }
        } catch (e: any) {
            this.logger.warn(`Geocoding failed for address "${address}": ${e.message}`);
        }

        // Fallback: nếu chứa Hà Nội thì trả tọa độ HN, ngược lại trả HCM
        const lower = address.toLowerCase();
        if (lower.includes('hà nội') || lower.includes('ha noi')) {
            return { lat: '21.028511', lng: '105.854167' };
        }
        return { lat: '10.776889', lng: '106.700806' };
    }

    /**
     * Lấy báo giá cước (Quotation) từ Lalamove: POST /v3/quotations
     */
    async getQuotation(dto: LalamoveQuotationDto) {
        const config = await this.getConfig();

        if (!config.apiKey || !config.apiSecret) {
            // Chế độ mô phỏng (Demo / Chưa có key)
            return this.generateMockQuotation(dto);
        }

        try {
            const path = '/v3/quotations';
            const payload = {
                data: {
                    serviceType: dto.serviceType || 'VAN_500KG',
                    language: dto.language || 'vi_VN',
                    stops: dto.stops.map(s => ({
                        coordinates: {
                            lat: String(s.coordinates.lat),
                            lng: String(s.coordinates.lng),
                        },
                        address: s.address,
                    })),
                    scheduleAt: dto.scheduleAt || undefined,
                    specialRequests: dto.specialRequests?.length ? dto.specialRequests : undefined,
                    item: dto.item || undefined,
                    isRouteOptimized: dto.isRouteOptimized ?? false,
                },
            };

            const bodyStr = JSON.stringify(payload);
            const headers = this.createAuthHeaders('POST', path, bodyStr, config);

            const res = await axios.post(`${config.apiUrl}${path}`, payload, { headers, timeout: 10000 });
            return {
                success: true,
                data: res.data?.data,
            };
        } catch (e: any) {
            this.logger.error(`Lalamove quotation error: ${e.message}`);
            const errorMsg = e.response?.data?.message || e.response?.data?.errors?.[0]?.detail || e.message;
            throw new BadRequestException(`Lỗi lấy báo giá Lalamove: ${errorMsg}`);
        }
    }

    /**
     * Báo giá mô phỏng khi chưa nhập Token thật (dành cho thử nghiệm giao diện)
     */
    private generateMockQuotation(dto: LalamoveQuotationDto) {
        const mockQuotationId = `MOCK_QUO_${Date.now()}`;
        const vehicle = LALAMOVE_VIETNAM_VEHICLES.find(v => v.key === dto.serviceType) || LALAMOVE_VIETNAM_VEHICLES[1];
        
        let baseFee = 60000;
        if (dto.serviceType === 'VAN_500KG') baseFee = 160000;
        else if (dto.serviceType === 'VAN_1000KG') baseFee = 250000;
        else if (dto.serviceType === 'TRUCK_1000KG') baseFee = 320000;
        else if (dto.serviceType === 'TRUCK_1500KG') baseFee = 420000;
        else if (dto.serviceType === 'TRUCK_2000KG') baseFee = 550000;

        return {
            success: true,
            is_mock: true,
            message: 'Báo giá mô phỏng (Chưa cấu hình API Key Lalamove)',
            data: {
                quotationId: mockQuotationId,
                scheduleAt: dto.scheduleAt || new Date().toISOString(),
                expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 phút
                serviceType: dto.serviceType,
                vehicleName: vehicle.name,
                stops: dto.stops.map((s, idx) => ({
                    stopId: `mock_stop_${idx}_${Date.now()}`,
                    coordinates: s.coordinates,
                    address: s.address,
                })),
                priceBreakdown: {
                    base: String(baseFee),
                    specialRequests: '0',
                    vat: String(Math.round(baseFee * 0.08)),
                    total: String(Math.round(baseFee * 1.08)),
                    currency: 'VND',
                },
                distance: {
                    value: '12500',
                    unit: 'm',
                },
            },
        };
    }

    /**
     * Tạo vận đơn / Đặt cuốc xe Lalamove từ Phiếu xuất kho: POST /v3/orders
     */
    async pushDeliveryToLalamove(deliveryId: number, options: LalamovePushOrderOptions) {
        const delivery = await this.deliveryRepo.findOne({
            where: { id: deliveryId },
            relations: ['sales_order', 'sales_order.items', 'items'],
        });

        if (!delivery) {
            throw new NotFoundException(`Không tìm thấy phiếu xuất kho #${deliveryId}`);
        }

        const config = await this.getConfig();

        // 1. Chuẩn bị tọa độ điểm lấy (Kho ERP4U)
        const pickLat = options.senderLat ? String(options.senderLat) : String(config.defaultPickLat);
        const pickLng = options.senderLng ? String(options.senderLng) : String(config.defaultPickLng);
        const pickAddress = options.senderAddress || config.defaultPickAddress;
        const senderName = options.senderName || config.defaultSenderName;
        let senderPhone = options.senderPhone || config.defaultSenderPhone;
        if (senderPhone && !senderPhone.startsWith('+')) {
            senderPhone = senderPhone.startsWith('0') ? `+84${senderPhone.slice(1)}` : `+84${senderPhone}`;
        }

        // 2. Chuẩn bị tọa độ điểm giao
        const dropAddress = options.recipientAddress || delivery.delivery_address || 'Địa chỉ khách hàng';
        let dropLat = options.recipientLat ? String(options.recipientLat) : '';
        let dropLng = options.recipientLng ? String(options.recipientLng) : '';

        if (!dropLat || !dropLng) {
            const resolved = await this.geocodeAddress(dropAddress);
            dropLat = resolved.lat;
            dropLng = resolved.lng;
        }

        const recipientName = options.recipientName || delivery.contact_name || delivery.sales_order?.contact_person || 'Người nhận hàng';
        let recipientPhone = options.recipientPhone || delivery.contact_phone || delivery.sales_order?.phone || '+84900000000';
        if (recipientPhone && !recipientPhone.startsWith('+')) {
            recipientPhone = recipientPhone.startsWith('0') ? `+84${recipientPhone.slice(1)}` : `+84${recipientPhone}`;
        }

        const serviceType = options.serviceType || 'VAN_500KG';

        // 3. Nếu chưa cấu hình Key hoặc là Demo -> Tạo đơn mô phỏng
        if (!config.apiKey || !config.apiSecret) {
            return this.createMockOrder(delivery, serviceType, pickAddress, dropAddress, senderPhone, recipientPhone);
        }

        try {
            // Bước 3.1: Gọi Quotation trước để lấy quotationId và stopId
            const quoPayload: LalamoveQuotationDto = {
                serviceType,
                stops: [
                    { coordinates: { lat: pickLat, lng: pickLng }, address: pickAddress },
                    { coordinates: { lat: dropLat, lng: dropLng }, address: dropAddress },
                ],
                language: 'vi_VN',
                scheduleAt: options.scheduleAt,
                specialRequests: options.specialRequests,
                item: {
                    quantity: String(delivery.package_count || 1),
                    weight: (delivery.weight_gram || 500) > 30000 ? 'MORE_THAN_30_KG' : 'LESS_THAN_30_KG',
                    categories: ['OFFICE_ITEM', 'OTHERS'],
                    handlingInstructions: ['KEEP_UPRIGHT', 'FRAGILE'],
                },
            };

            const quoRes = await this.getQuotation(quoPayload);
            const quotationData = quoRes.data;

            if (!quotationData || !quotationData.quotationId || !quotationData.stops) {
                throw new BadRequestException('Không nhận được thông tin báo giá từ Lalamove');
            }

            const senderStopId = quotationData.stops[0].stopId;
            const recipientStopId = quotationData.stops[1].stopId;

            // Bước 3.2: Đặt xe chính thức POST /v3/orders
            const orderPayload = {
                data: {
                    quotationId: quotationData.quotationId,
                    sender: {
                        stopId: senderStopId,
                        name: senderName,
                        phone: senderPhone,
                    },
                    recipients: [
                        {
                            stopId: recipientStopId,
                            name: recipientName,
                            phone: recipientPhone,
                            remarks: options.remarks || delivery.note || 'Giao hàng nệm mầm non ERP4U',
                        },
                    ],
                    isPODEnabled: options.isPODEnabled ?? true, // Chụp ảnh và ký nhận POD
                    metadata: {
                        deliveryId: String(delivery.id),
                        deliveryCode: delivery.code,
                        orderCode: delivery.sales_order?.code || '',
                    },
                },
            };

            const orderBodyStr = JSON.stringify(orderPayload);
            const orderHeaders = this.createAuthHeaders('POST', '/v3/orders', orderBodyStr, config);

            const orderRes = await axios.post(`${config.apiUrl}/v3/orders`, orderPayload, {
                headers: orderHeaders,
                timeout: 15000,
            });

            const orderData = orderRes.data?.data;
            const totalCost = Number(orderData?.priceBreakdown?.total) || Number(quotationData.priceBreakdown?.total) || 0;

            // Bước 3.3: Cập nhật phiếu xuất kho
            delivery.shipping_carrier = 'LALAMOVE';
            delivery.shipping_provider = 'LALAMOVE';
            delivery.tracking_code = String(orderData.orderId);
            delivery.shipping_cost = totalCost;
            delivery.shipping_status_text = 'ASSIGNING_DRIVER';
            delivery.shipping_metadata = {
                ...(delivery.shipping_metadata || {}),
                lalamove: {
                    orderId: orderData.orderId,
                    quotationId: quotationData.quotationId,
                    serviceType,
                    status: orderData.status || 'ASSIGNING_DRIVER',
                    shareLink: orderData.shareLink,
                    driverId: orderData.driverId,
                    priceBreakdown: orderData.priceBreakdown,
                    distance: orderData.distance,
                    stops: orderData.stops,
                    pushedAt: new Date().toISOString(),
                },
            };

            await this.deliveryRepo.save(delivery);

            return {
                success: true,
                is_mock: false,
                tracking_code: orderData.orderId,
                share_link: orderData.shareLink,
                status: orderData.status,
                cost: totalCost,
                message: `Đã tạo cuốc xe Lalamove thành công! Mã đơn: ${orderData.orderId}`,
            };
        } catch (e: any) {
            this.logger.error(`Lalamove push order failed: ${e.message}`);
            const errorMsg = e.response?.data?.message || e.response?.data?.errors?.[0]?.detail || e.message;
            throw new BadRequestException(`Lỗi tạo cuốc xe Lalamove: ${errorMsg}`);
        }
    }

    /**
     * Tạo đơn mô phỏng khi chưa nhập Key thật
     */
    private async createMockOrder(
        delivery: SalesDelivery,
        serviceType: string,
        pickAddress: string,
        dropAddress: string,
        senderPhone: string,
        recipientPhone: string,
    ) {
        const mockOrderId = `LLM_${Date.now()}`;
        const mockShareLink = `https://share.sandbox.lalamove.com/?VN_MOCK_${Date.now()}&lang=vi_VN`;
        const vehicle = LALAMOVE_VIETNAM_VEHICLES.find(v => v.key === serviceType) || LALAMOVE_VIETNAM_VEHICLES[1];
        
        const cost = serviceType === 'MOTORCYCLE' ? 45000 : (serviceType === 'VAN_500KG' ? 180000 : 350000);

        delivery.shipping_carrier = 'LALAMOVE';
        delivery.shipping_provider = 'LALAMOVE';
        delivery.tracking_code = mockOrderId;
        delivery.shipping_cost = cost;
        delivery.shipping_status_text = 'ASSIGNING_DRIVER';
        delivery.shipping_metadata = {
            ...(delivery.shipping_metadata || {}),
            lalamove: {
                is_mock: true,
                orderId: mockOrderId,
                serviceType,
                vehicleName: vehicle.name,
                status: 'ASSIGNING_DRIVER',
                shareLink: mockShareLink,
                driverId: null,
                priceBreakdown: { total: String(cost), currency: 'VND' },
                stops: [
                    { address: pickAddress, phone: senderPhone },
                    { address: dropAddress, phone: recipientPhone },
                ],
                pushedAt: new Date().toISOString(),
            },
        };

        await this.deliveryRepo.save(delivery);

        return {
            success: true,
            is_mock: true,
            tracking_code: mockOrderId,
            share_link: mockShareLink,
            status: 'ASSIGNING_DRIVER',
            cost,
            message: `[Mô phỏng] Đã tạo cuốc xe Lalamove Demo: ${mockOrderId}`,
        };
    }

    /**
     * Xem thông tin đơn hàng & Trạng thái: GET /v3/orders/{orderId}
     */
    async getOrderDetails(orderId: string) {
        const config = await this.getConfig();
        if (!config.apiKey || !config.apiSecret || orderId.startsWith('LLM_')) {
            return {
                orderId,
                status: 'ON_GOING',
                shareLink: `https://share.sandbox.lalamove.com/?VN_${orderId}`,
                is_mock: true,
            };
        }

        try {
            const path = `/v3/orders/${orderId}`;
            const headers = this.createAuthHeaders('GET', path, '', config);
            const res = await axios.get(`${config.apiUrl}${path}`, { headers, timeout: 10000 });
            return res.data?.data;
        } catch (e: any) {
            this.logger.error(`Get Lalamove order details failed: ${e.message}`);
            throw new BadRequestException(`Không thể lấy chi tiết đơn Lalamove: ${e.response?.data?.message || e.message}`);
        }
    }

    /**
     * Lấy thông tin tài xế & Tọa độ GPS thời gian thực: GET /v3/orders/{orderId}/drivers/{driverId}
     */
    async getDriverDetails(orderId: string, driverId: string) {
        const config = await this.getConfig();
        if (!config.apiKey || !config.apiSecret || orderId.startsWith('LLM_')) {
            return {
                driverId: driverId || 'DRV_DEMO',
                name: 'Nguyễn Văn Tài (Tài xế Demo)',
                phone: '+84909123456',
                plateNumber: '51D-987.65',
                photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
                coordinates: {
                    lat: '10.8231',
                    lng: '106.6297',
                    updatedAt: new Date().toISOString(),
                },
                is_mock: true,
            };
        }

        try {
            const path = `/v3/orders/${orderId}/drivers/${driverId}`;
            const headers = this.createAuthHeaders('GET', path, '', config);
            const res = await axios.get(`${config.apiUrl}${path}`, { headers, timeout: 10000 });
            return res.data?.data;
        } catch (e: any) {
            this.logger.error(`Get Lalamove driver details failed: ${e.message}`);
            throw new BadRequestException(`Không thể lấy thông tin tài xế: ${e.response?.data?.message || e.message}`);
        }
    }

    /**
     * Thêm tiền tip / Phí ưu tiên: POST /v3/orders/{orderId}/priority-fee
     */
    async addPriorityFee(deliveryId: number, priorityFee: number) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery || !delivery.tracking_code) {
            throw new NotFoundException('Phiếu xuất kho chưa có mã đơn Lalamove');
        }

        const config = await this.getConfig();
        const orderId = delivery.tracking_code;

        if (!config.apiKey || !config.apiSecret || orderId.startsWith('LLM_')) {
            return { success: true, message: `[Demo] Đã thêm ${priorityFee.toLocaleString()}đ phí ưu tiên cho tài xế.` };
        }

        try {
            const path = `/v3/orders/${orderId}/priority-fee`;
            const payload = { data: { priorityFee: String(priorityFee) } };
            const bodyStr = JSON.stringify(payload);
            const headers = this.createAuthHeaders('POST', path, bodyStr, config);

            const res = await axios.post(`${config.apiUrl}${path}`, payload, { headers, timeout: 10000 });
            return {
                success: true,
                message: `Đã cộng thêm ${priorityFee.toLocaleString()}đ cước ưu tiên thành công!`,
                data: res.data?.data,
            };
        } catch (e: any) {
            const err = e.response?.data?.message || e.message;
            throw new BadRequestException(`Không thể thêm phí ưu tiên: ${err}`);
        }
    }

    /**
     * Hủy cuốc xe Lalamove: DELETE /v3/orders/{orderId}
     */
    async cancelOrder(deliveryId: number) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery || !delivery.tracking_code) {
            throw new NotFoundException('Không tìm thấy mã đơn Lalamove để hủy');
        }

        const config = await this.getConfig();
        const orderId = delivery.tracking_code;

        if (!config.apiKey || !config.apiSecret || orderId.startsWith('LLM_')) {
            delivery.shipping_status_text = 'CANCELED';
            if (delivery.shipping_metadata?.lalamove) {
                delivery.shipping_metadata.lalamove.status = 'CANCELED';
            }
            await this.deliveryRepo.save(delivery);
            return { success: true, message: 'Đã hủy cuốc xe Lalamove thành công (Chế độ Demo)' };
        }

        try {
            const path = `/v3/orders/${orderId}`;
            const headers = this.createAuthHeaders('DELETE', path, '', config);
            await axios.delete(`${config.apiUrl}${path}`, { headers, timeout: 10000 });

            delivery.shipping_status_text = 'CANCELED';
            if (delivery.shipping_metadata?.lalamove) {
                delivery.shipping_metadata.lalamove.status = 'CANCELED';
            }
            await this.deliveryRepo.save(delivery);

            return { success: true, message: 'Đã hủy cuốc xe Lalamove thành công' };
        } catch (e: any) {
            const err = e.response?.data?.message || e.message;
            throw new BadRequestException(`Lỗi khi hủy đơn Lalamove: ${err}`);
        }
    }

    /**
     * Xử lý Webhook nhận callback sự kiện từ Lalamove
     */
    async handleWebhook(body: any) {
        this.logger.log(`Received Lalamove Webhook: ${JSON.stringify(body)}`);

        const orderData = body?.data?.order || body?.data;
        const event = body?.eventType || body?.event || body?.data?.event;

        if (!orderData || !orderData.orderId) {
            return { success: true, message: 'Ignored: No orderId found' };
        }

        const orderId = String(orderData.orderId);
        const delivery = await this.deliveryRepo.findOne({
            where: { tracking_code: orderId },
            relations: ['sales_order'],
        });

        if (!delivery) {
            this.logger.warn(`Lalamove webhook: delivery with tracking_code ${orderId} not found`);
            return { success: true, message: 'Delivery not found in ERP' };
        }

        const metadata = delivery.shipping_metadata?.lalamove || {};

        if (orderData.status) {
            delivery.shipping_status_text = orderData.status;
            metadata.status = orderData.status;
        }

        if (orderData.driverId) {
            metadata.driverId = orderData.driverId;
        }

        // Nếu có bằng chứng giao hàng POD
        const podInfo = orderData.stops?.find((s: any) => s.POD?.image);
        if (podInfo && podInfo.POD) {
            metadata.pod = {
                status: podInfo.POD.status,
                image: podInfo.POD.image,
                deliveredAt: podInfo.POD.deliveredAt,
            };
        }

        // Tự động chuyển trạng thái phiếu xuất kho
        if (orderData.status === 'COMPLETED') {
            delivery.status = 'COMPLETED';
        } else if (orderData.status === 'PICKED_UP' || orderData.status === 'ON_GOING') {
            delivery.status = 'SHIPPED';
        }

        delivery.shipping_metadata = {
            ...(delivery.shipping_metadata || {}),
            lalamove: metadata,
        };

        await this.deliveryRepo.save(delivery);

        return {
            success: true,
            event,
            orderId,
            deliveryId: delivery.id,
            status: delivery.shipping_status_text,
        };
    }
}

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SystemConfig } from '../../system/system-config.entity';
import { SalesDelivery } from '../../sales/sales-delivery.entity';
import { SalesOrder } from '../../sales/sales-order.entity';

export interface GhtkConfig {
    apiUrl: string;
    token: string;
    partnerCode: string;
    isSandbox: boolean;
    defaultPickAddressId?: string;
    defaultPickOption?: 'cod' | 'post';
}

export interface GhtkFeeDto {
    pick_province?: string;
    pick_district?: string;
    pick_ward?: string;
    pick_address?: string;
    pick_address_id?: string;
    pick_option?: 'cod' | 'post';
    province?: string;
    district?: string;
    ward?: string;
    address?: string;
    weight: number; // gram
    value?: number; // VND
    transport?: 'road' | 'fly';
    length?: number; // cm
    width?: number; // cm
    height?: number; // cm
    package_count?: number;
}

const VIETNAM_PROVINCES = [
    { names: ['vũng tàu', 'vung tau', 'bà rịa', 'ba ria', 'bà rịa vũng tàu', 'ba ria vung tau'], standard: 'Bà Rịa - Vũng Tàu', defaultCity: 'TP. Vũng Tàu' },
    { names: ['hồ chí minh', 'ho chi minh', 'hcm', 'tphcm', 'tp hcm', 'sài gòn', 'sai gon'], standard: 'Hồ Chí Minh' },
    { names: ['hà nội', 'ha noi', 'hn'], standard: 'Hà Nội' },
    { names: ['đà nẵng', 'da nang'], standard: 'Đà Nẵng' },
    { names: ['hải phòng', 'hai phong'], standard: 'Hải Phòng' },
    { names: ['cần thơ', 'can tho'], standard: 'Cần Thơ' },
    { names: ['bình dương', 'binh duong', 'thủ dầu một', 'thu dau mot', 'dĩ an', 'di an', 'thuận an', 'thuan an'], standard: 'Bình Dương', defaultCity: 'Thành phố Thủ Dầu Một' },
    { names: ['đồng nai', 'dong nai', 'biên hòa', 'bien hoa', 'long khánh'], standard: 'Đồng Nai', defaultCity: 'Thành phố Biên Hòa' },
    { names: ['long an', 'tân an', 'tan an'], standard: 'Long An', defaultCity: 'Thành phố Tân An' },
    { names: ['tiền giang', 'mỹ tho', 'my tho'], standard: 'Tiền Giang', defaultCity: 'Thành phố Mỹ Tho' },
    { names: ['bến tre', 'ben tre'], standard: 'Bến Tre', defaultCity: 'Thành phố Bến Tre' },
    { names: ['vĩnh long', 'vinh long'], standard: 'Vĩnh Long', defaultCity: 'Thành phố Vĩnh Long' },
    { names: ['trà vinh', 'tra vinh'], standard: 'Trà Vinh', defaultCity: 'Thành phố Trà Vinh' },
    { names: ['hậu giang', 'hau giang', 'vị thanh'], standard: 'Hậu Giang', defaultCity: 'Thành phố Vị Thanh' },
    { names: ['sóc trăng', 'soc trang'], standard: 'Sóc Trăng', defaultCity: 'Thành phố Sóc Trăng' },
    { names: ['bạc liêu', 'bac lieu'], standard: 'Bạc Liêu', defaultCity: 'Thành phố Bạc Liêu' },
    { names: ['cà mau', 'ca mau'], standard: 'Cà Mau', defaultCity: 'Thành phố Cà Mau' },
    { names: ['kiên giang', 'kien giang', 'rạch giá', 'phú quốc'], standard: 'Kiên Giang', defaultCity: 'Thành phố Rạch Giá' },
    { names: ['an giang', 'long xuyên', 'châu đốc'], standard: 'An Giang', defaultCity: 'Thành phố Long Xuyên' },
    { names: ['đồng tháp', 'dong thap', 'cao lãnh', 'sa đéc'], standard: 'Đồng Tháp', defaultCity: 'Thành phố Cao Lãnh' },
    { names: ['tây ninh', 'tay ninh'], standard: 'Tây Ninh', defaultCity: 'Thành phố Tây Ninh' },
    { names: ['bình phước', 'binh phuoc', 'đồng xoài'], standard: 'Bình Phước', defaultCity: 'Thành phố Đồng Xoài' },
    { names: ['lâm đồng', 'lam dong', 'đà lạt', 'da lat', 'bảo lộc'], standard: 'Lâm Đồng', defaultCity: 'Thành phố Đà Lạt' },
    { names: ['khánh hòa', 'khanh hoa', 'nha trang', 'cam ranh'], standard: 'Khánh Hòa', defaultCity: 'Thành phố Nha Trang' },
    { names: ['ninh thuận', 'ninh thuan', 'phan rang'], standard: 'Ninh Thuận', defaultCity: 'Thành phố Phan Rang - Tháp Chàm' },
    { names: ['bình thuận', 'binh thuan', 'phan thiết'], standard: 'Bình Thuận', defaultCity: 'Thành phố Phan Thiết' },
    { names: ['đắk lắk', 'dak lak', 'daklak', 'buôn ma thuột'], standard: 'Đắk Lắk', defaultCity: 'Thành phố Buôn Ma Thuột' },
    { names: ['đắk nông', 'dak nong'], standard: 'Đắk Nông', defaultCity: 'Thành phố Gia Nghĩa' },
    { names: ['gia lai', 'pleiku'], standard: 'Gia Lai', defaultCity: 'Thành phố Pleiku' },
    { names: ['kon tum'], standard: 'Kon Tum', defaultCity: 'Thành phố Kon Tum' },
    { names: ['phú yên', 'tuy hòa'], standard: 'Phú Yên', defaultCity: 'Thành phố Tuy Hòa' },
    { names: ['bình định', 'binh dinh', 'quy nhơn'], standard: 'Bình Định', defaultCity: 'Thành phố Quy Nhơn' },
    { names: ['quảng ngãi', 'quang ngai'], standard: 'Quảng Ngãi', defaultCity: 'Thành phố Quảng Ngãi' },
    { names: ['quảng nam', 'tam kỳ', 'hội an'], standard: 'Quảng Nam', defaultCity: 'Thành phố Tam Kỳ' },
    { names: ['thừa thiên huế', 'huế', 'hue'], standard: 'Thừa Thiên Huế', defaultCity: 'Thành phố Huế' },
    { names: ['quảng trị', 'đông hà'], standard: 'Quảng Trị', defaultCity: 'Thành phố Đông Hà' },
    { names: ['quảng bình', 'đồng hới'], standard: 'Quảng Bình', defaultCity: 'Thành phố Đồng Hới' },
    { names: ['hà tĩnh', 'ha tinh'], standard: 'Hà Tĩnh', defaultCity: 'Thành phố Hà Tĩnh' },
    { names: ['nghệ an', 'vinh'], standard: 'Nghệ An', defaultCity: 'Thành phố Vinh' },
    { names: ['thanh hóa', 'thanh hoa'], standard: 'Thanh Hóa', defaultCity: 'Thành phố Thanh Hóa' },
    { names: ['ninh bình', 'ninh binh'], standard: 'Ninh Bình', defaultCity: 'Thành phố Ninh Bình' },
    { names: ['nam định', 'nam dinh'], standard: 'Nam Định', defaultCity: 'Thành phố Nam Định' },
    { names: ['thái bình', 'thai binh'], standard: 'Thái Bình', defaultCity: 'Thành phố Thái Bình' },
    { names: ['hà nam', 'phủ lý'], standard: 'Hà Nam', defaultCity: 'Thành phố Phủ Lý' },
    { names: ['hưng yên', 'hung yen'], standard: 'Hưng Yên', defaultCity: 'Thành phố Hưng Yên' },
    { names: ['hải dương', 'hai duong'], standard: 'Hải Dương', defaultCity: 'Thành phố Hải Dương' },
    { names: ['bắc ninh', 'bac ninh'], standard: 'Bắc Ninh', defaultCity: 'Thành phố Bắc Ninh' },
    { names: ['bắc giang', 'bac giang'], standard: 'Bắc Giang', defaultCity: 'Thành phố Bắc Giang' },
    { names: ['vĩnh phúc', 'vinh phuc', 'vĩnh yên'], standard: 'Vĩnh Phúc', defaultCity: 'Thành phố Vĩnh Yên' },
    { names: ['phú thọ', 'việt trì'], standard: 'Phú Thọ', defaultCity: 'Thành phố Việt Trì' },
    { names: ['thái nguyên', 'thai nguyen'], standard: 'Thái Nguyên', defaultCity: 'Thành phố Thái Nguyên' },
    { names: ['tuyên quang'], standard: 'Tuyên Quang', defaultCity: 'Thành phố Tuyên Quang' },
    { names: ['hà giang'], standard: 'Hà Giang', defaultCity: 'Thành phố Hà Giang' },
    { names: ['cao bằng'], standard: 'Cao Bằng', defaultCity: 'Thành phố Cao Bằng' },
    { names: ['bắc kạn', 'bac kan'], standard: 'Bắc Kạn', defaultCity: 'Thành phố Bắc Kạn' },
    { names: ['lạng sơn', 'lang son'], standard: 'Lạng Sơn', defaultCity: 'Thành phố Lạng Sơn' },
    { names: ['quảng ninh', 'hạ long', 'cẩm phả', 'uông bí'], standard: 'Quảng Ninh', defaultCity: 'Thành phố Hạ Long' },
    { names: ['lào cai'], standard: 'Lào Cai', defaultCity: 'Thành phố Lào Cai' },
    { names: ['yên bái'], standard: 'Yên Bái', defaultCity: 'Thành phố Yên Bái' },
    { names: ['điện biên'], standard: 'Điện Biên', defaultCity: 'Thành phố Điện Biên Phủ' },
    { names: ['lai châu'], standard: 'Lai Châu', defaultCity: 'Thành phố Lai Châu' },
    { names: ['sơn la'], standard: 'Sơn La', defaultCity: 'Thành phố Sơn La' },
    { names: ['hòa bình', 'hoa binh'], standard: 'Hòa Bình', defaultCity: 'Thành phố Hòa Bình' },
];

function smartParseVietnameseAddress(rawAddress: string) {
    if (!rawAddress || !rawAddress.trim()) {
        return { province: '', district: '', ward: '', hamlet: 'Khác', street: '' };
    }

    const clean = rawAddress.trim();
    let province = '';
    let district = '';
    let ward = '';
    let hamlet = '';
    let street = clean;
    let workText = clean;
    let matchedProvItem: any = null;

    const lower = clean.toLowerCase();
    for (const item of VIETNAM_PROVINCES) {
        for (const alias of item.names) {
            const pattern = new RegExp(`(?:tp\\.?|thành phố|tỉnh)?\\s*${alias}(?:\\s*$|[\\,\\.])`, 'i');
            if (pattern.test(lower)) {
                province = item.standard;
                matchedProvItem = item;
                workText = workText.replace(new RegExp(`(?:tp\\.?|thành phố|tỉnh)?\\s*${alias}(?:\\s*$|[\\,\\.])`, 'gi'), '').trim();
                break;
            }
        }
        if (province) break;
    }

    const wardMatch = workText.match(/(?:phường|p\\.|xã|x\\.|thị trấn|tt\\.)\\s+([0-9a-zA-Zà-ỹÀ-Ỹ\\s]+?)(?=\\s+(?:quận|huyện|thị xã|tx\\.|tp\\.|thành phố)|[\\,\\.]|$)/i);
    if (wardMatch) {
        ward = wardMatch[0].trim();
        workText = workText.replace(wardMatch[0], '').trim();
    }

    if (!district) {
        const distMatch = workText.match(/(?:quận|huyện|thị xã|tx\\.|tp\\.|thành phố)\\s+([0-9a-zA-Zà-ỹÀ-Ỹ\\s]+?)(?=[\\,\\.]|$)/i);
        if (distMatch) {
            district = distMatch[0].trim();
            workText = workText.replace(distMatch[0], '').trim();
        }
    }

    // Bóc tách Thôn / Ấp / Xóm / Tổ / Bản / Buôn / Khu phố / Sóc / Đội
    const hamletMatch = workText.match(/(?:thôn|ấp|xóm|tổ|tổ dân phố|khu phố|khóm|bản|buôn|sóc|đội)\\s+([0-9a-zA-Zà-ỹÀ-Ỹ\\s]+?)(?=\\s+(?:phường|p\\.|xã|x\\.|thị trấn|tt\\.|quận|huyện|thị xã|tx\\.|tp\\.|thành phố)|[\\,\\.]|$)/i);
    if (hamletMatch) {
        hamlet = hamletMatch[0].trim();
        workText = workText.replace(hamletMatch[0], '').trim();
    }

    // Xử lý dấu phẩy thông minh
    if ((!province || !district || !ward) && clean.includes(',')) {
        const segments = clean.split(',').map(s => s.trim()).filter(Boolean);
        if (segments.length >= 4) {
            if (!province) province = segments[segments.length - 1];
            if (!district) district = segments[segments.length - 2];
            if (!ward) ward = segments[segments.length - 3];
        } else if (segments.length === 3) {
            if (!province) province = segments[2];
            const middle = segments[1].trim();
            // Nếu đoạn giữa bắt đầu bằng 'phường'/'xã'/'thị trấn', đây là WARD, TUYỆT ĐỐI KHÔNG GÁN VÀO DISTRICT!
            if (/^(?:phường|p\\.|xã|x\\.|thị trấn|tt\\.)/i.test(middle)) {
                if (!ward) ward = middle;
            } else if (/^(?:quận|huyện|thị xã|tx\\.|tp\\.|thành phố)/i.test(middle)) {
                if (!district) district = middle;
            } else {
                if (!district && !ward) district = middle;
            }
        } else if (segments.length === 2) {
            if (!province) province = segments[1];
        }
    }

    // SUY ĐOÁN QUẬN/HUYỆN THÔNG MINH CHO TỈNH:
    // Tại Việt Nam, tất cả các Phường của các Tỉnh đều trực thuộc Thành phố (hoặc Thị xã) của Tỉnh đó!
    if (!district && matchedProvItem?.defaultCity && ward) {
        if (/^(?:phường|p\\.)/i.test(ward.trim())) {
            district = matchedProvItem.defaultCity;
        }
    }

    const splitIndex = clean.search(/(?:thôn|ấp|xóm|tổ|tổ dân phố|khu phố|khóm|bản|buôn|sóc|đội|phường|p\\.|xã|x\\.|thị trấn|tt\\.|quận|huyện|thị xã|tx\\.|tp\\.|thành phố)/i);
    if (splitIndex > 0) {
        street = clean.substring(0, splitIndex).trim().replace(/[\\,\\-\\s]+$/, '').replace(/^[\\,\\-\\s]+/, '').trim();
    } else {
        street = workText.replace(/[\\,\\-\\s]+$/, '').replace(/^[\\,\\-\\s]+/, '').trim();
    }

    // Làm sạch street nếu street còn chứa Phường hoặc Tỉnh:
    if (street && (province || ward)) {
        let cleanStreet = street;
        if (ward) {
            cleanStreet = cleanStreet.replace(new RegExp(`[,\\s]*${ward.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'gi'), '');
        }
        if (province) {
            cleanStreet = cleanStreet.replace(new RegExp(`[,\\s]*(?:tỉnh|tp\\.?|thành phố)?\\s*${province.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'gi'), '');
        }
        cleanStreet = cleanStreet.trim().replace(/^[,\\-\\s]+/, '').replace(/[,\\-\\s]+$/, '');
        if (cleanStreet) {
            street = cleanStreet;
        }
    }

    const capitalize = (str: string) => str ? str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
    const capHamlet = capitalize(hamlet);
    if (!street || street === ',' || street === '-') {
        street = capHamlet || clean;
    }

    return {
        province: province || '',
        district: capitalize(district) || '',
        ward: capitalize(ward) || '',
        hamlet: capHamlet || 'Khác',
        street: street,
    };
}

export function extractAddressString(val: any, fallback = ''): string {
    if (!val) return fallback;
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.name && typeof val.name === 'string') return val.name.trim();
        if (val.title && typeof val.title === 'string') return val.title.trim();
        if (val.address_name && typeof val.address_name === 'string') return val.address_name.trim();
        if (val.address && typeof val.address === 'string') return val.address.trim();
        return fallback;
    }
    return String(val).trim();
}

@Injectable()
export class GhtkService {
    private readonly logger = new Logger(GhtkService.name);

    constructor(
        @InjectRepository(SystemConfig)
        private readonly configRepo: Repository<SystemConfig>,
        @InjectRepository(SalesDelivery)
        private readonly deliveryRepo: Repository<SalesDelivery>,
        @InjectRepository(SalesOrder)
        private readonly orderRepo: Repository<SalesOrder>,
    ) {}

    /**
     * Lấy cấu hình GHTK (ưu tiên bảng system_configs, fallback sang .env)
     */
    async getConfig(): Promise<GhtkConfig> {
        const configs = await this.configRepo.find();
        const configMap = new Map(configs.map(c => [c.key, c.value]));

        const envSandbox = (process.env.GHTK_SANDBOX || '').toLowerCase() === 'true' || (process.env.GHTK_ENVIRONMENT || '').toUpperCase() === 'STAGING';
        const isSandbox = configMap.has('GHTK_SANDBOX')
            ? (configMap.get('GHTK_SANDBOX') || '').toLowerCase() === 'true'
            : envSandbox;

        const defaultUrl = isSandbox ? 'https://services-staging.ghtklab.com' : 'https://services.giaohangtietkiem.vn';

        const apiUrl = configMap.get('GHTK_API_URL') || process.env.GHTK_API_URL || defaultUrl;
        const token = configMap.get('GHTK_TOKEN') || configMap.get('GHTK_API_TOKEN') || process.env.GHTK_TOKEN || process.env.GHTK_API_TOKEN || '';
        const partnerCode = configMap.get('GHTK_PARTNER_CODE') || configMap.get('GHTK_CLIENT_SOURCE') || process.env.GHTK_PARTNER_CODE || process.env.GHTK_CLIENT_SOURCE || '';
        const defaultPickAddressId = configMap.get('GHTK_DEFAULT_PICK_ADDRESS_ID') || process.env.GHTK_DEFAULT_PICK_ADDRESS_ID || '';
        const defaultPickOption = (configMap.get('GHTK_DEFAULT_PICK_OPTION') || process.env.GHTK_DEFAULT_PICK_OPTION || 'cod') as 'cod' | 'post';

        return {
            apiUrl: apiUrl.replace(/\/+$/, ''),
            token,
            partnerCode,
            isSandbox,
            defaultPickAddressId,
            defaultPickOption,
        };
    }

    /**
     * Lưu cấu hình GHTK vào bảng system_config
     */
    async saveConfig(data: {
        token?: string;
        apiUrl?: string;
        isSandbox?: boolean;
        partnerCode?: string;
        defaultPickAddressId?: string;
        defaultPickOption?: 'cod' | 'post';
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

        if (data.token !== undefined) {
            await setConfigValue('GHTK_TOKEN', data.token.trim(), 'Token API Giao Hàng Tiết Kiệm (GHTK)');
        }
        if (data.isSandbox !== undefined) {
            await setConfigValue('GHTK_SANDBOX', data.isSandbox ? 'true' : 'false', 'GHTK Môi trường Sandbox / Staging');
        }
        if (data.apiUrl !== undefined) {
            await setConfigValue('GHTK_API_URL', data.apiUrl.trim(), 'GHTK API Base URL');
        }
        if (data.partnerCode !== undefined) {
            await setConfigValue('GHTK_PARTNER_CODE', data.partnerCode.trim(), 'GHTK Partner Code / Client Source');
        }
        if (data.defaultPickAddressId !== undefined) {
            await setConfigValue('GHTK_DEFAULT_PICK_ADDRESS_ID', data.defaultPickAddressId.trim(), 'Mã điểm lấy hàng mặc định GHTK');
        }
        if (data.defaultPickOption !== undefined) {
            await setConfigValue('GHTK_DEFAULT_PICK_OPTION', data.defaultPickOption.trim(), 'Hình thức gửi hàng mặc định GHTK (cod: Shipper lấy tại kho, post: Giao tại bưu cục/cửa hàng)');
        }

        return { success: true, message: 'Đã lưu cấu hình GHTK thành công' };
    }

    /**
     * Kiểm tra kết nối tới GHTK API
     */
    async testConnection(dto?: { token?: string; apiUrl?: string; isSandbox?: boolean; partnerCode?: string }) {
        const cfg = await this.getConfig();
        const testToken = dto?.token !== undefined ? dto.token.trim() : cfg.token;
        const testIsSandbox = dto?.isSandbox !== undefined ? dto.isSandbox : cfg.isSandbox;
        const defaultUrl = testIsSandbox ? 'https://services-staging.ghtklab.com' : 'https://services.giaohangtietkiem.vn';
        const testApiUrl = (dto?.apiUrl || cfg.apiUrl || defaultUrl).replace(/\/+$/, '');
        const testPartnerCode = dto?.partnerCode !== undefined ? dto.partnerCode.trim() : cfg.partnerCode;

        if (!testToken) {
            return {
                success: false,
                message: 'Chưa có Token API GHTK để kiểm tra',
                isConfigured: false,
            };
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Token': testToken,
        };
        if (testPartnerCode) {
            headers['X-Client-Source'] = testPartnerCode;
        }

        try {
            let pickAddresses: any[] = [];
            let endpointUsed = '/services/shipment/list_pick_add';

            try {
                const res = await axios.get(`${testApiUrl}/services/shipment/list_pick_add`, { headers, timeout: 10000 });
                if (res.data?.success && Array.isArray(res.data?.data)) {
                    pickAddresses = res.data.data;
                }
            } catch (err1: any) {
                endpointUsed = '/open/api/v1/pick-address';
                const res = await axios.get(`${testApiUrl}/open/api/v1/pick-address`, { headers, timeout: 10000 });
                if (res.data?.success && Array.isArray(res.data?.data)) {
                    pickAddresses = res.data.data;
                }
            }

            return {
                success: true,
                message: `Kết nối GHTK thành công! Tài khoản hợp lệ (Tìm thấy ${pickAddresses.length} kho lấy hàng).`,
                isConfigured: true,
                isSandbox: testIsSandbox,
                apiUrl: testApiUrl,
                pickAddresses,
                endpointUsed,
            };
        } catch (error: any) {
            const status = error.response?.status;
            let msg = error.response?.data?.message || error.message;
            if (status === 401 || status === 403) {
                msg = 'Token GHTK không hợp lệ hoặc tài khoản bị khóa quyền API (Mã lỗi HTTP ' + status + ')';
            }
            return {
                success: false,
                message: `Lỗi kết nối GHTK: ${msg}`,
                isConfigured: false,
                statusCode: status,
            };
        }
    }

    private async getHeaders() {
        const cfg = await this.getConfig();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (cfg.token) {
            headers['Token'] = cfg.token;
        }
        if (cfg.partnerCode) {
            headers['X-Client-Source'] = cfg.partnerCode;
        }
        return { headers, cfg };
    }

    /**
     * Bóc tách & Chuẩn hóa địa chỉ cấp 4 qua GHTK API (hoặc fallback Regex)
     */
    async parseAddress(rawAddress: string) {
        if (!rawAddress || !rawAddress.trim()) {
            throw new BadRequestException('Địa chỉ không được để trống');
        }

        const { headers, cfg } = await this.getHeaders();

        // 1. Thử gọi API chuẩn hóa của GHTK nếu có Token
        if (cfg.token) {
            try {
                const url = `${cfg.apiUrl}/open/api/v1/address/parse-address`;
                const res = await axios.get(url, {
                    headers,
                    params: { address: rawAddress },
                    timeout: 8000,
                });

                if (res.data?.success && res.data?.data) {
                    const d = res.data.data;
                    return {
                        success: true,
                        source: 'GHTK_API',
                        province: extractAddressString(d.province || d.city),
                        district: extractAddressString(d.district),
                        ward: extractAddressString(d.ward),
                        hamlet: extractAddressString(d.hamlet, 'Khác'),
                        street: extractAddressString(d.street || d.address, rawAddress),
                        full_address: rawAddress,
                    };
                }
            } catch (err: any) {
                this.logger.warn(`GHTK parseAddress API failed (${err.message}). Fallback to heuristic parser.`);
            }
        }

        // 2. Fallback: Smart Vietnamese Address Parser nội bộ
        const parsed = smartParseVietnameseAddress(rawAddress);
        return {
            success: true,
            source: 'SMART_PARSER',
            province: parsed.province,
            district: parsed.district,
            ward: parsed.ward,
            hamlet: parsed.hamlet || 'Khác',
            street: parsed.street,
            full_address: rawAddress,
        };
    }

    /**
     * Lấy danh sách điểm lấy hàng (Pick Addresses) của Shop trên GHTK
     */
    async getPickAddresses() {
        const { headers, cfg } = await this.getHeaders();
        if (!cfg.token) {
            // Trả về kho mặc định của ERP4U nếu chưa cấu hình Token GHTK
            return [
                {
                    pick_address_id: 'DEFAULT',
                    address: 'Kho Thành Phẩm ERP4U',
                    pick_name: 'ERP4U Warehouse',
                    pick_tel: '0901234567',
                    province: 'Hồ Chí Minh',
                    district: 'Quận 7',
                    ward: 'Phường Tân Phú',
                }
            ];
        }

        try {
            // Thử endpoint chuẩn GHTK: GET /services/shipment/list_pick_add
            try {
                const res = await axios.get(`${cfg.apiUrl}/services/shipment/list_pick_add`, { headers, timeout: 8000 });
                if (res.data?.success && Array.isArray(res.data?.data)) {
                    return res.data.data;
                }
            } catch (err1) {
                // Fallback sang Open API v1
                const res = await axios.get(`${cfg.apiUrl}/open/api/v1/pick-address`, { headers, timeout: 8000 });
                if (res.data?.success && Array.isArray(res.data?.data)) {
                    return res.data.data;
                }
            }
            return [];
        } catch (err: any) {
            this.logger.error(`Error fetching GHTK pick addresses: ${err.message}`);
            return [];
        }
    }

    /**
     * Tính cước vận chuyển dự kiến (Estimate Fee)
     */
    async calculateFee(dto: GhtkFeeDto) {
        const { headers, cfg } = await this.getHeaders();

        // Tự động bóc tách nếu thiếu province hoặc district nhưng có address
        if ((!dto.province || !dto.district) && dto.address) {
            const parsed = smartParseVietnameseAddress(dto.address);
            if (!dto.province && parsed.province) dto.province = parsed.province;
            if (!dto.district && parsed.district) dto.district = parsed.district;
            if (!dto.ward && parsed.ward) dto.ward = parsed.ward;
        }

        if (!cfg.token) {
            // Chế độ mô phỏng khi chưa nhập Token (để kiểm thử UI)
            const baseFee = 25000;
            const extraWeight = Math.max(0, (dto.weight || 500) - 1000);
            const fee = baseFee + Math.ceil(extraWeight / 500) * 5000;
            return {
                success: true,
                fee: {
                    fee,
                    insurance_fee: dto.value && dto.value > 1000000 ? Math.round(dto.value * 0.005) : 0,
                    delivery_type: dto.transport || 'road',
                    name: 'Giao hàng chuẩn (Demo)',
                },
                is_mock: true,
            };
        }

        try {
            const safePickProvince = extractAddressString(dto.pick_province, 'Hồ Chí Minh');
            const safePickDistrict = extractAddressString(dto.pick_district, 'Quận 7');
            const safePickWard = extractAddressString(dto.pick_ward, '');
            const safePickAddress = extractAddressString(dto.pick_address, '');
            const safeProvince = extractAddressString(dto.province);
            const safeDistrict = extractAddressString(dto.district);
            const safeWard = extractAddressString(dto.ward);
            const safeAddress = extractAddressString(dto.address);

            // Tính trọng lượng tính cước: so sánh trọng lượng thực tế và trọng lượng quy đổi thể tích (D x R x C / 6)
            const volumetricWeight = (dto.length && dto.width && dto.height)
                ? Math.round((Number(dto.length) * Number(dto.width) * Number(dto.height)) / 6)
                : 0;
            const effectiveWeight = Math.max(Number(dto.weight) || 500, volumetricWeight);

            // Thử endpoint chuẩn GHTK: GET /services/shipment/fee
            try {
                const queryParams: any = {
                    pick_province: safePickProvince,
                    pick_district: safePickDistrict,
                    pick_ward: safePickWard,
                    pick_address: safePickAddress,
                    province: safeProvince,
                    district: safeDistrict,
                    ward: safeWard,
                    address: safeAddress,
                    weight: effectiveWeight, // gram (lấy giá trị lớn hơn giữa thực tế và quy đổi thể tích)
                    value: Number(dto.value) || 0,
                    transport: dto.transport || 'road',
                    deliver_option: 'none',
                    pick_option: dto.pick_option || 'cod',
                };
                if (dto.pick_address_id) queryParams.pick_address_id = dto.pick_address_id;
                if (dto.length) queryParams.length = Math.round(Number(dto.length));
                if (dto.width) queryParams.width = Math.round(Number(dto.width));
                if (dto.height) queryParams.height = Math.round(Number(dto.height));

                const res = await axios.get(`${cfg.apiUrl}/services/shipment/fee`, { headers, params: queryParams, timeout: 10000 });
                if (res.data?.success && res.data?.fee) {
                    return {
                        success: true,
                        fee: res.data.fee,
                        is_mock: false,
                    };
                }
            } catch (errGet: any) {
                // Fallback POST /open/api/v1/order/fee
                const params: any = {
                    pick_province: safePickProvince,
                    pick_district: safePickDistrict,
                    pick_ward: safePickWard,
                    pick_address: safePickAddress,
                    province: safeProvince,
                    district: safeDistrict,
                    ward: safeWard,
                    address: safeAddress,
                    weight: effectiveWeight,
                    value: Number(dto.value) || 0,
                    transport: dto.transport || 'road',
                    pick_option: dto.pick_option || 'cod',
                };
                if (dto.pick_address_id) params.pick_address_id = dto.pick_address_id;
                if (dto.length) params.length = Math.round(Number(dto.length));
                if (dto.width) params.width = Math.round(Number(dto.width));
                if (dto.height) params.height = Math.round(Number(dto.height));
                const res = await axios.post(`${cfg.apiUrl}/open/api/v1/order/fee`, params, { headers, timeout: 10000 });
                if (res.data?.success && res.data?.fee) {
                    return {
                        success: true,
                        fee: res.data.fee,
                        is_mock: false,
                    };
                }
            }

            throw new BadRequestException('Không thể tính phí vận chuyển GHTK');
        } catch (err: any) {
            this.logger.error(`GHTK Calculate Fee Error: ${err.response?.data?.message || err.message}`);
            throw new BadRequestException(err.response?.data?.message || 'Lỗi khi gọi API tính cước GHTK: ' + err.message);
        }
    }

    /**
     * Đẩy phiếu xuất kho sang GHTK để tạo vận đơn (Submit Express Order)
     */
    async pushDeliveryToGhtk(deliveryId: number, options: {
        pick_address_id?: string;
        pick_option?: 'cod' | 'post';
        pick_station_name?: string;
        pick_name?: string;
        pick_tel?: string;
        pick_address?: string;
        pick_province?: string;
        pick_district?: string;
        pick_ward?: string;
        province?: string;
        district?: string;
        ward?: string;
        hamlet?: string;
        street?: string;
        address?: string;
        note?: string;
        weight_gram?: number;
        pick_money?: number;
        is_freeship?: number;
        transport?: 'road' | 'fly';
        package_length?: number;
        package_width?: number;
        package_height?: number;
        package_count?: number;
        packing_spec_name?: string;
        value?: number;
        force?: boolean;
        products?: Array<{
            name?: string;
            weight?: number;
            quantity?: number;
            product_code?: string;
            price?: number;
        }>;
    }) {
        const delivery = await this.deliveryRepo.findOne({
            where: { id: deliveryId },
            relations: ['sales_order', 'sales_order.items', 'sales_order.items.product', 'items'],
        });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');

        // Cho phép đẩy đè nếu mã hiện tại là mã Demo (GHTK-DEMO-...) hoặc bị hủy hoặc force = true
        const isDemoTracking = delivery.tracking_code?.startsWith('GHTK-DEMO');
        const isCancelled = delivery.shipping_status_id === -1;
        if (delivery.tracking_code && delivery.shipping_carrier === 'GHTK' && !isDemoTracking && !isCancelled && !options.force) {
            throw new BadRequestException(`Phiếu này đã có mã vận đơn GHTK: ${delivery.tracking_code}. Nếu cần tạo lại, hãy hủy vận đơn cũ trước.`);
        }

        const { headers, cfg } = await this.getHeaders();

        // 1. Đồng bộ kích thước kiện và số lượng kiện
        const pkgLength = options.package_length !== undefined && options.package_length !== null
            ? Number(options.package_length)
            : (delivery.package_length !== null && delivery.package_length !== undefined ? Number(delivery.package_length) : null);

        const pkgWidth = options.package_width !== undefined && options.package_width !== null
            ? Number(options.package_width)
            : (delivery.package_width !== null && delivery.package_width !== undefined ? Number(delivery.package_width) : null);

        const pkgHeight = options.package_height !== undefined && options.package_height !== null
            ? Number(options.package_height)
            : (delivery.package_height !== null && delivery.package_height !== undefined ? Number(delivery.package_height) : null);

        const pkgCount = options.package_count !== undefined && options.package_count !== null
            ? Math.max(1, Number(options.package_count))
            : Math.max(1, Number(delivery.package_count) || 1);

        const packingSpec = options.packing_spec_name || delivery.packing_spec_name || '';

        // Cập nhật lại vào delivery record để đồng bộ dữ liệu
        if (pkgLength !== null) delivery.package_length = pkgLength;
        if (pkgWidth !== null) delivery.package_width = pkgWidth;
        if (pkgHeight !== null) delivery.package_height = pkgHeight;
        if (pkgCount) delivery.package_count = pkgCount;
        if (packingSpec) delivery.packing_spec_name = packingSpec;

        const isFreeship = options.is_freeship !== undefined ? options.is_freeship : (delivery.is_freeship !== undefined ? delivery.is_freeship : 1);
        const pickMoney = options.pick_money !== undefined ? options.pick_money : Number(delivery.pick_money || 0);
        const totalWeight = (options.weight_gram || delivery.weight_gram || 500) / 1000; // Đổi gram sang kg

        // 2. Chuẩn bị danh sách sản phẩm thông minh (Hierarchical Products Resolution)
        let products: any[] = [];

        // 2.1. Ưu tiên options.products nếu frontend gửi kèm và có phần tử hợp lệ
        if (options.products && Array.isArray(options.products) && options.products.length > 0) {
            const validOpts = options.products.filter(p => Number(p.quantity) > 0);
            if (validOpts.length > 0) {
                products = validOpts.map((p, idx) => {
                    const soItem = delivery.sales_order?.items?.find((si: any) => si.sku === p.product_code);
                    const name = p.name || soItem?.product?.name || soItem?.product?.customer_description || p.product_code || `Sản phẩm ${idx + 1}`;
                    const weightPerItemKg = p.weight || (options.weight_gram ? (options.weight_gram / 1000) / validOpts.length : (totalWeight / validOpts.length));
                    const unitPrice = p.price !== undefined ? Number(p.price) : (soItem?.unit_price ? Number(soItem.unit_price) : 0);

                    return {
                        name: String(name).slice(0, 250),
                        weight: Math.max(0.01, Math.round(Number(weightPerItemKg) * 100) / 100),
                        quantity: Math.max(1, Math.round(Number(p.quantity))),
                        product_code: p.product_code ? String(p.product_code).slice(0, 100) : undefined,
                        price: Math.round(unitPrice),
                    };
                });
            }
        }

        // 2.2. Nếu chưa có, lấy từ delivery.items
        if (products.length === 0 && delivery.items && delivery.items.length > 0) {
            const validItems = delivery.items.filter((it: any) => Number(it.quantity) > 0);
            if (validItems.length > 0) {
                products = validItems.map((item: any) => {
                    const soItem = delivery.sales_order?.items?.find((si: any) => si.sku === item.sku);
                    const name = soItem?.product?.name || soItem?.product?.customer_description || item.sku;
                    const weightPerItemKg = options.weight_gram 
                        ? ((options.weight_gram / 1000) / validItems.length) 
                        : (delivery.weight_gram ? (delivery.weight_gram / 1000) / validItems.length : (totalWeight / validItems.length));
                    const unitPrice = soItem?.unit_price ? Number(soItem.unit_price) : 0;

                    return {
                        name: String(name).slice(0, 250),
                        weight: Math.max(0.01, Math.round(Number(weightPerItemKg) * 100) / 100),
                        quantity: Math.max(1, Math.round(Number(item.quantity))),
                        product_code: String(item.sku).slice(0, 100),
                        price: Math.round(unitPrice),
                    };
                });
            }
        }

        // 2.3. Nếu delivery.items vẫn rỗng hoặc toàn bộ = 0, fallback sang toàn bộ sản phẩm của đơn hàng bán (delivery.sales_order.items)
        if (products.length === 0 && delivery.sales_order?.items && delivery.sales_order.items.length > 0) {
            const validSoItems = delivery.sales_order.items.filter((si: any) => Number(si.quantity) > 0);
            if (validSoItems.length > 0) {
                products = validSoItems.map((si: any) => {
                    const name = si.product?.name || si.product?.customer_description || si.sku;
                    const weightPerItemKg = options.weight_gram 
                        ? ((options.weight_gram / 1000) / validSoItems.length) 
                        : (delivery.weight_gram ? (delivery.weight_gram / 1000) / validSoItems.length : (totalWeight / validSoItems.length));
                    const unitPrice = si.unit_price ? Number(si.unit_price) : 0;

                    return {
                        name: String(name).slice(0, 250),
                        weight: Math.max(0.01, Math.round(Number(weightPerItemKg) * 100) / 100),
                        quantity: Math.max(1, Math.round(Number(si.quantity))),
                        product_code: String(si.sku).slice(0, 100),
                        price: Math.round(unitPrice),
                    };
                });
            }
        }

        // 2.4. Fallback cuối cùng: tạo 1 sản phẩm đại diện từ mã đơn để GHTK không bao giờ bị 0 sản phẩm
        if (products.length === 0) {
            products = [{
                name: `Hàng hóa theo đơn ${delivery.code}`,
                weight: Math.max(0.1, Math.round(totalWeight * 100) / 100),
                quantity: pkgCount || 1,
                product_code: delivery.code,
                price: Number(delivery.sales_order?.total_amount) || 0,
            }];
        }

        // 3. Tính tổng số tiền sản phẩm của đợt giao hàng này (đẩy vào order.value)
        let deliveryTotalValue = 0;
        if (options.value !== undefined && options.value !== null && Number(options.value) > 0) {
            deliveryTotalValue = Number(options.value);
        } else if (products.length > 0) {
            deliveryTotalValue = products.reduce((sum, p) => sum + ((Number(p.price) || 0) * (Number(p.quantity) || 0)), 0);
        }
        if (deliveryTotalValue <= 0) {
            deliveryTotalValue = Number(delivery.sales_order?.total_amount) || 0;
        }

        // Lấy thông tin kho lấy hàng thực tế từ GHTK
        let pickInfo: any = {};
        try {
            const pickAddresses = await this.getPickAddresses();
            const targetPickId = options.pick_address_id && options.pick_address_id !== 'DEFAULT'
                ? options.pick_address_id
                : cfg.defaultPickAddressId;
            if (targetPickId && Array.isArray(pickAddresses)) {
                pickInfo = pickAddresses.find((p: any) => String(p.pick_address_id) === String(targetPickId) || p.address === targetPickId) || pickAddresses[0] || {};
            } else if (Array.isArray(pickAddresses) && pickAddresses.length > 0) {
                pickInfo = pickAddresses[0] || {};
            }
        } catch (e) {
            // bỏ qua lỗi nếu không lấy được pickAddresses
        }

        // Bóc tách & Chuẩn hóa địa chỉ người nhận (đảm bảo đầy đủ cấp 4 và thôn/ấp cho GHTK)
        const rawRecipientAddress = options.address || delivery.delivery_address || '';
        const parsedRecipient = smartParseVietnameseAddress(rawRecipientAddress);

        let receiverProvince = extractAddressString(options.province || parsedRecipient.province);
        let receiverDistrict = extractAddressString(options.district || parsedRecipient.district);
        let receiverWard = extractAddressString(options.ward || parsedRecipient.ward);
        let receiverHamlet = extractAddressString(options.hamlet || parsedRecipient.hamlet, 'Khác') || 'Khác';
        let receiverStreet = extractAddressString(options.street || parsedRecipient.street, rawRecipientAddress);

        // TỰ ĐỘNG KHẮC PHỤC LỖI NHẬP NHẦM PHƯỜNG VÀO Ô QUẬN/HUYỆN (VD: Nhập 'Phường 8' vào Huyện):
        const distLower = receiverDistrict.toLowerCase().trim();
        const wardLower = receiverWard.toLowerCase().trim();
        if (distLower.startsWith('phường') || distLower.startsWith('p.') || (distLower === wardLower && distLower.length > 0)) {
            const provLower = receiverProvince.toLowerCase();
            const matchedProv = VIETNAM_PROVINCES.find(p => provLower.includes(p.standard.toLowerCase()) || p.names.some(n => provLower.includes(n)));
            if (matchedProv?.defaultCity) {
                this.logger.warn(`Tự động sửa lỗi Quận/Huyện "${receiverDistrict}" thành "${matchedProv.defaultCity}" cho tỉnh ${receiverProvince}`);
                receiverDistrict = matchedProv.defaultCity;
            }
        }

        // TỰ ĐỘNG LÀM SẠCH TÊN ĐƯỜNG: Loại bỏ phần lặp lại của Tỉnh và Phường nếu người dùng dán cả chuỗi dài
        if (receiverStreet) {
            let cleanStr = receiverStreet;
            if (receiverWard) {
                cleanStr = cleanStr.replace(new RegExp(`[,\\s]*${receiverWard.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'gi'), '');
            }
            if (receiverProvince) {
                cleanStr = cleanStr.replace(new RegExp(`[,\\s]*(?:tỉnh|tp\\.?|thành phố)?\\s*${receiverProvince.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'gi'), '');
            }
            cleanStr = cleanStr.replace(/[,\\s]*(?:tỉnh|tp\\.?|thành phố)?\\s*(?:vĩnh long|bến tre|hồ chí minh|hà nội|đà nẵng|bình dương|đồng nai|long an|tiền giang|cần thơ)/gi, '');
            cleanStr = cleanStr.trim().replace(/^[,\\-\\s]+/, '').replace(/[,\\-\\s]+$/, '');
            if (cleanStr && cleanStr.length >= 2) {
                receiverStreet = cleanStr;
            }
        }

        // 4. Xây dựng ghi chú rõ ràng về kiện hàng và kích thước
        let packageNoteSnippet = '';
        if (pkgLength || pkgWidth || pkgHeight || pkgCount > 1 || packingSpec) {
            const dimText = (pkgLength && pkgWidth && pkgHeight) ? `${pkgLength}x${pkgWidth}x${pkgHeight}cm` : '';
            const parts: string[] = [];
            if (pkgCount) parts.push(`${pkgCount} kiện`);
            if (dimText) parts.push(dimText);
            if (packingSpec) parts.push(packingSpec);
            packageNoteSnippet = `[Đóng gói: ${parts.join(' - ')}]`;
        }

        const pickOption: 'cod' | 'post' = options.pick_option || 'cod';
        const isPost = pickOption === 'post';

        const baseNote = options.note || delivery.note || 'Cho xem hàng không cho thử';
        let postSnippet = isPost ? '[Gửi tại bưu cục GHTK]' : '';
        const combinedSnippets = [packageNoteSnippet, postSnippet].filter(Boolean).join(' ');
        const finalNote = combinedSnippets 
            ? `${baseNote} ${combinedSnippets}`.trim()
            : baseNote;

        // Tags cho GHTK
        const tags: number[] = [10]; // 10: Cho xem hàng
        // Tag 81: BBS Eco (hàng cồng kềnh) nếu kích thước > 100cm hoặc khối lượng > 20kg hoặc quy cách BBS
        const isBbs = totalWeight > 20 || (pkgLength && pkgLength > 100) || (pkgWidth && pkgWidth > 100) || (pkgHeight && pkgHeight > 100) || (packingSpec && packingSpec.toUpperCase().includes('BBS'));
        if (isBbs) {
            tags.push(81);
        }

        const payload: any = {
            products,
            order: {
                id: delivery.code, // Mã phiếu xuất kho làm partner_id
                pick_name: options.pick_name || pickInfo.pick_name || 'NỆM MẦM NON ERP4U',
                pick_money: pickMoney,
                pick_address: options.pick_address || pickInfo.address || 'Kho ERP4U',
                pick_province: options.pick_province || pickInfo.province || 'TP Hồ Chí Minh',
                pick_district: options.pick_district || pickInfo.district || 'TP. Thủ Đức',
                pick_ward: options.pick_ward || pickInfo.ward || 'Phường Bình Trưng Tây',
                pick_tel: options.pick_tel || pickInfo.pick_tel || '0931431128',
                name: delivery.contact_name || delivery.sales_order?.receiver_name || 'Khách hàng',
                address: receiverStreet,
                province: receiverProvince,
                district: receiverDistrict,
                ward: receiverWard,
                hamlet: receiverHamlet, // BẮT BUỘC cho GHTK API (nếu không có thôn/ấp thì gửi 'Khác')
                tel: delivery.contact_phone || delivery.sales_order?.receiver_phone || '',
                note: finalNote,
                is_freeship: isFreeship,
                total_weight: totalWeight,
                value: Math.round(deliveryTotalValue), // Tổng giá trị sản phẩm của đợt giao hàng này
                transport: options.transport || 'road',
                tags,
                pick_option: pickOption,
            }
        };

        // Bổ sung thông tin kích thước kiện và số kiện vào order payload
        if (pkgLength) {
            payload.order.length = Math.round(pkgLength);
            payload.order.package_length = Math.round(pkgLength);
        }
        if (pkgWidth) {
            payload.order.width = Math.round(pkgWidth);
            payload.order.package_width = Math.round(pkgWidth);
        }
        if (pkgHeight) {
            payload.order.height = Math.round(pkgHeight);
            payload.order.package_height = Math.round(pkgHeight);
        }
        if (pkgCount) {
            payload.order.package_count = pkgCount;
            payload.order.parcel_count = pkgCount;
            payload.order.total_package = pkgCount;
        }

        if (pickInfo.pick_address_id) {
            payload.order.pick_address_id = String(pickInfo.pick_address_id);
        } else if (options.pick_address_id && options.pick_address_id !== 'DEFAULT') {
            payload.order.pick_address_id = options.pick_address_id;
        } else if (cfg.defaultPickAddressId && cfg.defaultPickAddressId !== 'admin') {
            payload.order.pick_address_id = cfg.defaultPickAddressId;
        }

        // Nếu chưa cấu hình Token: Chế độ Sandbox Simulation
        if (!cfg.token) {
            const mockTrackingCode = `GHTK-DEMO-${Date.now().toString().slice(-6)}`;
            delivery.shipping_carrier = 'GHTK';
            delivery.shipping_provider = 'GHTK';
            delivery.tracking_code = mockTrackingCode;
            delivery.shipping_cost = 25000;
            delivery.pick_money = pickMoney;
            delivery.is_freeship = isFreeship;
            delivery.weight_gram = options.weight_gram || delivery.weight_gram || 500;
            delivery.shipping_status_id = 2; // Chờ lấy hàng / chờ gửi hàng
            delivery.shipping_status_text = isPost ? 'Chờ gửi hàng tại bưu cục GHTK (Mô phỏng)' : 'Tiếp nhận đơn hàng (Mô phỏng)';
            delivery.shipping_metadata = {
                is_mock: true,
                pick_option: pickOption,
                pick_station_name: options.pick_station_name,
                created_at: new Date().toISOString(),
                payload,
            };
            await this.deliveryRepo.save(delivery);
            return {
                success: true,
                tracking_code: mockTrackingCode,
                fee: 25000,
                status: isPost ? 'Chờ gửi tại bưu cục' : 'Chờ lấy hàng',
                is_mock: true,
                message: `Đã tạo vận đơn GHTK mô phỏng [${isPost ? 'Gửi tại bưu cục' : 'Shipper lấy tại kho'}] (do chưa cấu hình Token API GHTK)`,
            };
        }

        try {
            let res: any;
            try {
                // Endpoint chuẩn GHTK: POST /services/shipment/order
                res = await axios.post(`${cfg.apiUrl}/services/shipment/order`, payload, { headers, timeout: 15000 });
            } catch (errOrder: any) {
                if (errOrder.response?.status === 404) {
                    // Fallback sang /open/api/v1/order/sync
                    res = await axios.post(`${cfg.apiUrl}/open/api/v1/order/sync`, payload, { headers, timeout: 15000 });
                } else if (errOrder.response?.data?.code === 'ORDER_ID_EXIST' || errOrder.response?.data?.message?.includes('tồn tại')) {
                    // Trùng mã partner id: Thêm hậu tố timestamp ngắn và gửi lại
                    payload.order.id = `${delivery.code}-${Date.now().toString().slice(-4)}`;
                    res = await axios.post(`${cfg.apiUrl}/services/shipment/order`, payload, { headers, timeout: 15000 });
                } else {
                    throw errOrder;
                }
            }

            if (res.data?.success && res.data?.order) {
                const ghtkOrder = res.data.order;
                const finalTrackingCode = ghtkOrder.label || ghtkOrder.label_id || ghtkOrder.tracking_id;
                delivery.shipping_carrier = 'GHTK';
                delivery.shipping_provider = 'GHTK';
                delivery.tracking_code = finalTrackingCode;
                delivery.shipping_cost = Number(ghtkOrder.fee) || delivery.shipping_cost;
                delivery.pick_money = pickMoney;
                delivery.is_freeship = isFreeship;
                delivery.weight_gram = options.weight_gram || delivery.weight_gram || 500;
                delivery.shipping_status_id = 2; // Chờ lấy hàng / chờ gửi hàng
                delivery.shipping_status_text = isPost ? 'Chờ gửi hàng tại bưu cục GHTK' : 'Chờ lấy hàng';
                delivery.shipping_metadata = {
                    ...res.data,
                    is_mock: false,
                    pick_option: pickOption,
                    pick_station_name: options.pick_station_name,
                    pushed_at: new Date().toISOString(),
                };

                await this.deliveryRepo.save(delivery);

                return {
                    success: true,
                    tracking_code: delivery.tracking_code,
                    fee: delivery.shipping_cost,
                    estimated_deliver_time: ghtkOrder.estimated_deliver_time,
                    message: `Đẩy đơn sang GHTK thành công! Mã vận đơn: ${delivery.tracking_code}`,
                };
            }

            throw new BadRequestException(res.data?.message || 'GHTK từ chối tiếp nhận đơn hàng');
        } catch (err: any) {
            this.logger.error(`Error pushing to GHTK: ${err.response?.data?.message || err.message}`);
            throw new BadRequestException(err.response?.data?.message || 'Lỗi khi tạo vận đơn GHTK: ' + err.message);
        }
    }

    /**
     * Hủy vận đơn GHTK
     */
    async cancelGhtkOrder(deliveryId: number) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');

        if (!delivery.tracking_code) {
            throw new BadRequestException('Phiếu này chưa có mã vận đơn để hủy');
        }

        const { headers, cfg } = await this.getHeaders();

        if (!cfg.token || delivery.tracking_code.startsWith('GHTK-DEMO')) {
            delivery.shipping_status_id = -1;
            delivery.shipping_status_text = 'Đã hủy đơn GHTK (Mô phỏng)';
            await this.deliveryRepo.save(delivery);
            return { success: true, message: 'Đã hủy đơn GHTK mô phỏng' };
        }

        try {
            let res: any;
            try {
                // Endpoint chuẩn: POST /services/shipment/cancel/{tracking_code}
                res = await axios.post(`${cfg.apiUrl}/services/shipment/cancel/${delivery.tracking_code}`, {}, { headers, timeout: 10000 });
            } catch (e1) {
                // Fallback: POST /open/api/v1/order/cancel/{tracking_code}
                res = await axios.post(`${cfg.apiUrl}/open/api/v1/order/cancel/${delivery.tracking_code}`, {}, { headers, timeout: 10000 });
            }

            if (res.data?.success) {
                delivery.shipping_status_id = -1;
                delivery.shipping_status_text = 'Đã hủy đơn GHTK';
                await this.deliveryRepo.save(delivery);
                return { success: true, message: res.data?.message || 'Hủy vận đơn GHTK thành công' };
            }
            throw new BadRequestException(res.data?.message || 'Không thể hủy đơn GHTK');
        } catch (err: any) {
            throw new BadRequestException(err.response?.data?.message || 'Lỗi khi hủy đơn GHTK: ' + err.message);
        }
    }

    /**
     * Lấy link in nhãn vận đơn GHTK (trả về URL endpoint nội bộ proxy PDF có đính kèm token xác thực)
     */
    async getLabelUrl(deliveryId: number, pageSize: string = 'A6') {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');
        if (!delivery.tracking_code) throw new BadRequestException('Phiếu xuất kho chưa có mã vận đơn');

        // Trả về URL proxy nội bộ của ERP (đã tự động đính kèm Token GHTK bí mật)
        return `/api/shipping/delivery/${deliveryId}/print-label?pageSize=${pageSize}`;
    }

    /**
     * Lấy dữ liệu buffer PDF nhãn in vận đơn GHTK với Token bí mật
     */
    async getLabelBuffer(deliveryId: number, pageSize: string = 'A6'): Promise<{
        buffer: Buffer;
        contentType: string;
        filename: string;
        isHtml?: boolean;
    }> {
        const delivery = await this.deliveryRepo.findOne({
            where: { id: deliveryId },
            relations: ['sales_order', 'sales_order.customer', 'items'],
        });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');
        if (!delivery.tracking_code) throw new BadRequestException('Phiếu xuất kho chưa có mã vận đơn');

        const { headers, cfg } = await this.getHeaders();
        const trackingCode = delivery.tracking_code;

        // Nếu là đơn hàng chạy mô phỏng (demo) hoặc chưa cấu hình Token GHTK
        if (!cfg.token || trackingCode.startsWith('GHTK-DEMO')) {
            const html = this.renderDemoLabelHtml(delivery, pageSize);
            return {
                buffer: Buffer.from(html, 'utf8'),
                contentType: 'text/html; charset=utf-8',
                filename: `GHTK_${trackingCode}_${pageSize}.html`,
                isHtml: true,
            };
        }

        // Gọi GHTK API tải PDF nhãn in với HTTP Header Token bí mật
        const url = `${cfg.apiUrl}/services/label/${trackingCode}?pageSize=${pageSize}`;
        try {
            const res = await axios.get(url, {
                headers,
                responseType: 'arraybuffer',
                timeout: 20000,
            });

            const buffer = Buffer.from(res.data);
            // Kiểm tra xem dữ liệu có phải là file PDF thật (%PDF ở đầu file)
            if (buffer.length >= 4 && buffer.slice(0, 4).toString() === '%PDF') {
                return {
                    buffer,
                    contentType: 'application/pdf',
                    filename: `GHTK_${trackingCode}_${pageSize}.pdf`,
                    isHtml: false,
                };
            }

            // Nếu GHTK trả về chuỗi JSON lỗi (ví dụ mã lỗi token hoặc không tìm thấy đơn)
            const text = buffer.toString('utf8');
            let errMsg = 'GHTK không trả về file PDF hợp lệ';
            try {
                const json = JSON.parse(text);
                if (json.message) errMsg = json.message;
            } catch {
                if (text && text.length < 200) errMsg = text;
            }
            throw new BadRequestException(errMsg);
        } catch (err: any) {
            if (err instanceof BadRequestException || err instanceof NotFoundException) {
                throw err;
            }
            let errMsg = err.message;
            if (err.response?.data) {
                try {
                    const str = Buffer.isBuffer(err.response.data)
                        ? err.response.data.toString('utf8')
                        : JSON.stringify(err.response.data);
                    const json = JSON.parse(str);
                    if (json.message) errMsg = json.message;
                } catch {
                    if (typeof err.response.data === 'string') errMsg = err.response.data;
                }
            }
            throw new BadRequestException(`Không thể tải nhãn từ GHTK: ${errMsg}`);
        }
    }

    /**
     * Tạo nhãn in HTML mô phỏng A6 khi chạy demo hoặc chưa có token GHTK
     */
    renderDemoLabelHtml(delivery: SalesDelivery, pageSize: string = 'A6'): string {
        const so = delivery.sales_order;
        const customer = so?.customer;
        const items = delivery.items || [];
        const trackingCode = delivery.tracking_code || 'GHTK-DEMO';
        const receiverName = delivery.contact_name || so?.receiver_name || customer?.name || 'Khách hàng';
        const receiverPhone = delivery.contact_phone || so?.receiver_phone || customer?.phone || '';
        const receiverAddress = delivery.delivery_address || customer?.address || so?.shipping_address || '';
        const codAmount = Number(delivery.pick_money) || 0;
        const weightGram = delivery.weight_gram || 500;

        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Nhãn vận đơn GHTK - ${trackingCode}</title>
    <style>
        @page { size: ${pageSize === '80x103' ? '80mm 103mm' : 'A6'}; margin: 4mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 10px; font-size: 13px; color: #000; background: #fff; }
        .label-container { border: 2px solid #000; padding: 8px; width: 100%; max-width: ${pageSize === '80x103' ? '80mm' : '105mm'}; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px; }
        .logo { font-size: 18px; font-weight: 900; color: #008444; }
        .sub-logo { font-size: 10px; color: #555; }
        .barcode-box { text-align: center; border-bottom: 2px dashed #000; padding: 8px 0; margin-bottom: 8px; }
        .barcode-bars { font-family: 'Courier New', monospace; font-size: 24px; letter-spacing: 4px; font-weight: bold; }
        .barcode-text { font-family: monospace; font-size: 16px; font-weight: 700; margin-top: 4px; }
        .section { border-bottom: 1px solid #000; padding: 6px 0; }
        .bold { font-weight: bold; }
        .cod-box { background: #f0f0f0; border: 2px solid #000; padding: 6px; text-align: center; margin: 6px 0; font-size: 14px; }
        .cod-amount { font-size: 18px; font-weight: 900; color: #d90429; }
        .items-list { font-size: 11px; margin-top: 4px; }
        .footer { font-size: 10px; text-align: center; margin-top: 6px; color: #555; }
        @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 12px; text-align: center;">
        <button onclick="window.print()" style="background:#008444;color:#fff;border:none;padding:8px 18px;font-size:14px;border-radius:4px;cursor:pointer;font-weight:bold;">🖨️ In nhãn ngay</button>
        <span style="margin-left: 10px; color: #666; font-size: 12px;">(Nhãn mô phỏng dành cho đơn chạy thử nghiệm)</span>
    </div>
    <div class="label-container">
        <div class="header">
            <div>
                <div class="logo">GHTK</div>
                <div class="sub-logo">GIAO HÀNG TIẾT KIỆM</div>
            </div>
            <div style="text-align: right;">
                <div class="bold" style="font-size: 14px;">BƯU KIỆN ${pageSize}</div>
                <div style="font-size: 11px;">KL: ${weightGram}g</div>
            </div>
        </div>
        <div class="barcode-box">
            <div class="barcode-bars">||||| | |||| ||| |||| | ||</div>
            <div class="barcode-text">${trackingCode}</div>
        </div>
        <div class="section">
            <div class="bold">NGƯỜI GỬI:</div>
            <div>ERP4U - KHO VẬN HÀNG HÓA</div>
            <div>PXK: <span class="bold">${delivery.code}</span> | ĐH: <span class="bold">${so?.order_code || ''}</span></div>
        </div>
        <div class="section">
            <div class="bold">NGƯỜI NHẬN:</div>
            <div class="bold" style="font-size: 14px;">${receiverName} - ${receiverPhone}</div>
            <div style="margin-top: 2px;">${receiverAddress}</div>
        </div>
        <div class="cod-box">
            <div>TIỀN THU NGƯỜI NHẬN (COD):</div>
            <div class="cod-amount">${codAmount > 0 ? codAmount.toLocaleString('vi-VN') + ' đ' : 'KHÔNG THU TIỀN (0 đ)'}</div>
            <div style="font-size: 11px; margin-top: 2px;">Cước phí: ${delivery.is_freeship ? 'Shop trả cước' : 'Khách trả cước'}</div>
        </div>
        <div class="section">
            <div class="bold">NỘI DUNG HÀNG HÓA (${items.length} mặt hàng):</div>
            <div class="items-list">
                ${items.map(it => `• ${it.sku} (x${it.quantity})`).join('<br>')}
            </div>
        </div>
        <div class="section" style="border-bottom: none;">
            <div class="bold">GHI CHÚ:</div>
            <div>${delivery.note || 'Cho xem hàng, không cho thử.'}</div>
        </div>
        <div class="footer">
            ERP4U System • Ngày in: ${new Date().toLocaleDateString('vi-VN')}
        </div>
    </div>
    <script>
        window.addEventListener('load', () => {
            setTimeout(() => { window.print(); }, 500);
        });
    </script>
</body>
</html>`;
    }

    /**
     * Trang HTML thông báo lỗi thân thiện khi không tải được nhãn GHTK
     */
    renderErrorHtml(trackingCode: string, message: string): string {
        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lỗi in nhãn GHTK - ${trackingCode}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f1f5f9;
            color: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }
        .error-card {
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            max-width: 480px;
            width: 100%;
            padding: 32px;
            text-align: center;
        }
        .icon-box {
            width: 64px;
            height: 64px;
            background: #fee2e2;
            color: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 20px;
        }
        h2 {
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 12px;
            color: #0f172a;
        }
        .tracking-badge {
            display: inline-block;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 6px 14px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 14px;
            font-weight: 600;
            color: #008444;
            margin-bottom: 16px;
        }
        .msg {
            font-size: 14px;
            line-height: 1.6;
            color: #64748b;
            margin-bottom: 24px;
        }
        .btn {
            display: inline-block;
            background: #008444;
            color: #ffffff;
            padding: 10px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: background 0.2s;
        }
        .btn:hover {
            background: #006835;
        }
    </style>
</head>
<body>
    <div class="error-card">
        <div class="icon-box">⚠️</div>
        <h2>Không thể tải nhãn in GHTK</h2>
        <div class="tracking-badge">${trackingCode || 'Chưa có mã vận đơn'}</div>
        <div class="msg">${message || 'Đã có lỗi xảy ra khi yêu cầu nhãn in từ hãng GHTK'}</div>
        <button class="btn" onclick="window.close()">Đóng tab này</button>
    </div>
</body>
</html>`;
    }

    /**
     * Tra cứu trạng thái hành trình vận đơn
     */
    async getTracking(deliveryId: number) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');
        if (!delivery.tracking_code) {
            return {
                success: false,
                message: 'Phiếu chưa có mã vận đơn',
                status_text: delivery.shipping_status_text || 'Chờ xuất kho',
                timeline: []
            };
        }

        const { headers, cfg } = await this.getHeaders();

        if (!cfg.token || delivery.tracking_code.startsWith('GHTK-DEMO')) {
            return {
                success: true,
                tracking_code: delivery.tracking_code,
                status_text: delivery.shipping_status_text || 'Chờ lấy hàng',
                timeline: [
                    { time: new Date().toISOString(), status: 'Tiếp nhận đơn hàng thành công' },
                    { time: new Date().toISOString(), status: 'Đang điều phối Shipper lấy hàng' },
                ],
                is_mock: true,
            };
        }

        try {
            // Thử endpoint v2 trước (chuẩn API GHTK)
            let res: any;
            try {
                const v2Url = `${cfg.apiUrl}/services/shipment/v2/${delivery.tracking_code}`;
                res = await axios.get(v2Url, { headers, timeout: 8000 });
            } catch (v2Err) {
                // Fallback qua open api
                const openUrl = `${cfg.apiUrl}/open/api/v1/order/tracking/${delivery.tracking_code}`;
                res = await axios.get(openUrl, { headers, timeout: 8000 });
            }

            const data = res.data;
            const orderInfo = data?.order || data?.data;
            if (orderInfo) {
                const statusId = orderInfo.status !== undefined ? Number(orderInfo.status) : undefined;
                const statusText = orderInfo.status_text || (statusId !== undefined ? this.mapStatusIdToText(statusId) : undefined) || orderInfo.message;
                if (statusText) {
                    delivery.shipping_status_text = statusText;
                }
                if (statusId !== undefined && !isNaN(statusId)) {
                    delivery.shipping_status_id = statusId;
                }
                if (statusId === 5 || statusId === 6) {
                    delivery.status = 'SHIPPED';
                }
                await this.deliveryRepo.save(delivery);
            }

            return data;
        } catch (err: any) {
            return {
                success: true,
                tracking_code: delivery.tracking_code,
                status_text: delivery.shipping_status_text || 'Chờ lấy hàng',
                timeline: [
                    { time: new Date().toISOString(), status: delivery.shipping_status_text || 'Đang cập nhật từ GHTK' }
                ],
                message: err.response?.data?.message || err.message,
                is_mock: true
            };
        }
    }

    /**
     * Đồng bộ trạng thái từ GHTK vào phiếu xuất kho
     */
    async syncDeliveryStatus(deliveryId: number) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery) {
            return { success: false, message: `Không tìm thấy phiếu xuất kho #${deliveryId}` };
        }
        if (!delivery.tracking_code) {
            return { success: false, message: 'Phiếu xuất kho này chưa có mã vận đơn GHTK để đồng bộ' };
        }

        const tracking = await this.getTracking(deliveryId);
        const updated = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        return {
            success: true,
            message: `Đã đồng bộ GHTK: ${updated?.shipping_status_text || 'Cập nhật thành công'}`,
            status: updated?.shipping_status_text,
            tracking
        };
    }

    /**
     * Xử lý Webhook callback trạng thái từ GHTK
     */
    async handleWebhook(body: any) {
        this.logger.log(`Received GHTK Webhook: ${JSON.stringify(body)}`);
        const labelId = body.label_id || body.tracking_id;
        if (!labelId) return { success: false, message: 'Missing label_id' };

        const delivery = await this.deliveryRepo.findOne({ where: { tracking_code: labelId } });
        if (!delivery) {
            this.logger.warn(`No delivery found for tracking code: ${labelId}`);
            return { success: false, message: 'Delivery not found' };
        }

        const statusId = Number(body.status_id);
        delivery.shipping_status_id = statusId;
        delivery.shipping_status_text = body.status_text || this.mapStatusIdToText(statusId);
        delivery.shipping_metadata = {
            ...(delivery.shipping_metadata || {}),
            last_webhook: body,
            updated_at: new Date().toISOString(),
        };

        // Nếu GHTK đã giao hàng thành công (status_id = 5 hoặc 6)
        if (statusId === 5 || statusId === 6) {
            delivery.status = 'SHIPPED';
        }

        await this.deliveryRepo.save(delivery);
        return { success: true };
    }

    private mapStatusIdToText(statusId: number): string {
        const map: Record<number, string> = {
            [-1]: 'Hủy đơn hàng',
            1: 'Chưa tiếp nhận',
            2: 'Đã tiếp nhận',
            3: 'Đã lấy hàng/Đã nhập kho',
            4: 'Đang giao hàng',
            5: 'Đã giao hàng/Chưa đối soát',
            6: 'Đã đối soát',
            7: 'Không lấy được hàng',
            8: 'Hoãn lấy hàng',
            9: 'Không giao được hàng',
            10: 'Delay giao hàng',
            11: 'Đã đối soát công nợ trả hàng',
            12: 'Đang lấy hàng',
            13: 'Đơn hàng bồi hoàn',
            20: 'Đang trả hàng',
            21: 'Đã trả hàng',
        };
        return map[statusId] || `Trạng thái (${statusId})`;
    }
}

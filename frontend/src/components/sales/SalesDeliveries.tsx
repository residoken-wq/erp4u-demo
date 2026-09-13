import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, message, InputNumber, Tooltip, Select, DatePicker, Tag, Alert, Checkbox, Radio, Divider, Spin, Dropdown, Space, Badge } from 'antd';
import { 
    CarOutlined, CheckCircleOutlined, PrinterOutlined, MailOutlined, EditOutlined, 
    UploadOutlined, DeleteOutlined, AppstoreOutlined, ThunderboltOutlined, 
    CompassOutlined, FilePdfOutlined, HistoryOutlined, CloseCircleOutlined, 
    SendOutlined, CalculatorOutlined, InfoCircleOutlined, SettingOutlined,
    InboxOutlined, WarningOutlined, MessageOutlined, CopyOutlined, FileTextOutlined,
    MoreOutlined, PlusOutlined, ArrowRightOutlined, SyncOutlined,
    PictureOutlined, GlobalOutlined, DollarOutlined, EyeOutlined
} from '@ant-design/icons';
import api from '../../utils/api';
import { API_URL } from '../../config';
import dayjs from 'dayjs';
import AttachmentUpload from '../common/AttachmentUpload';
import { parseWebsiteOrderNote, ParsedShippingInfo, smartParseVietnameseAddress, VIETNAM_PROVINCES } from '../../utils/orderNoteParser';
import { 
    DEFAULT_DELIVERY_NOTICE_TEMPLATES, 
    DeliveryNoticeTemplate, 
    formatDeliveryNotice,
    ShippingLeg
} from '../../utils/deliveryNoticeHelper';

const extractAddressString = (val: any, fallback = ''): string => {
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
};

export const LALAMOVE_VEHICLES = [
    { key: 'MOTORCYCLE', name: 'Xe máy', icon: '🛵', desc: 'Nhỏ gọn < 30kg' },
    { key: 'VAN_500KG', name: 'Bán tải 500kg (Van)', icon: '🚐', desc: 'Khuyên dùng: 20-40 nệm, che mưa' },
    { key: 'VAN_1000KG', name: 'Bán tải 1T (Van)', icon: '🚐', desc: '50-80 nệm hoặc combo bàn ghế' },
    { key: 'TRUCK_1000KG', name: 'Xe tải 1 tấn', icon: '🚚', desc: 'Dự án trường, hàng lớn' },
    { key: 'TRUCK_1500KG', name: 'Xe tải 1.5 tấn', icon: '🚚', desc: 'Giao sỉ ra Chành xe Bến xe' },
    { key: 'TRUCK_2000KG', name: 'Xe tải 2 tấn', icon: '🚛', desc: 'Đơn trường mầm non lớn' },
];

export const getRecommendedLalamoveVehicle = (weightGram?: number, len?: number | null, wid?: number | null, hei?: number | null) => {
    const weightKg = (weightGram || 0) / 1000;
    const maxDim = Math.max(len || 0, wid || 0, hei || 0);
    if (weightKg > 1500) return 'TRUCK_2000KG';
    if (weightKg > 1000) return 'TRUCK_1500KG';
    if (weightKg > 500) return 'TRUCK_1000KG';
    if (weightKg > 30 || maxDim > 50) return 'VAN_500KG';
    return 'MOTORCYCLE';
};

interface Props {
    order: any;
    products: any[];
    customers?: any[];
    onSuccess: () => void;
}

const SalesDeliveries: React.FC<Props> = ({ order, products, customers = [], onSuccess }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [shipNote, setShipNote] = useState('');
    const [shipItems, setShipItems] = useState<any[]>([]);
    const [editingDeliveryId, setEditingDeliveryId] = useState<number | null>(null);
    const [shipStatus, setShipStatus] = useState<string>('PENDING_EXPORT');
    const [isDraft, setIsDraft] = useState<boolean>(false);

    // Additional Ship Info state
    const [shipDate, setShipDate] = useState<any>(dayjs());
    const [shipAddress, setShipAddress] = useState<string>('');
    const [shipContactName, setShipContactName] = useState<string>('');
    const [shipContactPhone, setShipContactPhone] = useState<string>('');
    const [companyConfig, setCompanyConfig] = useState<any>(null);
    const [attachments, setAttachments] = useState<string[]>([]);

    // Quick Upload State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadDeliveryId, setUploadDeliveryId] = useState<number | null>(null);
    const [uploadAttachments, setUploadAttachments] = useState<string[]>([]);

    // Shipping Carrier State
    const [shippingCarrier, setShippingCarrier] = useState<string>('');
    const [trackingCode, setTrackingCode] = useState<string>('');
    const [shippingCost, setShippingCost] = useState<number>(0);
    const [carriers, setCarriers] = useState<any[]>([]);

    // GHTK & Website Shipping state
    const [websiteOrderParsed, setWebsiteOrderParsed] = useState<ParsedShippingInfo | null>(null);
    const [pickMoney, setPickMoney] = useState<number>(0);
    const [isCod, setIsCod] = useState<boolean>(false);
    const [isFreeship, setIsFreeship] = useState<number>(1); // 1: Shop trả cước, 0: Khách trả
    const [packageWeight, setPackageWeight] = useState<number>(500); // grams
    // Packing Specs & Dimensions state
    const [packingSpecs, setPackingSpecs] = useState<any[]>([]);
    const [selectedPackingSpecId, setSelectedPackingSpecId] = useState<number | null>(null);
    const [packageLength, setPackageLength] = useState<number | null>(null);
    const [packageWidth, setPackageWidth] = useState<number | null>(null);
    const [packageHeight, setPackageHeight] = useState<number | null>(null);
    const [packageCount, setPackageCount] = useState<number>(1);
    const [packingSpecName, setPackingSpecName] = useState<string>('');
    const [packageActualWeight, setPackageActualWeight] = useState<number | null>(null);
    const [pushToGhtkDirectly, setPushToGhtkDirectly] = useState<boolean>(true);
    const [ghtkPickAddresses, setGhtkPickAddresses] = useState<any[]>([]);
    const [selectedPickAddressId, setSelectedPickAddressId] = useState<string>('');
    const [ghtkPickOption, setGhtkPickOption] = useState<'cod' | 'post'>('cod');
    const [ghtkProvince, setGhtkProvince] = useState<string>('');
    const [ghtkDistrict, setGhtkDistrict] = useState<string>('');
    const [ghtkWard, setGhtkWard] = useState<string>('');
    const [ghtkHamlet, setGhtkHamlet] = useState<string>('Khác');
    const [ghtkAddress, setGhtkAddress] = useState<string>('');
    const [ghtkParseLoading, setGhtkParseLoading] = useState<boolean>(false);
    const [ghtkEstimateLoading, setGhtkEstimateLoading] = useState<boolean>(false);
    const [estimatedFeeInfo, setEstimatedFeeInfo] = useState<any>(null);

    // Tracking Modal State
    const [trackingModalOpen, setTrackingModalOpen] = useState<boolean>(false);
    const [trackingLoading, setTrackingLoading] = useState<boolean>(false);
    const [trackingDelivery, setTrackingDelivery] = useState<any>(null);
    const [trackingData, setTrackingData] = useState<any>(null);

    // GHTK Config State
    const [ghtkConfig, setGhtkConfig] = useState<any>({ isConfigured: false, apiUrl: '', isSandbox: false });
    const [ghtkConfigModalOpen, setGhtkConfigModalOpen] = useState<boolean>(false);
    const [ghtkTokenInput, setGhtkTokenInput] = useState<string>('');
    const [ghtkIsSandboxInput, setGhtkIsSandboxInput] = useState<boolean>(false);
    const [ghtkPartnerCodeInput, setGhtkPartnerCodeInput] = useState<string>('');
    const [ghtkDefaultPickAddressInput, setGhtkDefaultPickAddressInput] = useState<string>('');
    const [ghtkDefaultPickOptionInput, setGhtkDefaultPickOptionInput] = useState<'cod' | 'post'>('cod');
    const [ghtkTestLoading, setGhtkTestLoading] = useState<boolean>(false);
    const [ghtkSaveLoading, setGhtkSaveLoading] = useState<boolean>(false);
    const [ghtkTestResult, setGhtkTestResult] = useState<any>(null);

    // Lalamove Booking & Tracking State
    const [lalamoveConfig, setLalamoveConfig] = useState<any>(null);
    const [lalamoveBookingModalOpen, setLalamoveBookingModalOpen] = useState<boolean>(false);
    const [selectedDeliveryForLalamove, setSelectedDeliveryForLalamove] = useState<any>(null);
    const [lalamoveServiceType, setLalamoveServiceType] = useState<string>('VAN_500KG');
    const [lalamovePickupAddress, setLalamovePickupAddress] = useState<string>('');
    const [lalamovePickupLat, setLalamovePickupLat] = useState<number | string>('');
    const [lalamovePickupLng, setLalamovePickupLng] = useState<number | string>('');
    const [lalamovePickupName, setLalamovePickupName] = useState<string>('');
    const [lalamovePickupPhone, setLalamovePickupPhone] = useState<string>('');
    const [lalamoveDropAddress, setLalamoveDropAddress] = useState<string>('');
    const [lalamoveDropLat, setLalamoveDropLat] = useState<number | string>('');
    const [lalamoveDropLng, setLalamoveDropLng] = useState<number | string>('');
    const [lalamoveDropName, setLalamoveDropName] = useState<string>('');
    const [lalamoveDropPhone, setLalamoveDropPhone] = useState<string>('');
    const [lalamoveRemarks, setLalamoveRemarks] = useState<string>('');
    const [lalamoveQuotation, setLalamoveQuotation] = useState<any>(null);
    const [lalamoveLoadingQuotation, setLalamoveLoadingQuotation] = useState<boolean>(false);
    const [lalamovePushingOrder, setLalamovePushingOrder] = useState<boolean>(false);
    const [lalamoveGeocoding, setLalamoveGeocoding] = useState<boolean>(false);

    // Lalamove POD & Tip Modals
    const [lalamovePodModalOpen, setLalamovePodModalOpen] = useState<boolean>(false);
    const [selectedLalamovePodImage, setSelectedLalamovePodImage] = useState<string>('');
    const [lalamoveTipModalOpen, setLalamoveTipModalOpen] = useState<boolean>(false);
    const [lalamoveTipAmount, setLalamoveTipAmount] = useState<number>(20000);
    const [lalamoveTipping, setLalamoveTipping] = useState<boolean>(false);

    // Lalamove In-Modal Check Fee & Sync State
    const [lalamoveEstimateLoading, setLalamoveEstimateLoading] = useState<boolean>(false);
    const [lalamoveEstimatedFeeInfo, setLalamoveEstimatedFeeInfo] = useState<any>(null);
    const [lalamoveModalServiceType, setLalamoveModalServiceType] = useState<string>('VAN_500KG');
    const [pushToLalamoveDirectly, setPushToLalamoveDirectly] = useState<boolean>(true);
    const [syncingLalamoveId, setSyncingLalamoveId] = useState<number | null>(null);

    // Delivery Notice Templates & State
    const [deliveryNoticeTemplates, setDeliveryNoticeTemplates] = useState<DeliveryNoticeTemplate[]>(DEFAULT_DELIVERY_NOTICE_TEMPLATES);
    const [selectedNoticeTemplateId, setSelectedNoticeTemplateId] = useState<string>('standard_b2b');
    const [deliveryNotice, setDeliveryNotice] = useState<string>('');
    const [viewNoticeModalOpen, setViewNoticeModalOpen] = useState<boolean>(false);
    const [selectedDeliveryForNotice, setSelectedDeliveryForNotice] = useState<any>(null);
    const [editingSavedNotice, setEditingSavedNotice] = useState<string>('');
    const [isSavingNotice, setIsSavingNotice] = useState<boolean>(false);

    // Multi-Leg Shipping State
    const [shippingLegs, setShippingLegs] = useState<ShippingLeg[]>([]);

    // Zalo ZNS Delivery Modal State
    const [znsDeliveryModalOpen, setZnsDeliveryModalOpen] = useState<boolean>(false);
    const [selectedDeliveryForZns, setSelectedDeliveryForZns] = useState<any>(null);
    const [znsDeliveryPhone, setZnsDeliveryPhone] = useState<string>('');
    const [znsDeliveryRecipientName, setZnsDeliveryRecipientName] = useState<string>('');
    const [isSendingDeliveryZns, setIsSendingDeliveryZns] = useState<boolean>(false);
    const [deliveryZnsResult, setDeliveryZnsResult] = useState<any>(null);

    const fetchGhtkConfig = async () => {
        try {
            const res = await api.get('/shipping/config');
            if (res.data) {
                setGhtkConfig(res.data);
                if (res.data.isConfigured && res.data.defaultPickAddressId && !selectedPickAddressId) {
                    setSelectedPickAddressId(res.data.defaultPickAddressId);
                }
                if (res.data.defaultPickOption) {
                    setGhtkPickOption(res.data.defaultPickOption);
                }
            }
        } catch (e) { }
    };

    const handleOpenGhtkConfig = () => {
        setGhtkIsSandboxInput(ghtkConfig?.isSandbox || false);
        setGhtkPartnerCodeInput(ghtkConfig?.partnerCode || '');
        setGhtkDefaultPickAddressInput(ghtkConfig?.defaultPickAddressId || '');
        setGhtkDefaultPickOptionInput(ghtkConfig?.defaultPickOption || 'cod');
        setGhtkTokenInput('');
        setGhtkTestResult(null);
        setGhtkConfigModalOpen(true);
    };

    const handleTestGhtkConnection = async () => {
        try {
            setGhtkTestLoading(true);
            setGhtkTestResult(null);
            const res = await api.post('/shipping/test-connection', {
                token: ghtkTokenInput || undefined,
                isSandbox: ghtkIsSandboxInput,
                partnerCode: ghtkPartnerCodeInput || undefined,
            });
            setGhtkTestResult(res.data);
            if (res.data?.success) {
                message.success('Kết nối GHTK thành công!');
            } else {
                message.error(res.data?.message || 'Kết nối GHTK thất bại');
            }
        } catch (e: any) {
            setGhtkTestResult({ success: false, message: e.response?.data?.message || e.message });
            message.error('Lỗi khi kiểm tra kết nối GHTK');
        } finally {
            setGhtkTestLoading(false);
        }
    };

    const handleSaveGhtkConfig = async () => {
        try {
            setGhtkSaveLoading(true);
            const payload: any = {
                isSandbox: ghtkIsSandboxInput,
                partnerCode: ghtkPartnerCodeInput,
                defaultPickAddressId: ghtkDefaultPickAddressInput,
                defaultPickOption: ghtkDefaultPickOptionInput,
            };
            if (ghtkTokenInput && ghtkTokenInput.trim()) {
                payload.token = ghtkTokenInput.trim();
            }
            await api.post('/shipping/config', payload);
            message.success('Đã lưu cấu hình GHTK thành công!');
            setGhtkConfigModalOpen(false);
            setGhtkPickOption(ghtkDefaultPickOptionInput);
            fetchGhtkConfig();
            fetchGhtkPickAddresses();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Không thể lưu cấu hình GHTK');
        } finally {
            setGhtkSaveLoading(false);
        }
    };

    // RESOLVE FULL CUSTOMER (to get contacts)
    const fullCustomer = customers.find(c => c.id === order?.customer?.id || c.id === order?.customer_id) || order?.customer || {};
    const contactList = fullCustomer?.contacts || [];

    const fetchHistory = async () => {
        try {
            const res = await api.get(`/sales/${order.id}/deliveries`);
            setHistory(Array.isArray(res.data) ? res.data : []);
        } catch (e) { }
    };

    const fetchCarriers = async () => {
        try {
            const res = await api.get(`/suppliers`);
            const logistics = res.data?.filter((c: any) => c.type === 'LOGISTICS') || [];
            const hasGhtk = logistics.some((c: any) => c.code === 'GHTK' || (c.name || '').includes('GHTK') || (c.name || '').includes('Giao Hàng Tiết Kiệm'));
            if (!hasGhtk) {
                logistics.unshift({ code: 'GHTK', name: 'GHTK - Giao Hàng Tiết Kiệm' });
            }
            const hasLalamove = logistics.some((c: any) => c.code === 'LALAMOVE' || (c.name || '').toLowerCase().includes('lalamove'));
            if (!hasLalamove) {
                logistics.unshift({ code: 'LALAMOVE', name: 'Lalamove - Hỏa Tốc & Xe Tải' });
            }
            setCarriers(logistics);
        } catch (e) { 
            setCarriers([
                { code: 'LALAMOVE', name: 'Lalamove - Hỏa Tốc & Xe Tải' },
                { code: 'GHTK', name: 'GHTK - Giao Hàng Tiết Kiệm' }
            ]);
        }
    };

    const fetchGhtkPickAddresses = async () => {
        try {
            const res = await api.get('/shipping/ghtk/pick-addresses');
            if (Array.isArray(res.data) && res.data.length > 0) {
                setGhtkPickAddresses(res.data);
                if (!selectedPickAddressId) {
                    setSelectedPickAddressId(res.data[0].pick_address_id || 'DEFAULT');
                }
            }
        } catch (e) { }
    };

    const fetchPackingSpecs = async () => {
        try {
            const res = await api.get('/products/packing-specs');
            setPackingSpecs(Array.isArray(res.data) ? res.data : []);
        } catch (e) { }
    };

    const handleSelectPackingSpec = (specId: number | null) => {
        setSelectedPackingSpecId(specId);
        if (!specId) {
            setPackingSpecName('');
            return;
        }
        const spec = packingSpecs.find((s: any) => s.id === specId);
        if (!spec) return;

        setPackingSpecName(spec.name);
        const l = spec.length_cm !== null && spec.length_cm !== undefined ? Number(spec.length_cm) : null;
        const w = spec.width_cm !== null && spec.width_cm !== undefined ? Number(spec.width_cm) : null;
        const h = spec.height_cm !== null && spec.height_cm !== undefined ? Number(spec.height_cm) : null;
        const actW = spec.weight_gram !== null && spec.weight_gram !== undefined ? Number(spec.weight_gram) : null;

        setPackageLength(l);
        setPackageWidth(w);
        setPackageHeight(h);
        setPackageActualWeight(actW);

        // Tính số kiện gợi ý: Tổng số lượng các sản phẩm xuất / số lượng mỗi kiện
        const totalShipQty = shipItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const qtyPerPkg = Number(spec.quantity_per_package) || 1;
        const suggestedCount = Math.max(1, Math.ceil(totalShipQty / qtyPerPkg));
        setPackageCount(suggestedCount);

        // Tính trọng lượng thể tích quy đổi: L * W * H / 6 (gram)
        if (l && w && h) {
            const volWeightGram = Math.round((l * w * h) / 6);
            const billablePerPkg = Math.max(actW || 0, volWeightGram);
            const totalSuggestedWeight = (billablePerPkg > 0 ? billablePerPkg : 500) * suggestedCount;
            setPackageWeight(totalSuggestedWeight);
        } else if (actW) {
            setPackageWeight(actW * suggestedCount);
        }
    };

    const handleDimensionOrCountChange = (
        newL?: number | null, 
        newW?: number | null, 
        newH?: number | null, 
        newCount?: number | null
    ) => {
        const l = newL !== undefined ? newL : packageLength;
        const w = newW !== undefined ? newW : packageWidth;
        const h = newH !== undefined ? newH : packageHeight;
        const count = newCount !== undefined ? (newCount || 1) : (packageCount || 1);

        if (newL !== undefined) setPackageLength(newL);
        if (newW !== undefined) setPackageWidth(newW);
        if (newH !== undefined) setPackageHeight(newH);
        if (newCount !== undefined) setPackageCount(count);

        if (l && w && h) {
            const volPerPkg = Math.round((Number(l) * Number(w) * Number(h)) / 6);
            const billablePerPkg = Math.max(packageActualWeight || 0, volPerPkg);
            const totalSuggestedWeight = billablePerPkg * Math.max(1, count);
            setPackageWeight(totalSuggestedWeight);
        }
    };

    const handleGhtkParseAddress = async () => {
        const targetAddr = shipAddress;
        if (!targetAddr) {
            message.warning('Vui lòng nhập địa chỉ giao hàng trước khi chuẩn hóa');
            return;
        }

        // Bóc tách nhanh bằng bộ từ điển nội bộ
        const localParsed = smartParseVietnameseAddress(targetAddr);
        if (localParsed.province) setGhtkProvince(extractAddressString(localParsed.province));
        if (localParsed.district) setGhtkDistrict(extractAddressString(localParsed.district));
        if (localParsed.ward) setGhtkWard(extractAddressString(localParsed.ward));
        if (localParsed.street) setGhtkAddress(extractAddressString(localParsed.street));

        try {
            setGhtkParseLoading(true);
            const res = await api.post('/shipping/ghtk/parse-address', { address: targetAddr });
            if (res.data?.success) {
                const prov = extractAddressString(res.data.province || localParsed.province, '');
                const dist = extractAddressString(res.data.district || localParsed.district, '');
                const wrd = extractAddressString(res.data.ward || localParsed.ward, '');
                const ham = extractAddressString(res.data.hamlet || localParsed.hamlet, 'Khác');
                const str = extractAddressString(res.data.street || localParsed.street, targetAddr);

                setGhtkProvince(prov);
                setGhtkDistrict(dist);
                setGhtkWard(wrd);
                setGhtkHamlet(ham);
                setGhtkAddress(str);
                message.success(`Đã chuẩn hóa: ${wrd ? wrd + ', ' : ''}${dist ? dist + ', ' : ''}${prov} (Thôn/ấp: ${ham})`);
            }
        } catch (e: any) {
            if (localParsed.province || localParsed.district) {
                const safeProv = extractAddressString(localParsed.province);
                const safeDist = extractAddressString(localParsed.district);
                const safeWrd = extractAddressString(localParsed.ward);
                const safeHam = extractAddressString(localParsed.hamlet, 'Khác');
                const safeStr = extractAddressString(localParsed.street, targetAddr);

                setGhtkProvince(safeProv);
                setGhtkDistrict(safeDist);
                setGhtkWard(safeWrd);
                setGhtkHamlet(safeHam);
                setGhtkAddress(safeStr);
                message.success(`Đã nhận diện: ${safeWrd ? safeWrd + ', ' : ''}${safeDist ? safeDist + ', ' : ''}${safeProv} (Thôn/ấp: ${safeHam})`);
            } else {
                message.warning('Không thể tự động nhận diện, vui lòng điền Tỉnh/Quận');
            }
        } finally {
            setGhtkParseLoading(false);
        }
    };

    const handleGhtkEstimateFee = async () => {
        let prov = extractAddressString(ghtkProvince);
        let dist = extractAddressString(ghtkDistrict);
        let ward = extractAddressString(ghtkWard);

        // Nếu chưa có tỉnh hoặc huyện, tự động phân tích từ shipAddress
        if (!prov || !dist) {
            const autoParsed = smartParseVietnameseAddress(shipAddress);
            if (autoParsed.province) {
                prov = extractAddressString(autoParsed.province);
                setGhtkProvince(prov);
            }
            if (autoParsed.district) {
                dist = extractAddressString(autoParsed.district);
                setGhtkDistrict(dist);
            }
            if (autoParsed.ward && !ward) {
                ward = extractAddressString(autoParsed.ward);
                setGhtkWard(ward);
            }
            if (autoParsed.street) {
                setGhtkAddress(extractAddressString(autoParsed.street));
            }
        }

        // Tự động chuẩn hóa nếu Quận/Huyện bị nhập nhầm thành Phường
        if (dist && (dist.toLowerCase().startsWith('phường') || dist.toLowerCase().startsWith('p.') || (ward && dist.toLowerCase() === ward.toLowerCase()))) {
            const provStr = prov.toLowerCase();
            const matchedP = VIETNAM_PROVINCES.find(pr => pr.standard.toLowerCase() === provStr || pr.names.some(n => provStr.includes(n)));
            if (matchedP?.defaultCity) {
                dist = matchedP.defaultCity;
                setGhtkDistrict(dist);
            }
        }

        if (!prov) {
            message.warning('Vui lòng nhập Tỉnh/Thành giao hàng để tính cước');
            return;
        }

        try {
            setGhtkEstimateLoading(true);
            const res = await api.post('/shipping/ghtk/estimate-fee', {
                province: prov,
                district: dist || prov,
                ward: ward,
                address: extractAddressString(ghtkAddress || shipAddress),
                weight: Number(packageWeight) || 500,
                value: Number(order?.total_amount) || 0,
                pick_address_id: selectedPickAddressId || ghtkConfig?.defaultPickAddressId,
                pick_option: ghtkPickOption,
            });

            if (res.data?.success && res.data?.fee) {
                const feeVal = Number(res.data.fee.fee) || 0;
                setShippingCost(feeVal);
                setEstimatedFeeInfo(res.data.fee);
                message.success(`Cước GHTK ước tính: ${feeVal.toLocaleString()}đ (${dist ? dist + ', ' : ''}${prov})`);
            }
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi tính cước GHTK');
        } finally {
            setGhtkEstimateLoading(false);
        }
    };

    const handleReparseNote = () => {
        const parsed = parseWebsiteOrderNote(order?.note, order);
        setWebsiteOrderParsed(parsed);
        if (parsed.receiverName) setShipContactName(parsed.receiverName);
        if (parsed.receiverPhone) setShipContactPhone(parsed.receiverPhone);
        if (parsed.shippingAddress) {
            setShipAddress(parsed.shippingAddress);
            const addrParts = smartParseVietnameseAddress(parsed.shippingAddress);
            setGhtkProvince(addrParts.province || '');
            setGhtkDistrict(addrParts.district || '');
            setGhtkWard(addrParts.ward || '');
            setGhtkHamlet(addrParts.hamlet || 'Khác');
            setGhtkAddress(addrParts.street || parsed.shippingAddress);
        }
        if (parsed.deliveryNote) setShipNote(parsed.deliveryNote);
        setIsCod(parsed.isCod);
        setPickMoney(parsed.suggestedCodAmount);
        message.info('Đã bóc tách lại thông tin từ ghi chú đơn hàng');
    };

    const handlePrintGhtkLabel = (delivery: any) => {
        if (!delivery?.tracking_code) {
            message.warning('Phiếu xuất kho này chưa có mã vận đơn GHTK để in nhãn');
            return;
        }
        const printUrl = `${API_URL}/shipping/delivery/${delivery.id}/print-label?pageSize=A6`;
        window.open(printUrl, '_blank');
    };

    const handleViewTracking = async (delivery: any) => {
        setTrackingDelivery(delivery);
        setTrackingModalOpen(true);
        setTrackingLoading(true);
        try {
            const res = await api.get(`/shipping/delivery/${delivery.id}/tracking`);
            setTrackingData(res.data);
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Không thể tra cứu hành trình vận đơn');
        } finally {
            setTrackingLoading(false);
        }
    };

    const handleCancelGhtk = async (deliveryId: number) => {
        Modal.confirm({
            title: 'Hủy Vận Đơn GHTK?',
            content: 'Bạn có chắc chắn muốn hủy vận đơn này trên hệ thống GHTK? Shipper sẽ không đến lấy kiện hàng này nữa.',
            okText: 'Hủy đơn',
            cancelText: 'Đóng',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.post(`/shipping/delivery/${deliveryId}/cancel-ghtk`);
                    message.success('Đã hủy vận đơn GHTK thành công');
                    fetchHistory();
                } catch (e: any) {
                    message.error(e.response?.data?.message || 'Không thể hủy vận đơn GHTK');
                }
            }
        });
    };

    const executePushGhtk = async (delivery: any) => {
        try {
            message.loading({ content: 'Đang gửi thông tin sang GHTK để tạo vận đơn...', key: 'push_ghtk' });
            // Chuẩn hóa địa chỉ trực tiếp từ phiếu xuất kho này để không bị nhầm dữ liệu form
            const parsed = smartParseVietnameseAddress(delivery.delivery_address || '');

            // Chuẩn bị danh sách sản phẩm từ delivery.items hoặc fallback sang order.items
            const deliveryProducts = (delivery.items && delivery.items.length > 0)
                ? delivery.items.map((it: any) => {
                    const soItem = order?.items?.find((si: any) => si.sku === it.sku);
                    const pInfo = products.find((p: any) => p.value === it.sku);
                    return {
                        name: soItem?.product?.name || pInfo?.label || it.sku,
                        quantity: Number(it.quantity) || 1,
                        product_code: it.sku,
                        price: Number(soItem?.unit_price) || 0
                    };
                })
                : (order?.items || []).map((si: any) => {
                    const pInfo = products.find((p: any) => p.value === si.sku);
                    return {
                        name: si.product?.name || pInfo?.label || si.sku,
                        quantity: Number(si.quantity) || 1,
                        product_code: si.sku,
                        price: Number(si.unit_price) || 0
                    };
                });

            // Tính tổng tiền hàng của đợt giao này
            const deliveryTotalValue = deliveryProducts.reduce((sum: number, p: any) => sum + (Number(p.price || 0) * Number(p.quantity || 1)), 0);

            // Tự động kiểm tra và sửa nếu Quận/Huyện bị gán nhầm thành Phường
            let sendDist = extractAddressString(parsed.district || ghtkDistrict);
            const sendProv = extractAddressString(parsed.province || ghtkProvince);
            const sendWard = extractAddressString(parsed.ward || ghtkWard);
            if (sendDist && (sendDist.toLowerCase().startsWith('phường') || sendDist.toLowerCase().startsWith('p.') || (sendWard && sendDist.toLowerCase() === sendWard.toLowerCase()))) {
                const provStr = sendProv.toLowerCase();
                const matchedP = VIETNAM_PROVINCES.find(pr => pr.standard.toLowerCase() === provStr || pr.names.some(n => provStr.includes(n)));
                if (matchedP?.defaultCity) {
                    sendDist = matchedP.defaultCity;
                }
            }

            const res = await api.post(`/shipping/delivery/${delivery.id}/push-ghtk`, {
                pick_address_id: selectedPickAddressId || ghtkConfig?.defaultPickAddressId,
                pick_option: ghtkPickOption,
                province: sendProv,
                district: sendDist,
                ward: sendWard,
                hamlet: extractAddressString(parsed.hamlet || ghtkHamlet, 'Khác'),
                address: extractAddressString(parsed.street || delivery.delivery_address),
                note: delivery.note,
                weight_gram: delivery.weight_gram || packageWeight || 500,
                pick_money: delivery.pick_money || 0,
                is_freeship: delivery.is_freeship !== undefined ? delivery.is_freeship : 1,
                // Kích thước kiện & số kiện
                package_length: delivery.package_length !== null && delivery.package_length !== undefined ? Number(delivery.package_length) : (packageLength || null),
                package_width: delivery.package_width !== null && delivery.package_width !== undefined ? Number(delivery.package_width) : (packageWidth || null),
                package_height: delivery.package_height !== null && delivery.package_height !== undefined ? Number(delivery.package_height) : (packageHeight || null),
                package_count: delivery.package_count || packageCount || 1,
                packing_spec_name: delivery.packing_spec_name || packingSpecName || null,
                // Giá trị & sản phẩm đợt giao
                value: deliveryTotalValue > 0 ? deliveryTotalValue : (Number(delivery.sales_order?.total_amount) || 0),
                products: deliveryProducts,
            });
            const isMockPush = res.data?.is_mock;
            message.success({ 
                content: isMockPush
                    ? `Đã tạo mã vận đơn GHTK mô phỏng: ${res.data?.tracking_code} (Chưa có Token thật)`
                    : `Đã tạo mã vận đơn GHTK chính thức: ${res.data?.tracking_code}`, 
                key: 'push_ghtk',
                duration: 5
            });
            fetchHistory();
        } catch (e: any) {
            message.error({ content: e.response?.data?.message || 'Lỗi khi đẩy đơn GHTK', key: 'push_ghtk' });
        }
    };

    const handlePushSingleDeliveryGhtk = async (delivery: any) => {
        const isDemo = delivery.tracking_code?.startsWith('GHTK-DEMO');
        const itemCount = (delivery.items && delivery.items.length > 0) ? delivery.items.length : (order?.items?.length || 0);
        const totalQty = (delivery.items && delivery.items.length > 0)
            ? delivery.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0)
            : (order?.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
        const dimensions = (delivery.package_length && delivery.package_width && delivery.package_height)
            ? `${delivery.package_length} x ${delivery.package_width} x ${delivery.package_height} cm`
            : (packageLength && packageWidth && packageHeight ? `${packageLength} x ${packageWidth} x ${packageHeight} cm` : 'Chưa nhập kích thước');

        const deliveryProducts = (delivery.items && delivery.items.length > 0)
            ? delivery.items
            : (order?.items || []);
        const totalVal = deliveryProducts.reduce((sum: number, it: any) => {
            const soItem = order?.items?.find((si: any) => si.sku === it.sku);
            return sum + (Number(it.quantity || 1) * Number(soItem?.unit_price || 0));
        }, 0);

        const isPostDelivery = (delivery.shipping_metadata?.pick_option === 'post') || ghtkPickOption === 'post';
        const summaryContent = (
            <div style={{ marginTop: 8, fontSize: 13, background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                    <div>📦 <b>Số kiện:</b> {delivery.package_count || packageCount || 1} kiện</div>
                    <div>📏 <b>Kích thước:</b> {dimensions}</div>
                    <div>⚖️ <b>Khối lượng:</b> {delivery.weight_gram || packageWeight || 500}g</div>
                    <div>📋 <b>Sản phẩm:</b> {itemCount} dòng ({totalQty} món)</div>
                    <div style={{ gridColumn: 'span 2' }}>
                        🏪 <b>Hình thức gửi:</b> {isPostDelivery ? 'Giao tại bưu cục / cửa hàng GHTK (Shop tự mang gửi)' : 'Shipper GHTK đến lấy tại kho'}
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        💰 <b>Tổng tiền hàng đợt này:</b> <span style={{ color: '#008444', fontWeight: 600 }}>{totalVal ? totalVal.toLocaleString('vi-VN') : (Number(delivery.sales_order?.total_amount) || 0).toLocaleString('vi-VN')} đ</span>
                    </div>
                    {(delivery.packing_spec_name || packingSpecName) && (
                        <div style={{ gridColumn: 'span 2' }}>🏷️ <b>Quy cách:</b> {delivery.packing_spec_name || packingSpecName}</div>
                    )}
                </div>
            </div>
        );

        if (!ghtkConfig?.isConfigured) {
            Modal.confirm({
                title: 'Chưa cấu hình Token GHTK thật',
                content: (
                    <div>
                        <p>Hệ thống hiện chưa cấu hình API Token của GHTK thật.</p>
                        <p>Nếu tiếp tục đẩy đơn, hệ thống sẽ chỉ tạo <b>mã vận đơn mô phỏng (Demo)</b>.</p>
                        {summaryContent}
                    </div>
                ),
                okText: 'Cấu hình Token ngay',
                cancelText: 'Vẫn tạo Demo',
                onOk: () => handleOpenGhtkConfig(),
                onCancel: async () => {
                    executePushGhtk(delivery);
                }
            });
            return;
        }

        Modal.confirm({
            title: isDemo ? 'Đẩy lại vận đơn sang GHTK thật?' : 'Đẩy vận đơn sang GHTK?',
            width: 480,
            content: (
                <div>
                    <div>
                        {isDemo 
                            ? `Phiếu xuất ${delivery.code} hiện đang mang mã Demo (${delivery.tracking_code}). Xác nhận gửi thông tin sang GHTK thật để lấy mã vận đơn chính thức?`
                            : `Xác nhận tạo đơn giao hàng cho phiếu xuất ${delivery.code} sang GHTK?`}
                    </div>
                    {summaryContent}
                </div>
            ),
            okText: 'Đẩy đơn GHTK',
            cancelText: 'Hủy',
            onOk: async () => {
                executePushGhtk(delivery);
            }
        });
    };

    const handleDeleteDelivery = async (deliveryId: number) => {
        Modal.confirm({
            title: 'Xóa Phiếu Xuất Kho?',
            content: 'Bạn có chắc muốn xóa phiếu này? Nếu đã xuất kho, tồn kho sẽ được hoàn lại.',
            okText: 'Xóa',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/sales/delivery/${deliveryId}`);
                    message.success('Đã xóa phiếu xuất kho');
                    fetchHistory();
                    onSuccess();
                } catch (e: any) {
                    message.error(e.response?.data?.message || 'Không thể xóa phiếu');
                }
            }
        });
    };

    // ==========================================
    // LALAMOVE HANDLERS (API v3)
    // ==========================================
    const fetchLalamoveConfig = async () => {
        try {
            const res = await api.get('/shipping/lalamove/config');
            setLalamoveConfig(res.data);
            return res.data;
        } catch (e) {
            return null;
        }
    };

    const fetchLalamoveQuotation = async (
        sType: string,
        pLat: any, pLng: any, pAddr: string,
        dLat: any, dLng: any, dAddr: string,
        pkgCount?: number, weightGram?: number
    ) => {
        if (!pLat || !pLng || !dLat || !dLng) return;
        setLalamoveLoadingQuotation(true);
        try {
            const res = await api.post('/shipping/lalamove/quotation', {
                serviceType: sType,
                stops: [
                    { coordinates: { lat: String(pLat), lng: String(pLng) }, address: pAddr },
                    { coordinates: { lat: String(dLat), lng: String(dLng) }, address: dAddr }
                ],
                item: {
                    quantity: String(pkgCount || 1),
                    weight: (weightGram || 500) > 30000 ? 'MORE_THAN_30_KG' : 'LESS_THAN_30_KG',
                    categories: ['OFFICE_ITEM', 'OTHERS']
                }
            });
            setLalamoveQuotation(res.data?.data);
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Không thể lấy báo giá Lalamove');
        } finally {
            setLalamoveLoadingQuotation(false);
        }
    };

    const handleOpenLalamoveBooking = async (delivery: any) => {
        setSelectedDeliveryForLalamove(delivery);
        setLalamoveQuotation(null);
        setLalamoveBookingModalOpen(true);

        const cfg = await fetchLalamoveConfig();

        // 1. Kho xuất hàng mặc định
        const defaultPLat = cfg?.defaultPickLat || 10.8230989;
        const defaultPLng = cfg?.defaultPickLng || 106.6296638;
        const defaultPAddr = cfg?.defaultPickAddress || 'Kho ERP4U, Tân Thới Nhất, Quận 12, TP. Hồ Chí Minh';
        setLalamovePickupAddress(defaultPAddr);
        setLalamovePickupLat(defaultPLat);
        setLalamovePickupLng(defaultPLng);
        setLalamovePickupName(cfg?.defaultSenderName || 'Kho ERP4U');
        setLalamovePickupPhone(cfg?.defaultSenderPhone || '+84901234567');

        // 2. Điểm giao hàng
        const dropAddr = delivery.delivery_address || order.shipping_address || '';
        setLalamoveDropAddress(dropAddr);
        setLalamoveDropName(delivery.contact_name || delivery.sales_order?.contact_person || order.contact_person || 'Người nhận hàng');
        setLalamoveDropPhone(delivery.contact_phone || delivery.sales_order?.phone || order.phone || '');

        const count = delivery.package_count || packageCount || 1;
        const spec = delivery.packing_spec_name || packingSpecName || '';
        const note = `Giao ${count} kiện ${spec ? `(${spec})` : 'hàng nệm mầm non'} - Đơn ${order.code}. ${delivery.note || ''}`.trim();
        setLalamoveRemarks(note);

        const initialType = 'VAN_500KG';
        setLalamoveServiceType(initialType);

        // Tự động phân giải tọa độ điểm giao
        if (dropAddr) {
            setLalamoveGeocoding(true);
            try {
                const geoRes = await api.post('/shipping/lalamove/geocode', { address: dropAddr });
                if (geoRes.data?.lat && geoRes.data?.lng) {
                    setLalamoveDropLat(geoRes.data.lat);
                    setLalamoveDropLng(geoRes.data.lng);
                    // Lấy luôn báo giá ban đầu
                    fetchLalamoveQuotation(
                        initialType,
                        defaultPLat, defaultPLng, defaultPAddr,
                        geoRes.data.lat, geoRes.data.lng, dropAddr,
                        count, delivery.weight_gram || 500
                    );
                }
            } catch (e) { }
            finally {
                setLalamoveGeocoding(false);
            }
        }
    };

    const handleReGeocodeAndQuote = async () => {
        if (!lalamoveDropAddress) {
            message.warning('Vui lòng nhập địa chỉ giao hàng trước khi định vị');
            return;
        }
        setLalamoveGeocoding(true);
        try {
            const geoRes = await api.post('/shipping/lalamove/geocode', { address: lalamoveDropAddress });
            if (geoRes.data?.lat && geoRes.data?.lng) {
                setLalamoveDropLat(geoRes.data.lat);
                setLalamoveDropLng(geoRes.data.lng);
                message.success(`Đã định vị thành công: ${geoRes.data.lat}, ${geoRes.data.lng}`);
                fetchLalamoveQuotation(
                    lalamoveServiceType,
                    lalamovePickupLat, lalamovePickupLng, lalamovePickupAddress,
                    geoRes.data.lat, geoRes.data.lng, lalamoveDropAddress,
                    selectedDeliveryForLalamove?.package_count || 1,
                    selectedDeliveryForLalamove?.weight_gram || 500
                );
            } else {
                message.warning('Không tìm thấy tọa độ chính xác, vui lòng nhập tọa độ thủ công');
            }
        } catch (e: any) {
            message.error('Lỗi khi định vị địa chỉ: ' + (e.response?.data?.message || e.message));
        } finally {
            setLalamoveGeocoding(false);
        }
    };

    const handleLalamoveEstimateFee = async () => {
        if (!shipAddress || !shipAddress.trim()) {
            message.warning('Vui lòng nhập địa chỉ giao hàng trước khi tra cước Lalamove');
            return;
        }

        const chosenVehicle = lalamoveModalServiceType || 'VAN_500KG';
        setLalamoveEstimateLoading(true);
        try {
            const res = await api.post('/shipping/lalamove/estimate-fee', {
                dropoffAddress: extractAddressString(shipAddress),
                serviceType: chosenVehicle,
                weight: packageWeight || 500,
                packageCount: packageCount || 1,
                length: packageLength !== null && packageLength !== undefined ? Number(packageLength) : null,
                width: packageWidth !== null && packageWidth !== undefined ? Number(packageWidth) : null,
                height: packageHeight !== null && packageHeight !== undefined ? Number(packageHeight) : null,
            });

            if (res.data?.success && res.data?.estimatedFee !== undefined) {
                const feeVal = Number(res.data.estimatedFee) || 0;
                setLalamoveEstimatedFeeInfo(res.data);
                setShippingCost(feeVal);
                message.success(`Cước Lalamove ước tính (${res.data.vehicleName}): ${feeVal.toLocaleString()}đ (~${res.data.distanceKm} km)`);
            } else {
                message.warning(res.data?.message || 'Không nhận được báo giá từ Lalamove');
            }
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi tra cước Lalamove');
        } finally {
            setLalamoveEstimateLoading(false);
        }
    };

    const handleApplyLalamoveEstimatedFee = () => {
        if (lalamoveEstimatedFeeInfo?.estimatedFee !== undefined) {
            const feeVal = Number(lalamoveEstimatedFeeInfo.estimatedFee) || 0;
            setShippingCost(feeVal);
            message.success(`Đã áp dụng cước Lalamove: ${feeVal.toLocaleString()}đ vào Chi phí VC`);
        }
    };

    const handleSyncLalamoveStatus = async (delivery: any) => {
        if (!delivery?.id) return;
        setSyncingLalamoveId(delivery.id);
        try {
            const res = await api.post(`/shipping/delivery/${delivery.id}/sync-lalamove`);
            if (res.data?.success) {
                message.success(res.data.message || 'Đã đồng bộ trạng thái & cước phí Lalamove thành công');
                fetchHistory();
            } else {
                message.warning(res.data?.message || 'Không thể đồng bộ đơn Lalamove');
            }
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi đồng bộ đơn Lalamove');
        } finally {
            setSyncingLalamoveId(null);
        }
    };

    const handleConfirmPushLalamove = async () => {
        if (!selectedDeliveryForLalamove) return;
        setLalamovePushingOrder(true);
        try {
            const res = await api.post(`/shipping/delivery/${selectedDeliveryForLalamove.id}/push-lalamove`, {
                serviceType: lalamoveServiceType,
                senderName: lalamovePickupName,
                senderPhone: lalamovePickupPhone,
                senderAddress: lalamovePickupAddress,
                senderLat: lalamovePickupLat,
                senderLng: lalamovePickupLng,
                recipientName: lalamoveDropName,
                recipientPhone: lalamoveDropPhone,
                recipientAddress: lalamoveDropAddress,
                recipientLat: lalamoveDropLat,
                recipientLng: lalamoveDropLng,
                remarks: lalamoveRemarks,
                isPODEnabled: true
            });

            message.success({
                content: res.data?.is_mock
                    ? `[Mô phỏng] Đã tạo cuốc xe Lalamove Demo: ${res.data?.tracking_code}`
                    : `Đã đặt xe Lalamove thành công! Mã đơn: ${res.data?.tracking_code}`,
                duration: 6
            });
            setLalamoveBookingModalOpen(false);
            fetchHistory();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi đặt xe Lalamove');
        } finally {
            setLalamovePushingOrder(false);
        }
    };

    const handleCancelLalamove = (delivery: any) => {
        Modal.confirm({
            title: 'Hủy cuốc xe Lalamove?',
            content: `Bạn có chắc muốn hủy cuốc xe Lalamove (Mã: ${delivery.tracking_code})? Thao tác này chỉ thực hiện được khi tài xế chưa bốc hàng hoặc trong 5 phút đầu.`,
            okText: 'Xác nhận Hủy cuốc',
            okButtonProps: { danger: true },
            cancelText: 'Đóng',
            onOk: async () => {
                try {
                    await api.post(`/shipping/delivery/${delivery.id}/cancel-lalamove`);
                    message.success('Đã hủy cuốc xe Lalamove thành công');
                    fetchHistory();
                } catch (e: any) {
                    message.error(e.response?.data?.message || 'Lỗi khi hủy đơn Lalamove');
                }
            }
        });
    };

    const handleOpenLalamoveTipModal = (delivery: any) => {
        setSelectedDeliveryForLalamove(delivery);
        setLalamoveTipAmount(20000);
        setLalamoveTipModalOpen(true);
    };

    const handleConfirmTip = async () => {
        if (!selectedDeliveryForLalamove) return;
        setLalamoveTipping(true);
        try {
            const res = await api.post(`/shipping/delivery/${selectedDeliveryForLalamove.id}/lalamove-priority-fee`, {
                priorityFee: lalamoveTipAmount
            });
            message.success(res.data?.message || 'Đã thêm tiền tip cho tài xế');
            setLalamoveTipModalOpen(false);
            fetchHistory();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi thêm phí ưu tiên');
        } finally {
            setLalamoveTipping(false);
        }
    };

    const handleViewLalamovePod = (delivery: any) => {
        const podImg = delivery.shipping_metadata?.lalamove?.pod?.image;
        if (podImg) {
            setSelectedLalamovePodImage(podImg);
            setLalamovePodModalOpen(true);
        } else {
            message.info('Chưa có ảnh chụp nghiệm thu giao hàng POD từ tài xế');
        }
    };

    // State: Combo components cache (sku -> components[])
    const [comboComponentsMap, setComboComponentsMap] = useState<Record<string, any[]>>({});

    useEffect(() => {
        if (order?.id) fetchHistory();
        fetchCarriers();
        fetchGhtkConfig();
        fetchGhtkPickAddresses();
        fetchPackingSpecs();
        api.get(`/system/company`).then(res => setCompanyConfig(res.data)).catch(() => { });
        api.get(`/system/config/DELIVERY_NOTICE_TEMPLATES`).then(res => {
            if (res.data?.value) {
                try {
                    const parsed = JSON.parse(res.data.value);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setDeliveryNoticeTemplates(parsed);
                    }
                } catch (e) { }
            }
        }).catch(() => { });
    }, [order]);

    // Fetch combo components for COMBO products
    useEffect(() => {
        const comboItems = (order.items || []).filter((item: any) => {
            const productInfo = products.find((p: any) => p.value === item.sku);
            return productInfo?.type === 'COMBO';
        });
        if (comboItems.length === 0) return;

        const fetchComboComponents = async () => {
            const map: Record<string, any[]> = {};
            for (const item of comboItems) {
                try {
                    const res = await api.get(`/products/combo/${item.sku}`);
                    map[item.sku] = Array.isArray(res.data) ? res.data : [];
                } catch { map[item.sku] = []; }
            }
            setComboComponentsMap(map);
        };
        fetchComboComponents();
    }, [order?.items, products]);

    // Use order.items for ordered quantities
    const summaryData = (order.items || []).map((item: any) => {
        const ordered = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;

        let delivered = 0;
        let pending = 0;
        history.forEach((d: any) => {
            if (d.status === 'DRAFT') return; // Bỏ qua phiếu nháp
            const found = d.items?.find((di: any) => di.sku === item.sku);
            if (found) {
                if (d.status === 'SHIPPED' || d.status === 'COMPLETED') {
                    delivered += Number(found.quantity);
                } else { // PENDING_EXPORT or others
                    pending += Number(found.quantity);
                }
            }
        });

        const remaining = Math.max(0, ordered - delivered - pending);

        // Lookup stock from products list
        const productInfo = products.find((p: any) => p.value === item.sku);
        const isCombo = productInfo?.type === 'COMBO';
        const totalStock = productInfo ? Number(productInfo.quantity_in_stock || 0) : 0;
        const bookingStock = productInfo ? Number(productInfo.approved_booking_stock || 0) : 0;
        let stock = Math.max(0, totalStock - bookingStock);

        // Build combo children with individual stock info
        let comboChildren: any[] = [];
        if (isCombo && comboComponentsMap[item.sku]) {
            let minAvailableCombo = Infinity;
            comboChildren = comboComponentsMap[item.sku].map((comp: any) => {
                const childProduct = products.find((p: any) => p.value === comp.child_product?.sku);
                const childTotalStock = childProduct ? Number(childProduct.quantity_in_stock || 0) : 0;
                const childBookingStock = childProduct ? Number(childProduct.approved_booking_stock || 0) : 0;
                const childAvailable = Math.max(0, childTotalStock - childBookingStock);
                const qtyPerCombo = Number(comp.quantity) || 1;
                const totalNeeded = remaining * qtyPerCombo;
                
                const possibleCombo = Math.floor(childAvailable / qtyPerCombo);
                if (possibleCombo < minAvailableCombo) minAvailableCombo = possibleCombo;

                return {
                    sku: comp.child_product?.sku || '',
                    name: comp.child_product?.name || '',
                    quantity_per_combo: qtyPerCombo,
                    total_needed: totalNeeded,
                    available: childAvailable,
                    sufficient: childAvailable >= totalNeeded
                };
            });
            
            if (minAvailableCombo !== Infinity) {
                stock = minAvailableCombo;
            } else {
                stock = 0;
            }
        }


        return {
            id: item.id,
            sku: item.sku,
            name: item.product?.name || productInfo?.label || item.sku,
            unitPrice: price,
            stock,
            ordered,
            delivered,
            pending,
            remaining,
            totalVal: ordered * price,
            deliveredVal: delivered * price,
            pendingVal: pending * price,
            remainingVal: remaining * price,
            bookingStatus: item.booking_status || 'NONE',
            bookedQuantity: item.booked_quantity || 0,
            isCombo,
            comboChildren
        };
    });

    const [bookingLoadingId, setBookingLoadingId] = useState<number | null>(null);

    const handleBookSingleItem = async (item: any) => {
        if (!order?.id) return;
        try {
            setBookingLoadingId(item.id);
            const res = await api.post(`/sales/${order.id}/book-items`, {
                items: [{ itemId: item.id, quantity: item.remaining }]
            });
            if (res.data?.success === false) {
                message.error(res.data.errors?.join(', ') || 'Không thể giữ kho');
            } else {
                message.success(res.data?.message || 'Đã giữ kho thành công');
                onSuccess();
            }
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi giữ kho');
        } finally {
            setBookingLoadingId(null);
        }
    };

    // Helper methods for Delivery Notice
    const handleNoticeTemplateSelect = (tplId: string, currentShipItems = shipItems, customShipDate = shipDate, customAddress = shipAddress, customContactName = shipContactName, customContactPhone = shipContactPhone, customCarrier = shippingCarrier, customIsCod = isCod, customPickMoney = pickMoney, customLegs = shippingLegs) => {
        setSelectedNoticeTemplateId(tplId);
        const tpl = deliveryNoticeTemplates.find(t => t.id === tplId) || deliveryNoticeTemplates[0] || DEFAULT_DELIVERY_NOTICE_TEMPLATES[0];
        if (!tpl) return;
        const generated = formatDeliveryNotice(tpl.content, {
            order,
            delivery: {
                id: editingDeliveryId,
                code: editingDeliveryId ? (history.find(h => h.id === editingDeliveryId)?.code) : `PXK-${dayjs(customShipDate || shipDate).format('DDMMYY')}-XXXX`,
                delivery_date: customShipDate || shipDate,
                delivery_address: customAddress !== undefined ? customAddress : shipAddress,
                contact_name: customContactName !== undefined ? customContactName : shipContactName,
                contact_phone: customContactPhone !== undefined ? customContactPhone : shipContactPhone,
                shipping_carrier: customCarrier !== undefined ? customCarrier : shippingCarrier
            },
            shipItems: currentShipItems || shipItems,
            shipDate: customShipDate || shipDate,
            shipAddress: customAddress !== undefined ? customAddress : shipAddress,
            shipContactName: customContactName !== undefined ? customContactName : shipContactName,
            shipContactPhone: customContactPhone !== undefined ? customContactPhone : shipContactPhone,
            shippingCarrier: customCarrier !== undefined ? customCarrier : shippingCarrier,
            shippingLegs: customLegs !== undefined ? customLegs : shippingLegs,
            isCod: customIsCod !== undefined ? customIsCod : isCod,
            pickMoney: customPickMoney !== undefined ? customPickMoney : pickMoney,
            companyConfig: companyConfig || {},
            products: products
        });
        setDeliveryNotice(generated);
    };

    const handleRegenerateNotice = () => {
        const tpl = deliveryNoticeTemplates.find(t => t.id === selectedNoticeTemplateId) || deliveryNoticeTemplates[0] || DEFAULT_DELIVERY_NOTICE_TEMPLATES[0];
        const generated = formatDeliveryNotice(tpl.content, {
            order,
            delivery: {
                id: editingDeliveryId,
                code: editingDeliveryId ? (history.find(h => h.id === editingDeliveryId)?.code) : `PXK-${dayjs(shipDate).format('DDMMYY')}-XXXX`,
                delivery_date: shipDate,
                delivery_address: shipAddress,
                contact_name: shipContactName,
                contact_phone: shipContactPhone,
                shipping_carrier: shippingCarrier
            },
            shipItems: shipItems,
            shipDate: shipDate,
            shipAddress: shipAddress,
            shipContactName: shipContactName,
            shipContactPhone: shipContactPhone,
            shippingCarrier: shippingCarrier,
            shippingLegs: shippingLegs,
            isCod: isCod,
            pickMoney: pickMoney,
            companyConfig: companyConfig || {},
            products: products
        });
        setDeliveryNotice(generated);
        message.success('Đã cập nhật lại nội dung thông báo theo dữ liệu phiếu xuất!');
    };

    const handleCopyNotice = (text: string) => {
        if (!text) {
            message.warning('Chưa có nội dung để sao chép');
            return;
        }
        navigator.clipboard.writeText(text);
        message.success('Đã sao chép nội dung thông báo vào bộ nhớ tạm (Clipboard)!');
    };

    const openViewNoticeModal = (delivery: any) => {
        setSelectedDeliveryForNotice(delivery);
        if (delivery.delivery_notice) {
            setEditingSavedNotice(delivery.delivery_notice);
        } else {
            const defaultTpl = deliveryNoticeTemplates.find(t => t.isDefault) || deliveryNoticeTemplates[0] || DEFAULT_DELIVERY_NOTICE_TEMPLATES[0];
            const generated = formatDeliveryNotice(defaultTpl.content, {
                order,
                delivery,
                shipItems: delivery.items || [],
                shipDate: delivery.delivery_date,
                shipAddress: delivery.delivery_address,
                shipContactName: delivery.contact_name,
                shipContactPhone: delivery.contact_phone,
                shippingCarrier: delivery.shipping_carrier,
                shippingLegs: delivery.shipping_legs || [],
                isCod: Number(delivery.pick_money) > 0,
                pickMoney: delivery.pick_money,
                companyConfig: companyConfig || {},
                products
            });
            setEditingSavedNotice(generated);
        }
        setViewNoticeModalOpen(true);
    };

    // Multi-Leg Shipping Handlers
    const handleAddLeg = () => {
        const newIndex = shippingLegs.length + 1;
        const newLeg: ShippingLeg = {
            id: `leg_${Date.now()}`,
            leg_name: `Chặng ${newIndex}: `,
            carrier_name: '',
            carrier_phone: '',
            tracking_code: '',
            shipping_fee: 0,
            payer: 'shop',
            status: 'pending',
            notes: ''
        };
        setShippingLegs(prev => [...prev, newLeg]);
    };

    const handleRemoveLeg = (index: number) => {
        setShippingLegs(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleUpdateLeg = (index: number, field: keyof ShippingLeg, val: any) => {
        setShippingLegs(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: val };
            return updated;
        });
    };

    const handleApplyChanhXePreset = () => {
        const legs: ShippingLeg[] = [
            {
                id: `leg_1_${Date.now()}`,
                leg_name: '1. Kho ➔ Chành xe',
                carrier_name: 'Xe nội bộ / Giao vận',
                carrier_phone: '',
                tracking_code: '',
                shipping_fee: 0,
                payer: 'shop',
                status: 'delivered',
                notes: 'Vận chuyển hàng ra bến/chành'
            },
            {
                id: `leg_2_${Date.now()}`,
                leg_name: '2. Chành xe ➔ Bến tỉnh',
                carrier_name: shippingCarrier || 'Chành xe liên tỉnh',
                carrier_phone: '',
                tracking_code: trackingCode || '',
                shipping_fee: shippingCost || 0,
                payer: isFreeship === 1 ? 'shop' : 'customer',
                status: 'delivering',
                notes: 'Chành xe chuyển hàng về địa phương'
            },
            {
                id: `leg_3_${Date.now()}`,
                leg_name: '3. Bến tỉnh ➔ Khách nhận',
                carrier_name: 'Khách nhận tại chành / Xe trung chuyển',
                carrier_phone: shipContactPhone || '',
                tracking_code: '',
                shipping_fee: 0,
                payer: 'customer',
                status: 'pending',
                notes: 'Giao tận tay khách hàng hoặc nhận tại bến'
            }
        ];
        setShippingLegs(legs);
        message.success('Đã áp dụng mẫu 3 chặng Chành xe (Kho ➔ Chành ➔ Tỉnh ➔ Khách)!');
    };

    const handleApplyDirectPreset = () => {
        const legs: ShippingLeg[] = [
            {
                id: `leg_1_${Date.now()}`,
                leg_name: 'Giao hàng trực tiếp',
                carrier_name: shippingCarrier || 'Đội xe / GHTK',
                carrier_phone: '',
                tracking_code: trackingCode || '',
                shipping_fee: shippingCost || 0,
                payer: isFreeship === 1 ? 'shop' : 'customer',
                status: 'pending',
                notes: 'Giao thẳng tới địa chỉ công trình / khách nhận'
            }
        ];
        setShippingLegs(legs);
        message.success('Đã áp dụng mẫu 1 chặng trực tiếp!');
    };

    const handleSyncLegsToShippingCost = () => {
        const shopTotal = shippingLegs
            .filter(l => String(l.payer || '').toLowerCase() === 'shop')
            .reduce((sum, l) => sum + (Number(l.shipping_fee !== undefined ? l.shipping_fee : l.shipping_cost) || 0), 0);
        setShippingCost(shopTotal);
        message.success(`Đã cập nhật Chi phí VC (Shop trả): ${shopTotal.toLocaleString()}đ`);
    };

    const handleSyncLegsToNotice = () => {
        const tpl = deliveryNoticeTemplates.find(t => t.id === selectedNoticeTemplateId) || deliveryNoticeTemplates[0] || DEFAULT_DELIVERY_NOTICE_TEMPLATES[0];
        const generated = formatDeliveryNotice(tpl.content, {
            order,
            delivery: {
                id: editingDeliveryId,
                code: editingDeliveryId ? (history.find(h => h.id === editingDeliveryId)?.code) : `PXK-${dayjs(shipDate).format('DDMMYY')}-XXXX`,
                delivery_date: shipDate,
                delivery_address: shipAddress,
                contact_name: shipContactName,
                contact_phone: shipContactPhone,
                shipping_carrier: shippingCarrier
            },
            shipItems: shipItems,
            shipDate: shipDate,
            shipAddress: shipAddress,
            shipContactName: shipContactName,
            shipContactPhone: shipContactPhone,
            shippingCarrier: shippingCarrier,
            shippingLegs: shippingLegs,
            isCod: isCod,
            pickMoney: pickMoney,
            companyConfig: companyConfig || {},
            products: products
        });
        setDeliveryNotice(generated);
        message.success('Đã đồng bộ thông tin đa chặng vào nội dung thông báo giao hàng!');
    };

    // ZNS Delivery Handlers
    const openSendDeliveryZnsModal = (delivery: any) => {
        setSelectedDeliveryForZns(delivery);
        const candidatePhone = delivery.contact_phone || order.contact_phone || order.receiver_phone || order.customer?.phone || '';
        setZnsDeliveryPhone(candidatePhone);
        const candidateName = delivery.contact_name || order.receiver_name || order.contact_name || order.customer?.name || 'Quý khách';
        setZnsDeliveryRecipientName(candidateName);
        setDeliveryZnsResult(null);
        setZnsDeliveryModalOpen(true);
    };

    const handleConfirmSendDeliveryZns = async () => {
        if (!selectedDeliveryForZns?.id) return;
        if (!znsDeliveryPhone) {
            message.error('Vui lòng nhập số điện thoại người nhận');
            return;
        }
        setIsSendingDeliveryZns(true);
        setDeliveryZnsResult(null);
        try {
            const res = await api.post(`/zns/deliveries/${selectedDeliveryForZns.id}/send-notice`, {
                phone: znsDeliveryPhone,
                recipient_name: znsDeliveryRecipientName
            });
            setDeliveryZnsResult(res.data);
            if (res.data?.success) {
                message.success('Đã gửi thông báo giao hàng ZNS qua Zalo OA thành công!');
            } else {
                message.warning(`Gửi ZNS: ${res.data?.message || 'Có lỗi xảy ra'}`);
            }
            fetchHistory();
        } catch (e: any) {
            const errMsg = e.response?.data?.message || 'Lỗi kết nối khi gửi tin nhắn ZNS';
            message.error(errMsg);
            setDeliveryZnsResult({ success: false, message: errMsg });
        } finally {
            setIsSendingDeliveryZns(false);
        }
    };

    const handleSaveDeliveryNoticeOnly = async () => {
        if (!selectedDeliveryForNotice?.id) return;
        try {
            setIsSavingNotice(true);
            await api.put(`/sales/delivery/${selectedDeliveryForNotice.id}`, {
                delivery_notice: editingSavedNotice
            });
            message.success('Đã lưu nội dung thông báo giao hàng');
            setViewNoticeModalOpen(false);
            fetchHistory();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi lưu thông báo');
        } finally {
            setIsSavingNotice(false);
        }
    };

    const openCreateModal = (preset: 'none' | 'chanh_xe' | 'direct' = 'none') => {
        setEditingDeliveryId(null);
        setIsDraft(false);
        setShipStatus('PENDING_EXPORT');
        const initialShipItems = summaryData.map((d: any) => {
            const canShip = (d.bookingStatus === 'CONFIRMED' || (d.stock || 0) > 0) && d.remaining > 0;
            return {
                sku: d.sku, 
                name: d.name || d.sku,
                unitPrice: d.unitPrice || 0,
                max: d.remaining, 
                stock: d.stock || 0,
                quantity: canShip ? d.remaining : (d.remaining > 0 ? d.remaining : 0),
                bookingStatus: d.bookingStatus
            };
        });
        setShipItems(initialShipItems);
        setShipNote('');

        // Auto-fill defaults
        setShipDate(dayjs());
        setAttachments([]);
        setTrackingCode('');
        setShippingCost(0);
        setEstimatedFeeInfo(null);

        if (preset === 'chanh_xe') {
            const defaultLegs: ShippingLeg[] = [
                {
                    id: `leg_1_${Date.now()}`,
                    leg_name: '1. Kho ➔ Chành xe',
                    carrier_name: 'Xe nội bộ / Giao vận',
                    carrier_phone: '',
                    tracking_code: '',
                    shipping_fee: 0,
                    payer: 'shop',
                    status: 'delivered',
                    notes: 'Vận chuyển hàng ra bến/chành'
                },
                {
                    id: `leg_2_${Date.now()}`,
                    leg_name: '2. Chành xe ➔ Bến tỉnh',
                    carrier_name: order?.shipping_carrier || 'Chành xe liên tỉnh (Tô Châu/Phương Trang...)',
                    carrier_phone: '',
                    tracking_code: '',
                    shipping_fee: 0,
                    payer: 'customer',
                    status: 'delivering',
                    notes: 'Chành xe chuyển hàng về địa phương'
                },
                {
                    id: `leg_3_${Date.now()}`,
                    leg_name: '3. Bến tỉnh ➔ Khách nhận',
                    carrier_name: 'Khách nhận tại chành / Xe trung chuyển',
                    carrier_phone: order?.receiver_phone || order?.contact_phone || '',
                    tracking_code: '',
                    shipping_fee: 0,
                    payer: 'customer',
                    status: 'pending',
                    notes: 'Giao tận tay khách hàng hoặc nhận tại bến'
                }
            ];
            setShippingLegs(defaultLegs);
        } else if (preset === 'direct') {
            const defaultLegs: ShippingLeg[] = [
                {
                    id: `leg_1_${Date.now()}`,
                    leg_name: 'Giao hàng trực tiếp',
                    carrier_name: order?.shipping_carrier || 'Đội xe / GHTK',
                    carrier_phone: '',
                    tracking_code: '',
                    shipping_fee: 0,
                    payer: 'shop',
                    status: 'pending',
                    notes: 'Giao thẳng tới địa chỉ công trình / khách nhận'
                }
            ];
            setShippingLegs(defaultLegs);
        } else {
            setShippingLegs([]);
        }

        // Bóc tách thông tin ghi chú đơn hàng website
        const parsed = parseWebsiteOrderNote(order?.note, order);
        setWebsiteOrderParsed(parsed);

        let initialAddress = '';
        let initialContactName = '';
        let initialContactPhone = '';
        let initialCarrier = '';
        let initialIsCod = false;
        let initialPickMoney = 0;

        if (parsed.isWebsiteOrder) {
            initialAddress = parsed.shippingAddress || order.shipping_address || fullCustomer?.address || '';
            initialContactName = parsed.receiverName || order.receiver_name || contactList[0]?.full_name || fullCustomer?.name || '';
            initialContactPhone = parsed.receiverPhone || order.receiver_phone || contactList[0]?.phone || fullCustomer?.phone || '';
            initialCarrier = 'GHTK';
            initialIsCod = parsed.isCod;
            initialPickMoney = parsed.suggestedCodAmount;

            setShipAddress(initialAddress);
            setShipContactName(initialContactName);
            setShipContactPhone(initialContactPhone);
            setShipNote(parsed.deliveryNote || '');
            setIsCod(parsed.isCod);
            setPickMoney(parsed.suggestedCodAmount);
            setShippingCarrier('GHTK'); // Gợi ý GHTK cho đơn web
            setPushToGhtkDirectly(true);
            setIsFreeship(1);
            setPackageWeight(500);

            if (parsed.addressParts) {
                setGhtkProvince(parsed.addressParts.province || '');
                setGhtkDistrict(parsed.addressParts.district || '');
                setGhtkWard(parsed.addressParts.ward || '');
                setGhtkHamlet(parsed.addressParts.hamlet || 'Khác');
                setGhtkAddress(parsed.addressParts.street || parsed.shippingAddress || '');
            }
        } else {
            initialAddress = order.shipping_address || fullCustomer?.address || '';
            initialContactName = order.receiver_name || contactList[0]?.full_name || fullCustomer?.name || '';
            initialContactPhone = order.receiver_phone || contactList[0]?.phone || fullCustomer?.phone || '';
            initialCarrier = order.shipping_carrier || '';
            initialIsCod = false;
            initialPickMoney = 0;

            setShipAddress(initialAddress);
            setShipContactName(initialContactName);
            setShipContactPhone(initialContactPhone);
            setShipNote('');
            setShippingCarrier(order.shipping_carrier || '');
            setIsCod(false);
            setPickMoney(0);
            setIsFreeship(1);
            setPackageWeight(500);
            setPushToGhtkDirectly(false);
            setGhtkProvince('');
            setGhtkDistrict('');
            setGhtkWard('');
            setGhtkHamlet('Khác');
            setGhtkAddress('');
        }

        // Initialize Delivery Notice from default template
        const defaultTpl = deliveryNoticeTemplates.find(t => t.isDefault) || deliveryNoticeTemplates[0] || DEFAULT_DELIVERY_NOTICE_TEMPLATES[0];
        setSelectedNoticeTemplateId(defaultTpl?.id || 'standard_b2b');
        const initNotice = formatDeliveryNotice(defaultTpl?.content || '', {
            order,
            delivery: { code: `PXK-${dayjs().format('DDMMYY')}-XXXX` },
            shipItems: initialShipItems,
            shipDate: dayjs(),
            shipAddress: initialAddress,
            shipContactName: initialContactName,
            shipContactPhone: initialContactPhone,
            shippingCarrier: initialCarrier,
            isCod: initialIsCod,
            pickMoney: initialPickMoney,
            companyConfig: companyConfig || {},
            products
        });
        setDeliveryNotice(initNotice);

        // Reset packing specs & dimensions state
        setSelectedPackingSpecId(null);
        setPackageLength(null);
        setPackageWidth(null);
        setPackageHeight(null);
        setPackageCount(1);
        setPackingSpecName('');
        setPackageActualWeight(null);
        fetchPackingSpecs();

        // Reset Lalamove modal states
        setLalamoveEstimatedFeeInfo(null);
        const recVehicle = getRecommendedLalamoveVehicle(500, null, null, null);
        setLalamoveModalServiceType(recVehicle);
        setPushToLalamoveDirectly(true);
        fetchLalamoveConfig();

        fetchGhtkPickAddresses();
        setIsModalOpen(true);
    };

    const openEditModal = (delivery: any) => {
        setEditingDeliveryId(delivery.id);
        setIsDraft(delivery.status === 'DRAFT');
        setShipStatus(delivery.status || 'PENDING_EXPORT');
        setShipDate(dayjs(delivery.delivery_date));
        setShipAddress(delivery.delivery_address || '');
        setShipContactName(delivery.contact_name || '');
        setShipContactPhone(delivery.contact_phone || '');
        setShipNote(delivery.note || '');
        setAttachments(delivery.attachments || []);

        // Load shipping carrier fields
        setShippingCarrier(delivery.shipping_carrier || '');
        setTrackingCode(delivery.tracking_code || '');
        setShippingCost(Number(delivery.shipping_cost) || 0);
        setPickMoney(Number(delivery.pick_money) || 0);
        setIsCod(Number(delivery.pick_money) > 0);
        setIsFreeship(delivery.is_freeship !== undefined ? Number(delivery.is_freeship) : 1);
        setPackageWeight(Number(delivery.weight_gram) || 500);
        setPushToGhtkDirectly(false);
        setPushToLalamoveDirectly(false);
        setShippingLegs(delivery.shipping_legs && Array.isArray(delivery.shipping_legs) ? delivery.shipping_legs : []);

        // Lalamove edit states
        setLalamoveEstimatedFeeInfo(null);
        if (delivery.shipping_metadata?.lalamove?.serviceType) {
            setLalamoveModalServiceType(delivery.shipping_metadata.lalamove.serviceType);
        } else {
            const recV = getRecommendedLalamoveVehicle(delivery.weight_gram, delivery.package_length, delivery.package_width, delivery.package_height);
            setLalamoveModalServiceType(recV);
        }
        fetchLalamoveConfig();

        // Load packing specs & dimensions
        setPackageLength(delivery.package_length !== null && delivery.package_length !== undefined ? Number(delivery.package_length) : null);
        setPackageWidth(delivery.package_width !== null && delivery.package_width !== undefined ? Number(delivery.package_width) : null);
        setPackageHeight(delivery.package_height !== null && delivery.package_height !== undefined ? Number(delivery.package_height) : null);
        setPackageCount(delivery.package_count || 1);
        setPackingSpecName(delivery.packing_spec_name || '');
        setPackageActualWeight(null);

        const matched = packingSpecs.find((s: any) => s.name === delivery.packing_spec_name);
        if (matched) {
            setSelectedPackingSpecId(matched.id);
            setPackageActualWeight(Number(matched.weight_gram) || null);
        } else {
            setSelectedPackingSpecId(null);
        }
        fetchPackingSpecs();

        // Check if note has parsed info
        const parsed = parseWebsiteOrderNote(order?.note, order);
        setWebsiteOrderParsed(parsed);

        // Calculate Ship Items
        // Merge Order Items (summaryData) with Delivery Items
        const mergedItems = summaryData.map((d: any) => {
            const deliveredItem = delivery.items?.find((i: any) => i.sku === d.sku);
            const currentQtyInDelivery = deliveredItem ? Number(deliveredItem.quantity) : 0;
            const max = d.remaining + currentQtyInDelivery;

            return {
                sku: d.sku, 
                name: d.name || d.sku,
                unitPrice: d.unitPrice || 0,
                max: max, 
                stock: d.stock || 0,
                quantity: currentQtyInDelivery,
                bookingStatus: d.bookingStatus
            };
        });
        setShipItems(mergedItems);

        // Delivery Notice in Edit Modal
        if (delivery.delivery_notice) {
            setDeliveryNotice(delivery.delivery_notice);
        } else {
            const defaultTpl = deliveryNoticeTemplates.find(t => t.isDefault) || deliveryNoticeTemplates[0] || DEFAULT_DELIVERY_NOTICE_TEMPLATES[0];
            setSelectedNoticeTemplateId(defaultTpl?.id || 'standard_b2b');
            const generated = formatDeliveryNotice(defaultTpl?.content || '', {
                order,
                delivery,
                shipItems: mergedItems,
                shipDate: dayjs(delivery.delivery_date),
                shipAddress: delivery.delivery_address || '',
                shipContactName: delivery.contact_name || '',
                shipContactPhone: delivery.contact_phone || '',
                shippingCarrier: delivery.shipping_carrier || '',
                isCod: Number(delivery.pick_money) > 0,
                pickMoney: Number(delivery.pick_money) || 0,
                companyConfig: companyConfig || {},
                products
            });
            setDeliveryNotice(generated);
        }

        fetchGhtkPickAddresses();
        setIsModalOpen(true);
    };

    const openUploadModal = (delivery: any) => {
        setUploadDeliveryId(delivery.id);
        setUploadAttachments(delivery.attachments || []);
        setUploadModalOpen(true);
    };

    const handleUploadSave = async () => {
        if (!uploadDeliveryId) return;
        try {
            await api.put(`/sales/delivery/${uploadDeliveryId}`, {
                attachments: uploadAttachments
            });
            message.success('Đã cập nhật chứng từ');
            setUploadModalOpen(false);
            fetchHistory();
        } catch (e) {
            message.error('Lỗi cập nhật');
        }
    };

    const handleShip = async () => {
        try {
            const isGhtk = (shippingCarrier || '').toUpperCase().includes('GHTK');
            const payload = {
                code: editingDeliveryId ? undefined : `PXK-${dayjs(shipDate).format('DDMMYY')}-${Math.floor(1000 + Math.random() * 9000)}`,
                date: shipDate ? shipDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                note: shipNote,
                delivery_address: shipAddress,
                contact_name: shipContactName,
                contact_phone: shipContactPhone,
                items: shipItems.filter(i => i.quantity > 0),
                attachments: attachments,
                shipping_carrier: shippingCarrier,
                tracking_code: trackingCode,
                shipping_cost: shippingCost,
                shipping_provider: isGhtk ? 'GHTK' : 'OTHER',
                pick_money: isCod ? pickMoney : 0,
                is_freeship: isFreeship,
                weight_gram: packageWeight,
                package_length: packageLength !== null && packageLength !== undefined ? Number(packageLength) : null,
                package_width: packageWidth !== null && packageWidth !== undefined ? Number(packageWidth) : null,
                package_height: packageHeight !== null && packageHeight !== undefined ? Number(packageHeight) : null,
                package_count: packageCount || 1,
                packing_spec_name: packingSpecName || null,
                shipping_legs: shippingLegs,
                delivery_notice: deliveryNotice,
                status: isDraft ? 'DRAFT' : (editingDeliveryId ? shipStatus : 'PENDING_EXPORT')
            };

            if (editingDeliveryId) {
                await api.put(`/sales/delivery/${editingDeliveryId}`, payload);
                message.success('Đã cập nhật phiếu xuất kho');
            } else {
                const res = await api.post(`/sales/${order.id}/delivery`, payload);
                const newDeliveryId = res.data?.id;

                // Tự động đẩy vận đơn sang GHTK nếu được chọn
                if (newDeliveryId && isGhtk && pushToGhtkDirectly && !isDraft) {
                    try {
                        const deliveryProducts = shipItems.filter(i => Number(i.quantity) > 0).map(i => {
                            const soItem = order?.items?.find((si: any) => si.sku === i.sku);
                            const pInfo = products.find((p: any) => p.value === i.sku);
                            return {
                                name: i.name || soItem?.product?.name || pInfo?.label || i.sku,
                                quantity: Number(i.quantity),
                                product_code: i.sku,
                                price: Number(soItem?.unit_price) || 0
                            };
                        });
                        const deliveryTotalValue = deliveryProducts.reduce((sum: number, p: any) => sum + (Number(p.price || 0) * Number(p.quantity || 1)), 0);

                        // Tự động kiểm tra và sửa nếu Quận/Huyện bị gán nhầm thành Phường
                        let modalDist = extractAddressString(ghtkDistrict);
                        const modalProv = extractAddressString(ghtkProvince);
                        const modalWard = extractAddressString(ghtkWard);
                        if (modalDist && (modalDist.toLowerCase().startsWith('phường') || modalDist.toLowerCase().startsWith('p.') || (modalWard && modalDist.toLowerCase() === modalWard.toLowerCase()))) {
                            const provStr = modalProv.toLowerCase();
                            const matchedP = VIETNAM_PROVINCES.find(pr => pr.standard.toLowerCase() === provStr || pr.names.some(n => provStr.includes(n)));
                            if (matchedP?.defaultCity) {
                                modalDist = matchedP.defaultCity;
                                setGhtkDistrict(modalDist);
                            }
                        }

                        const pushRes = await api.post(`/shipping/delivery/${newDeliveryId}/push-ghtk`, {
                            pick_address_id: selectedPickAddressId || ghtkConfig?.defaultPickAddressId,
                            pick_option: ghtkPickOption,
                            province: modalProv,
                            district: modalDist,
                            ward: modalWard,
                            hamlet: extractAddressString(ghtkHamlet, 'Khác'),
                            address: extractAddressString(ghtkAddress || shipAddress),
                            note: shipNote,
                            weight_gram: packageWeight || 500,
                            pick_money: isCod ? pickMoney : 0,
                            is_freeship: isFreeship,
                            package_length: packageLength !== null && packageLength !== undefined ? Number(packageLength) : null,
                            package_width: packageWidth !== null && packageWidth !== undefined ? Number(packageWidth) : null,
                            package_height: packageHeight !== null && packageHeight !== undefined ? Number(packageHeight) : null,
                            package_count: packageCount || 1,
                            packing_spec_name: packingSpecName || null,
                            value: deliveryTotalValue > 0 ? deliveryTotalValue : (Number(order?.total_amount) || 0),
                            products: deliveryProducts
                        });
                        const isMockPush = pushRes.data?.is_mock;
                        message.success({ 
                            content: isMockPush
                                ? `Đã tạo phiếu & mã vận đơn GHTK mô phỏng: ${pushRes.data?.tracking_code} (Chưa cấu hình Token GHTK)`
                                : `Xuất kho & tạo vận đơn GHTK thành công! Mã VĐ: ${pushRes.data?.tracking_code}`, 
                            key: 'ghtk_push', 
                            duration: 5 
                        });
                    } catch (pushErr: any) {
                        message.warning({
                            content: `Đã tạo phiếu xuất kho nhưng chưa tạo được vận đơn GHTK: ${pushErr.response?.data?.message || pushErr.message}. Bạn có thể bấm "Đẩy GHTK" sau.`,
                            key: 'ghtk_push',
                            duration: 6
                        });
                    }
                } else if (newDeliveryId && shippingCarrier === 'LALAMOVE' && pushToLalamoveDirectly && !isDraft) {
                    try {
                        const pushRes = await api.post(`/shipping/delivery/${newDeliveryId}/push-lalamove`, {
                            serviceType: lalamoveModalServiceType || 'VAN_500KG',
                            recipientName: shipContactName || 'Người nhận hàng',
                            recipientPhone: shipContactPhone || '+84900000000',
                            recipientAddress: extractAddressString(shipAddress),
                            remarks: shipNote || `Giao hàng đơn ${order.code}`,
                            isPODEnabled: true,
                        });
                        const isMockPush = pushRes.data?.is_mock;
                        message.success({
                            content: isMockPush
                                ? `[Mô phỏng] Đã tạo cuốc xe Lalamove Demo: ${pushRes.data?.tracking_code}`
                                : `Xuất kho & đặt xe Lalamove thành công! Mã đơn: ${pushRes.data?.tracking_code}`,
                            duration: 6
                        });
                    } catch (pushErr: any) {
                        message.warning({
                            content: `Đã tạo phiếu xuất kho nhưng chưa đặt được cuốc xe Lalamove: ${pushErr.response?.data?.message || pushErr.message}. Bạn có thể bấm "Đặt xe Lalamove" sau.`,
                            duration: 6
                        });
                    }
                } else {
                    message.success('Đã xuất kho thành công');
                }
            }

            setIsModalOpen(false); 
            fetchHistory(); 
            onSuccess();
        } catch (e: any) { 
            message.error(e.response?.data?.message || 'Lỗi lưu phiếu xuất kho'); 
        }
    };

    const handlePrint = (delivery: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Map Items for Print
        const printItems = (delivery.items || []).map((di: any, idx: number) => {
            const product = products.find(p => p.value === di.sku);
            // Fallback for color/variant if stored in order items
            const orderItem = order?.items?.find((oi: any) => oi.sku === di.sku);

            const defaultName = product ? (product.name || product.label?.split(' - ')[1] || product.label) : di.sku;
            return {
                index: idx + 1,
                name: orderItem?.vat_content || orderItem?.vat_description || defaultName,
                sku: di.sku,
                unit: product?.unit || 'Cái',
                qty: di.quantity,
                note: orderItem?.variant_color || di.note || '' // Try to show variant color/note
            };
        });

        // Resolve Info
        const dAddr = delivery.delivery_address || (order.shipping_address || order.customer?.address || '-');

        // IMPORTANT: Must use delivery specific contact first, usually saved in delivery.contact_name
        const dContactName = delivery.contact_name || (order.receiver_name || order.customer?.name || '-');
        const dContactPhone = delivery.contact_phone || (order.receiver_phone || order.customer?.phone || '');

        // Format: Name - Phone
        const fullContact = dContactPhone ? `${dContactName} - ${dContactPhone}` : dContactName;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>In Phiếu Xuất Kho - ${delivery.code}</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; padding: 20px; font-size: 14px; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #0050b3; padding-bottom: 10px; }
                    .company-info { width: 60%; }
                    .company-info h1 { margin: 0; color: #0050b3; font-size: 24px; text-transform: uppercase; }
                    .company-info p { margin: 2px 0; font-size: 13px; }
                    .header-logo { width: 60%; text-align: left; }
                    .title-section { text-align: center; width: 40%; }
                    .title-section h2 { margin: 0 0 5px; font-size: 24px; text-transform: uppercase; }
                    .info-grid { margin-bottom: 20px; }
                    .info-row { display: flex; margin-bottom: 8px; }
                    .info-label { width: 130px; font-weight: bold; }
                    .info-val { flex: 1; }

                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                    th { background-color: #fce4d6; font-weight: bold; }

                    .footer { display: flex; justify-content: space-between; text-align: center; margin-top: 50px; }
                    .footer-col { width: 30%; }
                    .footer-col .role { font-weight: bold; margin-bottom: 80px; }
                    .note-bottom { font-style: italic; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-logo">
                        <img src="${window.location.origin}/company_header.png" alt="Company Header" style="max-height: 80px; max-width: 100%;" />
                    </div>
                    <div class="title-section">
                        <h2>PHIẾU XUẤT KHO</h2>
                        <div style="font-style:italic; font-size: 14px;">Ngày ${dayjs(delivery.delivery_date).format('DD')} tháng ${dayjs(delivery.delivery_date).format('MM')} năm ${dayjs(delivery.delivery_date).format('YYYY')}</div>
                        <div style="margin-top:5px; font-size:12px; font-style:italic;">Số PXK: <b>${delivery.code}</b></div>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-row">
                        <div class="info-label">Khách hàng:</div>
                        <div class="info-val" style="text-transform:uppercase; font-weight:bold;">${order.customer_name || order.customer?.name}</div>
                        <div style="font-size:12px;">Số BG: <b>${order.order_code}</b></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Địa chỉ giao hàng:</div>
                        <div class="info-val">${dAddr}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Liên hệ:</div>
                        <div class="info-val">${fullContact}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Xuất tại kho:</div>
                        <div class="info-val">Kho Thành Phẩm (Trung tâm)</div>
                    </div>
                    ${delivery.packing_spec_name || delivery.package_length ? `
                    <div class="info-row">
                        <div class="info-label">Quy cách đóng gói:</div>
                        <div class="info-val">
                            <b>${delivery.packing_spec_name || 'Đóng gói chuẩn'}</b>
                            ${delivery.package_count ? ` - <b>${delivery.package_count}</b> kiện` : ''} 
                            ${delivery.package_length ? ` (KT: ${delivery.package_length}x${delivery.package_width}x${delivery.package_height} cm)` : ''}
                            ${delivery.weight_gram ? ` - TL cước: ${delivery.weight_gram}g` : ''}
                        </div>
                    </div>` : ''}
                    ${delivery.note ? `<div class="info-row"><div class="info-label">Ghi chú phiếu:</div><div class="info-val">${delivery.note}</div></div>` : ''}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">STT</th>
                            <th>Tên Sản phẩm</th>
                            <th style="width: 80px;">ĐVT</th>
                            <th style="width: 80px;">Số lượng</th>
                            <th style="width: 150px;">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${printItems.map((item: any) => `
                        <tr>
                            <td>${item.index}</td>
                            <td style="text-align:left;">
                                <div style="font-weight:bold;">${item.name}</div>
                                <div style="font-size:12px; font-style:italic; color:#555;">${item.sku}</div>
                            </td>
                            <td>${item.unit}</td>
                            <td>${item.qty}</td>
                            <td style="text-align:left;">${item.note}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="footer-col">
                        <div class="role">Người nhận hàng</div>
                        <div>(Ký và ghi rõ họ tên)</div>
                    </div>
                    <div class="footer-col">
                        <div class="role">Người lập phiếu</div>
                        <div style="margin-top:70px; font-weight:bold;">${order.assigned_to?.full_name || 'Admin'}</div>
                    </div>
                    <div class="footer-col">
                        <div class="role">Thủ kho</div>
                        <div>(Ký xác nhận)</div>
                    </div>
                </div>

                <div class="note-bottom" style="text-align: center; font-weight: bold;">
                    Quý khách vui lòng ký nhận vào PXK này gửi lại cho NV giao hàng (TP. HCM) hoặc scan/chụp gửi xác nhận cho ERP4U (Ngoài TP.HCM).<br/>
                    Đây là cơ sở để xác nhận KH đã nhận đủ số lượng và ERP4U tiếp nhận giải quyết các vấn đề về hàng hóa.
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div>
            <div style={{ marginBottom: 20, background: '#f0f5ff', padding: 10, borderRadius: 6, border: '1px solid #adc6ff' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 5, color: '#1d39c4' }}>Tiến độ giao hàng:</div>
                <Table dataSource={summaryData} rowKey="sku" pagination={false} size="small" bordered scroll={{ x: 900 }}
                    expandable={{
                        expandedRowRender: (record: any) => {
                            if (!record.isCombo || !record.comboChildren?.length) return null;
                            return (
                                <div style={{ padding: '4px 0 4px 20px', background: '#fafafa' }}>
                                    <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6, color: '#722ed1' }}>
                                        <AppstoreOutlined /> Thành phần Combo ({record.comboChildren.length} sản phẩm con):
                                    </div>
                                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f0f0f0' }}>
                                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #e8e8e8' }}>SKU Con</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #e8e8e8' }}>Tên sản phẩm</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>SL/Combo</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>Cần</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>TK khả dụng</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {record.comboChildren.map((child: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8', fontWeight: 500 }}>{child.sku}</td>
                                                    <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8' }}>{child.name}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>x{child.quantity_per_combo}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8', fontWeight: 'bold' }}>{child.total_needed}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8', fontWeight: 'bold', color: child.sufficient ? '#52c41a' : '#f5222d' }}>{child.available}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>
                                                        {child.sufficient
                                                            ? <Tag color="green" style={{ margin: 0, fontSize: 11 }}>Đủ</Tag>
                                                            : <Tag color="red" style={{ margin: 0, fontSize: 11 }}>Thiếu {child.total_needed - child.available}</Tag>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        },
                        rowExpandable: (record: any) => record.isCombo && record.comboChildren?.length > 0,
                    }}
                    columns={[
                        { title: 'SKU', dataIndex: 'sku', render: (v: string, r: any) => (
                            <span>
                                {r.isCombo && <AppstoreOutlined style={{ color: '#722ed1', marginRight: 4 }} />}
                                {v}
                                {r.isCombo && <Tag color="purple" style={{ margin: '0 0 0 6px', fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>COMBO</Tag>}
                            </span>
                        )},
                        { title: 'Trạng thái', width: 100, align: 'center', render: (r: any) => {
                            if (r.remaining <= 0) return <Tag color="blue" style={{ margin: 0 }}>Đã giao đủ</Tag>;
                            if (r.bookingStatus === 'CONFIRMED') return <Tag color="green" style={{ margin: 0 }}>Sẵn sàng</Tag>;
                            if (r.bookingStatus === 'TEMPORARY') return <Tag color="orange" style={{ margin: 0 }}>Chưa duyệt</Tag>;
                            
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                                    <Tag style={{ margin: 0 }}>Chưa giữ kho</Tag>
                                    {r.remaining > 0 && (
                                        <Button 
                                            size="small" 
                                            type="primary" 
                                            ghost 
                                            loading={bookingLoadingId === r.id}
                                            onClick={() => handleBookSingleItem(r)}
                                            style={{ fontSize: 10, padding: '0 8px', height: 22 }}
                                        >
                                            Book kho
                                        </Button>
                                    )}
                                </div>
                            );
                        }},
                        { title: 'TK khả dụng', dataIndex: 'stock', align: 'center', width: 90, render: (v: any, r: any) => (
                            <span style={{ color: v > 0 ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}>
                                {v}
                                {r.isCombo && <Tooltip title="Expand để xem tồn kho từng SP con"><AppstoreOutlined style={{ marginLeft: 4, color: '#722ed1', fontSize: 11 }} /></Tooltip>}
                            </span>
                        )},
                        { title: 'SL Đặt', dataIndex: 'ordered', align: 'center', width: 70 },
                        { title: 'Chờ xuất', dataIndex: 'pending', align: 'center', width: 70, render: (v: any) => v > 0 ? <b style={{ color: '#faad14' }}>{v}</b> : <span style={{ color: '#ccc' }}>0</span> },
                        { title: 'Đã giao', dataIndex: 'delivered', align: 'center', width: 70, render: (v: any) => <b style={{ color: 'green' }}>{v}</b> },
                        { title: 'Còn lại', dataIndex: 'remaining', align: 'center', width: 70, render: (v: any) => v > 0 ? <b style={{ color: 'red' }}>{v}</b> : <CheckCircleOutlined style={{ color: 'green' }} /> },

                        { title: 'Tổng tiền hàng', dataIndex: 'totalVal', align: 'right', render: (v: number) => v.toLocaleString() },
                        { title: 'Đã giao (đ)', dataIndex: 'deliveredVal', align: 'right', render: (v: number) => <span style={{ color: 'green' }}>{v.toLocaleString()}</span> },
                        { title: 'Còn lại (đ)', dataIndex: 'remainingVal', align: 'right', render: (v: number) => <span style={{ color: 'red', fontWeight: 'bold' }}>{v.toLocaleString()}</span> },
                    ]}
                    summary={(pageData: readonly any[]) => {
                        let totalAmount = 0;
                        let totalDelivered = 0;
                        let totalPending = 0;
                        let totalRemaining = 0;

                        pageData.forEach((item) => {
                            totalAmount += (item.totalVal || 0);
                            totalDelivered += (item.deliveredVal || 0);
                            totalPending += (item.pendingVal || 0);
                            totalRemaining += (item.remainingVal || 0);
                        });

                        return (
                            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                <Table.Summary.Cell index={0} colSpan={6} align="right">Tổng cộng:</Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">{totalAmount.toLocaleString()}</Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right"><span style={{ color: 'green' }}>{totalDelivered.toLocaleString()}</span></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right"><span style={{ color: 'red' }}>{totalRemaining.toLocaleString()}</span></Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
            </div>

            {/* MULTI-LEG SHIPPING HIGHLIGHT BANNER */}
            <div style={{ marginBottom: 16, background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CarOutlined style={{ fontSize: 20, color: '#0284c7' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>Quản Lý Tuyến Vận Chuyển Đa Chặng (Multi-Leg Shipping)</span>
                            <Tag color="blue">Mới</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                            Hỗ trợ cấu hình đa chặng (Kho ➔ Chành xe ➔ Bến tỉnh ➔ Khách nhận), tính tổng cước Shop/Khách trả & tự động sinh nội dung thông báo gửi khách.
                        </div>
                    </div>
                </div>
                {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                    <Space wrap>
                        <Button 
                            type="primary" 
                            icon={<CarOutlined />} 
                            onClick={() => openCreateModal('chanh_xe')}
                            style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }}
                        >
                            🚚 Tạo Tuyến 3 Chặng Chành Xe
                        </Button>
                        <Button 
                            icon={<PlusOutlined />} 
                            onClick={() => openCreateModal('none')}
                        >
                            Tạo Phiếu Xuất Kho
                        </Button>
                    </Space>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                <b>Lịch sử phiếu giao ({history.length} phiếu):</b>
                {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                    <Space size={6}>
                        <Button size="small" icon={<CarOutlined style={{ color: '#0284c7' }} />} onClick={() => openCreateModal('chanh_xe')}>
                            🚚 Mẫu Chành xe
                        </Button>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openCreateModal('none')}>
                            Tạo Phiếu Xuất Kho
                        </Button>
                    </Space>
                )}
            </div>
            <Table dataSource={history} rowKey="id" pagination={false} size="small" bordered scroll={{ x: 1080 }} columns={[
                { title: 'Mã phiếu', dataIndex: 'code', render: (t: any) => <b>{t}</b> },
                { title: 'Ngày giao', render: (r: any) => dayjs(r.delivery_date).format('DD/MM/YYYY') },
                {
                    title: 'Trạng thái', align: 'center', render: (r: any) => (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <Tag color={r.status === 'SHIPPED' ? 'green' : r.status === 'DRAFT' ? 'default' : 'orange'}>
                                {r.status === 'SHIPPED' ? 'Đã báo khách' : r.status === 'DRAFT' ? 'Phiếu nháp' : 'Đang giao'}
                            </Tag>
                            {r.email_sent && <span style={{ fontSize: 10, color: 'green' }}><CheckCircleOutlined /> Email: Sent</span>}
                        </div>
                    )
                },
                { title: 'Người công trình', render: (r) => (r.contact_name ? <span>{r.contact_name} <br /><small>{r.contact_phone}</small></span> : '-') },
                {
                    title: 'Chi tiết', width: '35%', render: (r: any) => (
                        <div>
                            <div>{r.items?.map((i: any) => `${i.sku} (x${i.quantity})`).join(', ')}</div>
                            {(r.packing_spec_name || r.package_length || (r.package_count && r.package_count > 1)) && (
                                <div style={{ marginTop: 3, fontSize: 11, color: '#389e0d', background: '#f6ffed', padding: '2px 6px', borderRadius: 4, border: '1px solid #b7eb8f', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <InboxOutlined />
                                    <span><b>{r.packing_spec_name || 'Đóng gói'}:</b> {r.package_count || 1} kiện</span>
                                    {r.package_length && <span>({r.package_length}×{r.package_width}×{r.package_height}cm)</span>}
                                    {r.weight_gram && <span style={{ color: '#8c8c8c' }}>• {r.weight_gram}g</span>}
                                </div>
                            )}

                            {/* Multi-Leg Shipping info if available */}
                            {r.shipping_legs && r.shipping_legs.length > 0 ? (
                                <div style={{ marginTop: 5, fontSize: 11, color: '#0958d9', background: '#f0f5ff', padding: '4px 8px', borderRadius: 4, border: '1px solid #d6e4ff' }}>
                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                                        <span><CarOutlined /> Tuyến vận chuyển đa chặng ({r.shipping_legs.length} chặng):</span>
                                        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                                            <Button size="small" type="link" onClick={() => openEditModal(r)} style={{ padding: 0, height: 18, fontSize: 11 }}>
                                                Sửa chặng
                                            </Button>
                                        )}
                                    </div>
                                    {r.shipping_legs.map((leg: any, idx: number) => {
                                        const fee = Number(leg.shipping_fee !== undefined ? leg.shipping_fee : leg.shipping_cost) || 0;
                                        const isShop = String(leg.payer || '').toLowerCase() === 'shop';
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                                <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>C{idx + 1}</Tag>
                                                <span style={{ fontWeight: 500 }}>{leg.leg_name}:</span>
                                                <span>{leg.carrier_name || 'Chưa gán'}</span>
                                                {(leg.contact_phone || leg.carrier_phone) && <span style={{ color: '#64748b' }}>({leg.contact_phone || leg.carrier_phone})</span>}
                                                {leg.tracking_code && <Tag color="cyan" style={{ margin: 0, fontSize: 10 }}>Mã: {leg.tracking_code}</Tag>}
                                                {fee > 0 && (
                                                    <span style={{ color: isShop ? '#1677ff' : '#d4380d', fontWeight: 500 }}>
                                                        • {fee.toLocaleString()}đ ({isShop ? 'Shop trả' : 'Khách trả'})
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                (r.shipping_carrier || r.tracking_code || Number(r.shipping_cost) > 0) && (
                                    r.shipping_carrier === 'LALAMOVE' ? (
                                        <div style={{ marginTop: 4, fontSize: 12, color: '#d4380d', background: '#fff7e6', border: '1px solid #ffd591', padding: '3px 8px', borderRadius: 4 }}>
                                            <span style={{ marginRight: 4 }}>🚚</span>
                                            <span style={{ fontWeight: 600, color: '#eb6100' }}>Lalamove</span>
                                            {r.tracking_code && (
                                                <span>
                                                    {' • '}
                                                    <b>{r.tracking_code}</b>
                                                </span>
                                            )}
                                            {r.shipping_status_text === 'COMPLETED' ? (
                                                <span style={{ color: '#389e0d', fontWeight: 600 }}>
                                                    {' • '}Cước thực tế: {Number(r.shipping_cost).toLocaleString()}đ
                                                </span>
                                            ) : (
                                                Number(r.shipping_cost) > 0 && <span> • {Number(r.shipping_cost).toLocaleString()}đ</span>
                                            )}
                                            {r.shipping_status_text && (
                                                <Tag 
                                                    color={
                                                        r.shipping_status_text === 'COMPLETED' ? 'green' : 
                                                        r.shipping_status_text === 'CANCELED' ? 'red' : 
                                                        r.shipping_status_text === 'PICKED_UP' ? 'purple' : 
                                                        r.shipping_status_text === 'ON_GOING' ? 'blue' : 'orange'
                                                    } 
                                                    style={{ marginLeft: 6, fontSize: 10 }}
                                                >
                                                    {r.shipping_status_text === 'ASSIGNING_DRIVER' ? '⏳ Đang tìm tài xế' :
                                                     r.shipping_status_text === 'ON_GOING' ? '🚚 Tài xế đang đến' :
                                                     r.shipping_status_text === 'PICKED_UP' ? '📦 Đã bốc hàng' :
                                                     r.shipping_status_text === 'COMPLETED' ? '✅ Giao thành công' :
                                                     r.shipping_status_text === 'CANCELED' ? '❌ Đã hủy' : r.shipping_status_text}
                                                </Tag>
                                            )}
                                            {r.tracking_code && (
                                                <Tooltip title="Đồng bộ cước thực tế & trạng thái từ Lalamove">
                                                    <Button 
                                                        size="small" 
                                                        type="link" 
                                                        icon={<SyncOutlined spin={syncingLalamoveId === r.id} style={{ color: '#0958d9', fontSize: 11 }} />} 
                                                        onClick={() => handleSyncLalamoveStatus(r)} 
                                                        style={{ padding: 0, height: 18, fontSize: 11, marginLeft: 4 }}
                                                    >
                                                        Đồng bộ
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {r.shipping_metadata?.lalamove?.shareLink && (
                                                <a 
                                                    href={r.shipping_metadata.lalamove.shareLink} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    style={{ marginLeft: 6, fontSize: 11, color: '#1677ff', fontWeight: 600, textDecoration: 'underline' }}
                                                >
                                                    🗺️ Xem GPS
                                                </a>
                                            )}
                                            {r.shipping_metadata?.lalamove?.pod?.image && (
                                                <Button 
                                                    size="small" 
                                                    type="link" 
                                                    icon={<PictureOutlined style={{ color: '#52c41a' }} />} 
                                                    onClick={() => handleViewLalamovePod(r)}
                                                    style={{ padding: 0, height: 18, fontSize: 11, marginLeft: 4 }}
                                                >
                                                    Ảnh POD
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: 4, fontSize: 12, color: '#1d39c4', background: '#f0f5ff', padding: '3px 6px', borderRadius: 4 }}>
                                            <CarOutlined style={{ marginRight: 4 }} />
                                            {r.shipping_carrier && <span>{r.shipping_carrier}</span>}
                                            {r.shipping_carrier === 'GHTK' && (
                                                (r.shipping_metadata?.pick_option === 'post' || r.note?.includes('[Gửi tại bưu cục')) ? (
                                                    <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>🏪 Gửi bưu cục</Tag>
                                                ) : (
                                                    <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>🚚 Shipper lấy</Tag>
                                                )
                                            )}
                                            {r.tracking_code && (
                                                <span>
                                                    {' • '}
                                                    <b>{r.tracking_code}</b>
                                                    {r.tracking_code.startsWith('GHTK-DEMO') && (
                                                        <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>Mã Demo</Tag>
                                                    )}
                                                </span>
                                            )}
                                            {Number(r.shipping_cost) > 0 && <span> • {Number(r.shipping_cost).toLocaleString()}đ</span>}
                                            {Number(r.pick_money) > 0 && <span style={{ color: '#d4380d', fontWeight: 500 }}> • COD: {Number(r.pick_money).toLocaleString()}đ</span>}
                                            {r.shipping_status_text && (
                                                <Tag color={r.shipping_status_id === 5 || r.shipping_status_id === 6 ? 'green' : r.shipping_status_id === -1 ? 'red' : 'blue'} style={{ marginLeft: 6, fontSize: 10 }}>
                                                    {r.shipping_status_text}
                                                </Tag>
                                            )}
                                        </div>
                                    )
                                )
                            )}

                            {(!r.shipping_legs || r.shipping_legs.length === 0) && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                                <div style={{ marginTop: 4 }}>
                                    <Button 
                                        size="small" 
                                        type="link" 
                                        icon={<CarOutlined style={{ color: '#1677ff' }} />} 
                                        onClick={() => openEditModal(r)}
                                        style={{ padding: 0, fontSize: 11, height: 20 }}
                                    >
                                        + Cấu hình chặng vận chuyển (Chành xe / Nội bộ)
                                    </Button>
                                </div>
                            )}

                            {r.note && (
                                <div style={{ marginTop: 3, fontSize: 12, color: '#595959', fontStyle: 'italic' }}>
                                    📝 {r.note}
                                </div>
                            )}
                        </div>
                    )
                },
                {
                    title: 'Chứng từ',
                    width: 170,
                    render: (r) => (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1 }}>
                                {r.attachments?.length > 0 ? <AttachmentUpload value={r.attachments} maxFiles={0} /> : <span style={{ color: '#999', fontSize: 12 }}>Chưa có</span>}
                            </div>
                            <Tooltip title="Tải lên chứng từ (phiếu đã ký...)">
                                <Button size="small" type="text" icon={<UploadOutlined style={{ color: '#1890ff' }} />} onClick={() => openUploadModal(r)} />
                            </Tooltip>
                        </div>
                    )
                },
                {
                    title: 'Thao tác',
                    width: 175,
                    align: 'center',
                    fixed: 'right',
                    render: (_: any, r: any) => {
                        const moreMenuItems: any[] = [];

                        if (r.status === 'DRAFT') {
                            moreMenuItems.push({
                                key: 'approve',
                                icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                                label: 'Duyệt phiếu chính thức',
                                onClick: async () => {
                                    try {
                                        await api.put(`/sales/delivery/${r.id}`, { status: 'PENDING_EXPORT' });
                                        message.success('Đã chuyển thành phiếu chính thức');
                                        fetchHistory();
                                    } catch (e: any) {
                                        message.error(e.response?.data?.message || 'Không thể cập nhật trạng thái');
                                    }
                                }
                            });
                        }

                        if (r.shipping_carrier === 'GHTK' && r.tracking_code && !r.tracking_code.startsWith('GHTK-DEMO')) {
                            moreMenuItems.push({
                                key: 'ghtk_print',
                                icon: <FilePdfOutlined style={{ color: '#008444' }} />,
                                label: 'In nhãn vận đơn A6 (GHTK)',
                                onClick: () => handlePrintGhtkLabel(r)
                            });
                            moreMenuItems.push({
                                key: 'ghtk_track',
                                icon: <HistoryOutlined style={{ color: '#1890ff' }} />,
                                label: 'Xem hành trình GHTK',
                                onClick: () => handleViewTracking(r)
                            });
                            if (r.shipping_status_id !== 5 && r.shipping_status_id !== 6 && r.shipping_status_id !== -1) {
                                moreMenuItems.push({
                                    key: 'ghtk_cancel',
                                    icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                                    label: 'Hủy vận đơn GHTK',
                                    danger: true,
                                    onClick: () => handleCancelGhtk(r.id)
                                });
                            }
                        }

                        if (r.shipping_carrier === 'GHTK' && (!r.tracking_code || r.tracking_code.startsWith('GHTK-DEMO'))) {
                            moreMenuItems.push({
                                key: 'ghtk_push',
                                icon: <SendOutlined style={{ color: '#fa8c16' }} />,
                                label: r.tracking_code?.startsWith('GHTK-DEMO') ? 'Đẩy đơn sang GHTK thật' : 'Đẩy đơn sang GHTK',
                                onClick: () => handlePushSingleDeliveryGhtk(r)
                            });
                        }

                        // LALAMOVE ACTIONS
                        if (r.shipping_carrier === 'LALAMOVE' || r.shipping_provider === 'LALAMOVE') {
                            const lMeta = r.shipping_metadata?.lalamove;
                            const shareLink = lMeta?.shareLink;
                            const podImage = lMeta?.pod?.image;

                            if (r.tracking_code) {
                                moreMenuItems.push({
                                    key: 'llm_sync',
                                    icon: <SyncOutlined spin={syncingLalamoveId === r.id} style={{ color: '#1890ff' }} />,
                                    label: '🔄 Cập nhật cước & trạng thái Lalamove',
                                    onClick: () => handleSyncLalamoveStatus(r)
                                });
                                if (shareLink) {
                                    moreMenuItems.push({
                                        key: 'llm_track',
                                        icon: <GlobalOutlined style={{ color: '#eb6100' }} />,
                                        label: 'Xem vị trí tài xế GPS trực tiếp (Lalamove)',
                                        onClick: () => window.open(shareLink, '_blank')
                                    });
                                }
                                if (podImage) {
                                    moreMenuItems.push({
                                        key: 'llm_pod',
                                        icon: <PictureOutlined style={{ color: '#52c41a' }} />,
                                        label: 'Xem ảnh chụp nghiệm thu (POD)',
                                        onClick: () => handleViewLalamovePod(r)
                                    });
                                }
                                if (r.shipping_status_text !== 'COMPLETED' && r.shipping_status_text !== 'CANCELED') {
                                    moreMenuItems.push({
                                        key: 'llm_tip',
                                        icon: <DollarOutlined style={{ color: '#faad14' }} />,
                                        label: 'Thêm tiền Tip / Phí ưu tiên',
                                        onClick: () => handleOpenLalamoveTipModal(r)
                                    });
                                    moreMenuItems.push({
                                        key: 'llm_cancel',
                                        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                                        label: 'Hủy cuốc xe Lalamove',
                                        danger: true,
                                        onClick: () => handleCancelLalamove(r)
                                    });
                                }
                            } else {
                                moreMenuItems.push({
                                    key: 'llm_push',
                                    icon: <SendOutlined style={{ color: '#eb6100' }} />,
                                    label: 'Đặt xe Lalamove (Hỏa tốc / Xe tải)',
                                    onClick: () => handleOpenLalamoveBooking(r)
                                });
                            }
                        } else if (r.shipping_carrier !== 'GHTK') {
                            // Gợi ý gọi xe Lalamove cho các đơn tự giao / chành xe
                            moreMenuItems.push({
                                key: 'llm_book_alt',
                                icon: <SendOutlined style={{ color: '#eb6100' }} />,
                                label: 'Đặt xe Lalamove (Hỏa tốc / Xe tải)',
                                onClick: () => handleOpenLalamoveBooking(r)
                            });
                        }

                        moreMenuItems.push({
                            key: 'upload_doc',
                            icon: <UploadOutlined style={{ color: '#1890ff' }} />,
                            label: 'Tải lên chứng từ giao hàng',
                            onClick: () => openUploadModal(r)
                        });

                        moreMenuItems.push({
                            key: 'send_email',
                            icon: <MailOutlined style={{ color: '#722ed1' }} />,
                            label: 'Gửi Email thông báo khách',
                            onClick: async () => {
                                Modal.confirm({
                                    title: 'Gửi Email thông báo?',
                                    content: 'Hệ thống sẽ gửi email thông báo giao hàng cho khách hàng theo mẫu.',
                                    onOk: async () => {
                                        try {
                                            await api.post(`/sales/delivery/${r.id}/email`);
                                            message.success('Đã gửi email thành công');
                                            fetchHistory();
                                        } catch (e) {
                                            message.error('Lỗi gửi email: Cần cấu hình SMTP');
                                        }
                                    }
                                });
                            }
                        });

                        if (order.status !== 'COMPLETED' && order.status !== 'CANCELLED') {
                            moreMenuItems.push({ type: 'divider' });
                            moreMenuItems.push({
                                key: 'delete',
                                icon: <DeleteOutlined />,
                                label: 'Xóa phiếu xuất',
                                danger: true,
                                onClick: () => handleDeleteDelivery(r.id)
                            });
                        }

                        return (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                                <Tooltip title="In Phiếu Xuất Kho">
                                    <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(r)} />
                                </Tooltip>
                                {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                                    <Tooltip title="Sửa phiếu">
                                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)} />
                                    </Tooltip>
                                )}
                                <Tooltip title="Thông báo giao hàng (Xem / Sửa / Copy)">
                                    <Button 
                                        size="small" 
                                        style={{ color: '#108ee9', borderColor: '#91d5ff' }} 
                                        icon={<MessageOutlined />} 
                                        onClick={() => openViewNoticeModal(r)} 
                                    />
                                </Tooltip>
                                <Tooltip title="Gửi Zalo ZNS Thông báo giao hàng">
                                    <Button 
                                        size="small" 
                                        style={{ color: '#0068ff', borderColor: '#b5d5ff', background: '#eef5ff' }} 
                                        icon={<SendOutlined />} 
                                        onClick={() => openSendDeliveryZnsModal(r)} 
                                    />
                                </Tooltip>
                                {moreMenuItems.length > 0 && (
                                    <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
                                        <Button size="small" icon={<MoreOutlined />} />
                                    </Dropdown>
                                )}
                            </div>
                        );
                    }
                }
            ]} />

            <Modal title={editingDeliveryId ? "Cập nhật Phiếu Xuất Kho" : "Tạo Phiếu Xuất Kho"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={handleShip} width={960}>
                {/* WEBSITE ORDER BANNER */}
                {websiteOrderParsed?.isWebsiteOrder && (
                    <Alert
                        style={{ marginBottom: 12, border: '1px solid #91d5ff', background: '#e6f7ff' }}
                        type="info"
                        showIcon
                        icon={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
                        message={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 600, color: '#0050b3' }}>Đơn hàng từ Website (Khách lẻ):</span>{' '}
                                    Đã tự động trích xuất người nhận, SĐT, địa chỉ & {websiteOrderParsed.isCod ? `tiền COD (${websiteOrderParsed.suggestedCodAmount.toLocaleString()}đ)` : 'chuyển khoản'} từ ghi chú đơn hàng.
                                </div>
                                <Button size="small" type="link" onClick={handleReparseNote} style={{ padding: '0 4px', height: 22, fontSize: 11 }}>
                                    Bóc tách lại
                                </Button>
                            </div>
                        }
                    />
                )}

                {/* DATE SELECTION */}
                <div style={{ display: 'flex', gap: 15, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>Loại phiếu:</div>
                        <Select
                            style={{ width: '100%' }}
                            value={isDraft}
                            onChange={(draft) => {
                                setIsDraft(draft);
                                if (!editingDeliveryId) {
                                    setShipItems(summaryData.map((d: any) => {
                                        const canShip = draft || ((d.bookingStatus === 'CONFIRMED' || (d.stock || 0) > 0) && d.remaining > 0);
                                        return {
                                            sku: d.sku, 
                                            name: d.name || d.sku,
                                            unitPrice: d.unitPrice || 0,
                                            max: d.remaining, 
                                            stock: d.stock || 0,
                                            quantity: canShip ? d.remaining : (d.remaining > 0 ? d.remaining : 0),
                                            bookingStatus: d.bookingStatus
                                        };
                                    }));
                                }
                            }}
                            options={[
                                { value: false, label: 'Chính thức (Xuất kho)' },
                                { value: true, label: 'Bản nháp (Chỉ in/gửi khách)' }
                            ]}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>Ngày xuất kho:</div>
                        <DatePicker format="DD/MM/YYYY" value={shipDate} onChange={setShipDate} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* ADDRESS SELECTION */}
                <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontWeight: 500 }}>Chọn Chi Nhánh / Địa chỉ giao hàng:</div>
                        {shipAddress && (
                            <Button 
                                size="small" 
                                type="link" 
                                icon={<CompassOutlined />} 
                                loading={ghtkParseLoading}
                                onClick={handleGhtkParseAddress}
                                style={{ fontSize: 11, padding: 0, height: 20 }}
                            >
                                ⚡ Chuẩn hóa cấp 4 (GHTK)
                            </Button>
                        )}
                    </div>
                    <Select
                        style={{ width: '100%' }}
                        value={shipAddress}
                        onChange={setShipAddress}
                        placeholder="Chọn địa chỉ giao hàng"
                        options={[
                            { value: fullCustomer?.address || '', label: `Mặc định: ${fullCustomer?.address || 'Chưa cập nhật'}` },
                            ...(fullCustomer?.delivery_addresses || []).map((addr: any) => ({
                                value: addr.address, label: `${addr.name || 'CN'} - ${addr.address}`
                            }))
                        ]}
                    />
                    <Input
                        style={{ marginTop: 5 }}
                        placeholder="Hoặc nhập địa chỉ khác..."
                        value={shipAddress}
                        onChange={e => setShipAddress(e.target.value)}
                    />
                    {(ghtkProvince || ghtkDistrict || ghtkWard) && (
                        <div style={{ fontSize: 11, color: '#008444', background: '#f6ffed', border: '1px dashed #b7eb8f', borderRadius: 4, padding: '3px 8px', marginTop: 4 }}>
                            📍 <b>GHTK Cấp 4:</b> {[
                                extractAddressString(ghtkWard),
                                extractAddressString(ghtkDistrict),
                                extractAddressString(ghtkProvince)
                            ].filter(Boolean).join(', ')}
                        </div>
                    )}
                </div>

                {/* CONTACT SELECTION */}
                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 500 }}>Người liên hệ nhận hàng:</div>
                    <Select
                        style={{ width: '100%' }}
                        placeholder="Chọn người liên hệ"
                        value={shipContactName}
                        onChange={(val) => {
                            // Find contact to auto-fill Phone
                            const contact = contactList.find((c: any) => c.full_name === val);
                            setShipContactName(val);
                            if (contact) setShipContactPhone(contact.phone);
                        }}
                        options={[
                            ...(contactList).map((c: any) => ({
                                value: c.full_name, label: `${c.full_name} - ${c.position || ''} (${c.phone})`
                            }))
                        ]}
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                        <Input placeholder="Tên người nhận" value={shipContactName} onChange={e => setShipContactName(e.target.value)} />
                        <Input placeholder="SĐT Liên hệ" value={shipContactPhone} onChange={e => setShipContactPhone(e.target.value)} />
                    </div>
                </div>

                {editingDeliveryId && (
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontWeight: 500 }}>Trạng thái phiếu:</div>
                        <Select
                            style={{ width: '100%' }}
                            value={shipStatus}
                            onChange={setShipStatus}
                            options={[
                                { value: 'PENDING_EXPORT', label: 'Chờ xuất / Đang giao' },
                                { value: 'SHIPPED', label: 'Đã giao hàng / Đã báo khách' },
                            ]}
                        />
                    </div>
                )}

                {/* SHIPPING CARRIER FIELDS */}
                <div style={{ 
                    marginBottom: 10, 
                    padding: 12, 
                    background: shippingCarrier === 'GHTK' ? '#f6ffed' : shippingCarrier === 'LALAMOVE' ? '#fff7e6' : '#f0f5ff', 
                    borderRadius: 6, 
                    border: `1px solid ${shippingCarrier === 'GHTK' ? '#b7eb8f' : shippingCarrier === 'LALAMOVE' ? '#ffd591' : '#adc6ff'}` 
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, color: shippingCarrier === 'GHTK' ? '#008444' : shippingCarrier === 'LALAMOVE' ? '#d4380d' : '#1d39c4' }}>
                            {shippingCarrier === 'GHTK' ? '🚀 Vận chuyển Giao Hàng Tiết Kiệm (GHTK):' : 
                             shippingCarrier === 'LALAMOVE' ? '🚚 Vận chuyển Hỏa Tốc & Xe Tải (Lalamove):' : 
                             'Thông tin vận chuyển:'}
                        </div>
                        {shippingCarrier === 'GHTK' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {ghtkConfig?.isConfigured ? (
                                    <Tag color="green" style={{ margin: 0 }}>
                                        ✅ GHTK API Đã kết nối {ghtkConfig.isSandbox ? '(Staging)' : '(Production)'}
                                    </Tag>
                                ) : (
                                    <Tag color="warning" style={{ margin: 0 }}>
                                        ⚠️ GHTK Chế độ Mô phỏng (Chưa cấu hình Token)
                                    </Tag>
                                )}
                                <Button 
                                    size="small" 
                                    type="link" 
                                    icon={<SettingOutlined />} 
                                    onClick={handleOpenGhtkConfig}
                                    style={{ fontSize: 11, padding: 0, height: 20 }}
                                >
                                    Cấu hình
                                </Button>
                            </div>
                        )}
                        {shippingCarrier === 'LALAMOVE' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {lalamoveConfig?.isConfigured ? (
                                    <Tag color="orange" style={{ margin: 0 }}>
                                        ✅ Lalamove API {lalamoveConfig.isSandbox ? '(Sandbox)' : '(Production)'}
                                    </Tag>
                                ) : (
                                    <Tag color="warning" style={{ margin: 0 }}>
                                        ⚠️ Lalamove Chế độ Mô phỏng
                                    </Tag>
                                )}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <div style={{ flex: 2 }}>
                            <div style={{ fontSize: 12, marginBottom: 4 }}>Đơn vị vận chuyển</div>
                            <Select
                                style={{ width: '100%' }}
                                placeholder="Chọn ĐVVC"
                                value={shippingCarrier || undefined}
                                onChange={setShippingCarrier}
                                allowClear
                                options={carriers.map((c: any) => ({ value: c.code, label: c.name }))}
                            />
                        </div>
                        <div style={{ flex: 2 }}>
                            <div style={{ fontSize: 12, marginBottom: 4 }}>Mã vận đơn</div>
                            <Input placeholder={shippingCarrier === 'GHTK' ? "Tự động sinh từ GHTK" : shippingCarrier === 'LALAMOVE' ? "Tự động sinh từ Lalamove" : "VD: GHN123456"} value={trackingCode} onChange={e => setTrackingCode(e.target.value)} />
                        </div>
                        <div style={{ flex: 1.5 }}>
                            <div style={{ fontSize: 12, marginBottom: 4 }}>Chi phí VC</div>
                            <InputNumber
                                style={{ width: '100%' }}
                                placeholder="0"
                                value={shippingCost}
                                onChange={(v: any) => setShippingCost(v || 0)}
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            />
                        </div>
                    </div>

                    {/* TUYẾN VẬN CHUYỂN ĐA CHẶNG (MULTI-LEG SHIPPING) */}
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CarOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                                    Tuyến Vận Chuyển Đa Chặng (Kho ➔ Chành xe ➔ Địa phương ➔ Khách):
                                </span>
                                <Tag color={shippingLegs.length > 0 ? "blue" : "default"}>{shippingLegs.length} chặng</Tag>
                            </div>
                            <Space size={6} wrap>
                                <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={handleAddLeg}>
                                    + Thêm chặng
                                </Button>
                                <Button size="small" onClick={handleApplyChanhXePreset} style={{ color: '#0958d9', borderColor: '#91caff' }}>
                                    🚚 Mẫu 3 Chặng Chành Xe
                                </Button>
                                <Button size="small" onClick={handleApplyDirectPreset}>
                                    📦 Mẫu 1 Chặng Giao Thẳng
                                </Button>
                            </Space>
                        </div>

                        {shippingLegs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '12px', background: '#ffffff', borderRadius: 6, border: '1px dashed #d9d9d9', color: '#64748b', fontSize: 12 }}>
                                Chưa cấu hình đa chặng. Bạn có thể sử dụng thông tin ĐVVC đơn giản ở trên, hoặc bấm <b>"Mẫu 3 Chặng Chành Xe"</b> để tự động tạo tuyến: Kho ➔ Chành xe ➔ Tỉnh ➔ Khách nhận.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {shippingLegs.map((leg, idx) => {
                                    const legFee = Number(leg.shipping_fee !== undefined ? leg.shipping_fee : leg.shipping_cost) || 0;
                                    const isShopPayer = String(leg.payer || '').toLowerCase() === 'shop';
                                    return (
                                        <div key={leg.id || idx} style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
                                                    <Tag color="blue" style={{ fontWeight: 600, margin: 0 }}>Chặng {idx + 1}</Tag>
                                                    <Input
                                                        size="small"
                                                        style={{ fontWeight: 600, maxWidth: 280 }}
                                                        placeholder="Tên chặng (VD: Kho ra Chành xe)"
                                                        value={leg.leg_name}
                                                        onChange={e => handleUpdateLeg(idx, 'leg_name', e.target.value)}
                                                    />
                                                    <Select
                                                        size="small"
                                                        style={{ width: 140 }}
                                                        value={leg.status || 'pending'}
                                                        onChange={val => handleUpdateLeg(idx, 'status', val)}
                                                        options={[
                                                            { value: 'pending', label: '⏳ Chờ gửi' },
                                                            { value: 'delivering', label: '🚚 Đang chuyển' },
                                                            { value: 'delivered', label: '✅ Đã đến nơi' }
                                                        ]}
                                                    />
                                                    {idx === 0 && (
                                                        <Button 
                                                            size="small" 
                                                            style={{ color: '#eb6100', borderColor: '#ffbb96', background: '#fff7e6', fontSize: 11 }}
                                                            onClick={() => {
                                                                handleUpdateLeg(0, 'carrier_name', 'Lalamove (Xe bán tải 500kg)');
                                                                handleUpdateLeg(0, 'leg_name', 'Chặng 1: Kho ERP4U ➔ Bến xe / Chành xe');
                                                                message.info('Đã chọn Lalamove làm đơn vị vận chuyển Chặng 1');
                                                            }}
                                                        >
                                                            🚚 Gợi ý Lalamove
                                                        </Button>
                                                    )}
                                                </div>
                                                <Button
                                                    size="small"
                                                    type="text"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleRemoveLeg(idx)}
                                                >
                                                    Xóa chặng
                                                </Button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Đơn vị / Tài xế / Chành xe:</div>
                                                    <Input
                                                        size="small"
                                                        placeholder="VD: Chành xe Tô Châu"
                                                        value={leg.carrier_name}
                                                        onChange={e => handleUpdateLeg(idx, 'carrier_name', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>SĐT liên hệ:</div>
                                                    <Input
                                                        size="small"
                                                        placeholder="090..."
                                                        value={leg.contact_phone || leg.carrier_phone || ''}
                                                        onChange={e => {
                                                            handleUpdateLeg(idx, 'carrier_phone', e.target.value);
                                                            handleUpdateLeg(idx, 'contact_phone', e.target.value);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Mã VĐ / Biên nhận:</div>
                                                    <Input
                                                        size="small"
                                                        placeholder="VD: TC-88912"
                                                        value={leg.tracking_code || ''}
                                                        onChange={e => handleUpdateLeg(idx, 'tracking_code', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Cước chặng này:</div>
                                                    <InputNumber
                                                        size="small"
                                                        style={{ width: '100%' }}
                                                        placeholder="0"
                                                        value={legFee}
                                                        onChange={v => {
                                                            handleUpdateLeg(idx, 'shipping_fee', v || 0);
                                                            handleUpdateLeg(idx, 'shipping_cost', v || 0);
                                                        }}
                                                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                        addonAfter="đ"
                                                    />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Người trả cước:</div>
                                                    <Radio.Group
                                                        size="small"
                                                        value={isShopPayer ? 'shop' : 'customer'}
                                                        onChange={e => handleUpdateLeg(idx, 'payer', e.target.value)}
                                                    >
                                                        <Radio.Button value="shop">Shop trả</Radio.Button>
                                                        <Radio.Button value="customer">Khách trả</Radio.Button>
                                                    </Radio.Group>
                                                </div>
                                            </div>

                                            <div>
                                                <Input
                                                    size="small"
                                                    placeholder="Ghi chú chặng (VD: Bến xe Miền Đông cổng 3, giao trước 14h, người nhận trả cước...)"
                                                    value={leg.notes || leg.note || ''}
                                                    onChange={e => {
                                                        handleUpdateLeg(idx, 'notes', e.target.value);
                                                        handleUpdateLeg(idx, 'note', e.target.value);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Total legs bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f1f5f9', borderRadius: 6, flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                    <div style={{ fontSize: 12 }}>
                                        <b>Tổng cước các chặng:</b>{' '}
                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                            {shippingLegs.reduce((sum, l) => sum + (Number(l.shipping_fee !== undefined ? l.shipping_fee : l.shipping_cost) || 0), 0).toLocaleString()}đ
                                        </span>
                                        {' '}(<span style={{ color: '#1677ff' }}>Shop trả: {shippingLegs.filter(l => String(l.payer || '').toLowerCase() === 'shop').reduce((sum, l) => sum + (Number(l.shipping_fee !== undefined ? l.shipping_fee : l.shipping_cost) || 0), 0).toLocaleString()}đ</span>
                                        {' • '}<span style={{ color: '#d4380d' }}>Khách trả: {shippingLegs.filter(l => String(l.payer || '').toLowerCase() === 'customer').reduce((sum, l) => sum + (Number(l.shipping_fee !== undefined ? l.shipping_fee : l.shipping_cost) || 0), 0).toLocaleString()}đ</span>)
                                    </div>
                                    <Space size={6}>
                                        <Button size="small" icon={<SyncOutlined />} onClick={handleSyncLegsToShippingCost}>
                                            Đồng bộ cước Shop trả vào chi phí phiếu
                                        </Button>
                                        <Button size="small" type="dashed" icon={<MessageOutlined />} onClick={handleSyncLegsToNotice}>
                                            Đồng bộ vào mẫu Thông báo
                                        </Button>
                                    </Space>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PACKING SPEC & PACKAGE DIMENSIONS */}
                    <div style={{ background: '#f9f0ff', padding: '10px 12px', borderRadius: 6, border: '1px solid #d3adf7', marginTop: 10, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#531dab', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <InboxOutlined /> Quy cách đóng gói & Kích thước kiện hàng (Packing Specs):
                            </span>
                            <span style={{ fontSize: 11, color: '#722ed1' }}>
                                💡 Nhập kích thước ➜ Tự gợi ý TL quy đổi (có thể sửa tay)
                            </span>
                        </div>

                        {/* Row 1: Mẫu quy cách có sẵn - Full width to prevent crushing */}
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Mẫu quy cách có sẵn:</div>
                            <Select
                                style={{ width: '100%' }}
                                size="small"
                                allowClear
                                placeholder="-- Chọn mẫu quy cách đóng gói --"
                                value={selectedPackingSpecId || undefined}
                                onChange={(val) => handleSelectPackingSpec(val || null)}
                                options={packingSpecs.map((spec: any) => {
                                    const relevantCategoryIds = (order.items || []).map((it: any) => {
                                        const p = products.find((prod: any) => prod.value === it.sku);
                                        return p?.category_id;
                                    }).filter(Boolean);
                                    const relevantProductIds = (order.items || []).map((it: any) => {
                                        const p = products.find((prod: any) => prod.value === it.sku);
                                        return p?.id;
                                    }).filter(Boolean);

                                    const specCatIds = Array.isArray(spec.category_ids) && spec.category_ids.length > 0
                                        ? spec.category_ids
                                        : (spec.category_id ? [spec.category_id] : []);
                                    const specProdIds = Array.isArray(spec.product_ids) && spec.product_ids.length > 0
                                        ? spec.product_ids
                                        : (spec.product_id ? [spec.product_id] : []);

                                    const isMatched = specCatIds.some((id: number) => relevantCategoryIds.includes(id)) ||
                                                      specProdIds.some((id: number) => relevantProductIds.includes(id));
                                    const isGlobal = specCatIds.length === 0 && specProdIds.length === 0;
                                    const prefix = isMatched ? '★ ' : (isGlobal ? '🌐 ' : '');
                                    const catNames = (spec.categories || []).map((c: any) => c.name).join(', ') || spec.category?.name || '';
                                    return {
                                        value: spec.id,
                                        label: `${prefix}${spec.name}${catNames ? ` [${catNames}]` : ''} (${spec.quantity_per_package} SP/k - ${spec.length_cm}x${spec.width_cm}x${spec.height_cm}cm)`
                                    };
                                })}
                            />
                        </div>

                        {/* Row 2: Tên quy cách hiển thị & Số kiện hàng */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 8 }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Tên quy cách hiển thị:</div>
                                <Input
                                    size="small"
                                    placeholder="VD: 5 bộ/kiện"
                                    value={packingSpecName}
                                    onChange={e => setPackingSpecName(e.target.value)}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Số kiện hàng:</div>
                                <InputNumber
                                    size="small"
                                    style={{ width: '100%' }}
                                    min={1}
                                    value={packageCount}
                                    onChange={(v) => handleDimensionOrCountChange(undefined, undefined, undefined, v || 1)}
                                    addonAfter="kiện"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.3fr', gap: 8, marginBottom: 4 }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Dài (Length):</div>
                                <InputNumber
                                    size="small"
                                    style={{ width: '100%' }}
                                    min={0}
                                    placeholder="Dài"
                                    addonAfter="cm"
                                    value={packageLength}
                                    onChange={(v) => handleDimensionOrCountChange(v, undefined, undefined, undefined)}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Rộng (Width):</div>
                                <InputNumber
                                    size="small"
                                    style={{ width: '100%' }}
                                    min={0}
                                    placeholder="Rộng"
                                    addonAfter="cm"
                                    value={packageWidth}
                                    onChange={(v) => handleDimensionOrCountChange(undefined, v, undefined, undefined)}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Cao (Height):</div>
                                <InputNumber
                                    size="small"
                                    style={{ width: '100%' }}
                                    min={0}
                                    placeholder="Cao"
                                    addonAfter="cm"
                                    value={packageHeight}
                                    onChange={(v) => handleDimensionOrCountChange(undefined, undefined, v, undefined)}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                                    <span>TL tính cước:</span>
                                    {packageLength && packageWidth && packageHeight ? (
                                        <span style={{ fontSize: 10, color: '#722ed1', fontWeight: 500 }}>
                                            Thể tích: {Math.round((Number(packageLength) * Number(packageWidth) * Number(packageHeight)) / 6000 * 10) / 10}kg/k
                                        </span>
                                    ) : null}
                                </div>
                                <InputNumber
                                    style={{ width: '100%' }}
                                    size="small"
                                    addonAfter="gram"
                                    value={packageWeight}
                                    onChange={(v: any) => setPackageWeight(v || 500)}
                                    placeholder="Gram"
                                />
                            </div>
                        </div>

                        {/* Bulky Warning Alert */}
                        {((Number(packageLength) > 100 || Number(packageWidth) > 100 || Number(packageHeight) > 100 || (Number(packageWeight) / Math.max(1, packageCount || 1)) > 20000)) && (
                            <Alert
                                style={{ marginTop: 6, fontSize: 11, padding: '4px 8px' }}
                                type="warning"
                                showIcon
                                message={
                                    <span>
                                        <b>⚠️ Cảnh báo hàng cồng kềnh:</b> Kiện hàng có kích thước &gt; 100cm hoặc nặng &gt; 20kg. Vận chuyển GHTK Express có thể tính phụ phí cồng kềnh BBS hoặc hạn chế lấy bằng xe máy. Vui lòng tự điều phối phương thức giao nhận phù hợp!
                                    </span>
                                }
                            />
                        )}
                    </div>

                    {/* GHTK ENHANCED PANEL */}
                    {shippingCarrier === 'GHTK' && (
                        <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #d9f7be', marginTop: 8 }}>
                            {!ghtkConfig?.isConfigured && (
                                <Alert 
                                    style={{ marginBottom: 10, fontSize: 12, padding: '6px 10px' }}
                                    type="warning"
                                    showIcon
                                    message={
                                        <span>
                                            <b>Chưa cấu hình Token GHTK thật:</b> Đơn hàng khi tạo sẽ mang mã Demo mô phỏng (VD: <code>GHTK-DEMO-XXXXXX</code>) và chưa được truyền sang bưu cục GHTK.{' '}
                                            <a onClick={handleOpenGhtkConfig} style={{ textDecoration: 'underline', fontWeight: 600 }}>Bấm vào đây để cấu hình Token GHTK</a>
                                        </span>
                                    }
                                />
                            )}
                            {/* GHTK LEVEL 4 ADDRESS INPUTS */}
                            <div style={{ background: '#f6ffed', padding: '8px 10px', borderRadius: 6, border: '1px dashed #b7eb8f', marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#008444' }}>
                                        📍 Phân tách địa chỉ GHTK (Cấp 4):
                                    </span>
                                    <Button 
                                        size="small" 
                                        type="link" 
                                        icon={<CompassOutlined />} 
                                        loading={ghtkParseLoading}
                                        onClick={handleGhtkParseAddress}
                                        style={{ fontSize: 11, padding: 0, height: 20 }}
                                    >
                                        ⚡ Tự động bóc tách từ địa chỉ
                                    </Button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1.4fr', gap: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Tỉnh / Thành phố <span style={{ color: 'red' }}>*</span></div>
                                        <Input 
                                            size="small" 
                                            placeholder="VD: Bà Rịa - Vũng Tàu" 
                                            value={extractAddressString(ghtkProvince)} 
                                            onChange={e => setGhtkProvince(e.target.value)} 
                                        />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Quận / Huyện <span style={{ color: 'red' }}>*</span></div>
                                        <Input 
                                            size="small" 
                                            placeholder="VD: TP. Vũng Tàu" 
                                            value={extractAddressString(ghtkDistrict)} 
                                            onChange={e => setGhtkDistrict(e.target.value)} 
                                            status={
                                                extractAddressString(ghtkDistrict) && (
                                                    extractAddressString(ghtkDistrict).toLowerCase().startsWith('phường') ||
                                                    extractAddressString(ghtkDistrict).toLowerCase().startsWith('p.') ||
                                                    (extractAddressString(ghtkWard) && extractAddressString(ghtkDistrict).toLowerCase() === extractAddressString(ghtkWard).toLowerCase())
                                                ) ? 'warning' : undefined
                                            }
                                        />
                                        {extractAddressString(ghtkDistrict) && (
                                            extractAddressString(ghtkDistrict).toLowerCase().startsWith('phường') ||
                                            extractAddressString(ghtkDistrict).toLowerCase().startsWith('p.') ||
                                            (extractAddressString(ghtkWard) && extractAddressString(ghtkDistrict).toLowerCase() === extractAddressString(ghtkWard).toLowerCase())
                                        ) && (
                                            <div style={{ color: '#d4380d', fontSize: 10, marginTop: 2 }}>
                                                ⚠️ Nhập nhầm Phường vào Huyện!
                                                {(() => {
                                                    const provStr = extractAddressString(ghtkProvince).toLowerCase();
                                                    const p = VIETNAM_PROVINCES.find(pr => pr.standard.toLowerCase() === provStr || pr.names.some(n => provStr.includes(n)));
                                                    if (p?.defaultCity) {
                                                        return (
                                                            <a 
                                                                onClick={() => setGhtkDistrict(p.defaultCity)} 
                                                                style={{ marginLeft: 4, color: '#1890ff', textDecoration: 'underline', fontWeight: 500 }}
                                                            >
                                                                Đổi thành "{p.defaultCity}"
                                                            </a>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Phường / Xã <span style={{ color: 'red' }}>*</span></div>
                                        <Input 
                                            size="small" 
                                            placeholder="VD: Phường Thắng Nhất" 
                                            value={extractAddressString(ghtkWard)} 
                                            onChange={e => setGhtkWard(e.target.value)} 
                                        />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#555', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Thôn/Ấp/Xóm/Tổ</span>
                                            <span style={{ color: '#8c8c8c', fontSize: 10 }}>(để "Khác" nếu ở phố)</span>
                                        </div>
                                        <Input 
                                            size="small" 
                                            placeholder="Khác" 
                                            value={extractAddressString(ghtkHamlet)} 
                                            onChange={e => setGhtkHamlet(e.target.value)} 
                                        />
                                    </div>
                                </div>
                                <div style={{ marginTop: 6 }}>
                                    <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Số nhà / Tên đường:</div>
                                    <Input 
                                        size="small" 
                                        placeholder="VD: 88/14 Nguyễn Hữu Cảnh" 
                                        value={extractAddressString(ghtkAddress)} 
                                        onChange={e => setGhtkAddress(e.target.value)} 
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: 12, background: ghtkPickOption === 'post' ? '#f6ffed' : '#fafafa', border: ghtkPickOption === 'post' ? '1px solid #b7eb8f' : '1px solid #e8e8e8', borderRadius: 8, padding: '10px 12px', transition: 'all 0.25s ease' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: ghtkPickOption === 'post' ? '#237804' : '#262626', display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span>🏪 Hình thức gửi hàng GHTK:</span>
                                    </div>
                                    <Radio.Group 
                                        size="small" 
                                        value={ghtkPickOption} 
                                        onChange={e => setGhtkPickOption(e.target.value)}
                                        buttonStyle="solid"
                                    >
                                        <Radio.Button value="cod">
                                            🚚 Shipper đến lấy tại kho
                                        </Radio.Button>
                                        <Radio.Button value="post" style={{ background: ghtkPickOption === 'post' ? '#52c41a' : undefined, borderColor: ghtkPickOption === 'post' ? '#52c41a' : undefined }}>
                                            🏪 Giao tại cửa hàng / Bưu cục GHTK
                                        </Radio.Button>
                                    </Radio.Group>
                                </div>

                                {ghtkPickOption === 'post' ? (
                                    <div style={{ background: '#ffffff', border: '1px dashed #73d13d', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#237804' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                            <span>
                                                ✅ <b>Shop tự mang hàng ra cửa hàng / bưu cục GHTK:</b> GHTK sẽ quét mã vận đơn tiếp nhận ngay, không cần chờ bưu tá đến lấy.
                                            </span>
                                            <a 
                                                href="https://giaohangtietkiem.vn/dia-chi-buu-cuc/" 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                style={{ color: '#0958d9', fontWeight: 600, textDecoration: 'underline', whiteSpace: 'nowrap' }}
                                            >
                                                Tra cứu bưu cục gần nhất ↗
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 8 }}>
                                        Shipper GHTK sẽ đến địa chỉ kho được chọn bên dưới để nhận kiện hàng.
                                    </div>
                                )}

                                <div>
                                    <div style={{ fontSize: 11, color: '#555', marginBottom: 3, fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{ghtkPickOption === 'post' ? 'Địa chỉ kho gửi & nhận trả hàng (Return Address):' : 'Kho lấy hàng (Pick Address):'}</span>
                                        {ghtkPickOption === 'post' && (
                                            <span style={{ fontSize: 10, color: '#8c8c8c' }}>(Dùng làm thông tin người gửi & địa chỉ hoàn hàng nếu giao thất bại)</span>
                                        )}
                                    </div>
                                    <Select
                                        style={{ width: '100%' }}
                                        size="small"
                                        value={selectedPickAddressId || undefined}
                                        onChange={setSelectedPickAddressId}
                                        placeholder={ghtkPickOption === 'post' ? "Chọn kho gửi & hoàn trả hàng" : "Chọn kho lấy hàng"}
                                        options={ghtkPickAddresses.map((p: any) => ({
                                            value: p.pick_address_id || p.address,
                                            label: `${p.pick_name || 'Kho'} - ${p.address}`
                                        }))}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Checkbox checked={isCod} onChange={e => setIsCod(e.target.checked)}>
                                        <span style={{ fontSize: 12, fontWeight: 500 }}>Thu tiền COD:</span>
                                    </Checkbox>
                                    {isCod && (
                                        <InputNumber
                                            size="small"
                                            style={{ width: 140 }}
                                            value={pickMoney}
                                            onChange={(v: any) => setPickMoney(v || 0)}
                                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            placeholder="Tiền COD"
                                        />
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                                    <span style={{ fontSize: 12 }}>Người trả ship:</span>
                                    <Radio.Group size="small" value={isFreeship} onChange={e => setIsFreeship(e.target.value)}>
                                        <Radio.Button value={1}>Shop trả</Radio.Button>
                                        <Radio.Button value={0}>Khách trả</Radio.Button>
                                    </Radio.Group>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px dashed #f0f0f0' }}>
                                <Button 
                                    size="small" 
                                    type="dashed" 
                                    icon={<CalculatorOutlined />} 
                                    loading={ghtkEstimateLoading} 
                                    onClick={handleGhtkEstimateFee}
                                >
                                    Tra cước GHTK
                                </Button>
                                {!editingDeliveryId && !isDraft && (
                                    <Checkbox checked={pushToGhtkDirectly} onChange={e => setPushToGhtkDirectly(e.target.checked)}>
                                        <span style={{ fontSize: 12, color: ghtkConfig?.isConfigured ? '#008444' : '#fa8c16', fontWeight: 500 }}>
                                            🚀 {ghtkConfig?.isConfigured ? 'Tự động đẩy đơn sang GHTK khi lưu phiếu' : 'Tự động tạo vận đơn Demo khi lưu phiếu'}
                                        </span>
                                    </Checkbox>
                                )}
                            </div>
                        </div>
                    )}

                    {/* LALAMOVE ENHANCED PANEL */}
                    {shippingCarrier === 'LALAMOVE' && (
                        <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #ffd591', marginTop: 10, boxShadow: '0 1px 3px rgba(235,97,0,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#d4380d' }}>
                                        🚚 Lựa chọn phương tiện & Tra cước Lalamove:
                                    </span>
                                    {packageWeight && (
                                        <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>
                                            ⚖️ {packageWeight >= 1000 ? `${(packageWeight / 1000).toFixed(1)}kg` : `${packageWeight}g`}
                                        </Tag>
                                    )}
                                </div>
                                <div style={{ fontSize: 12, color: '#eb6100', fontWeight: 600 }}>
                                    ✨ Gợi ý xe:{' '}
                                    <span style={{ textDecoration: 'underline' }}>
                                        {LALAMOVE_VEHICLES.find(v => v.key === getRecommendedLalamoveVehicle(packageWeight, packageLength, packageWidth, packageHeight))?.name}
                                    </span>
                                </div>
                            </div>

                            {/* Vehicle Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                                {LALAMOVE_VEHICLES.map(veh => {
                                    const isSelected = lalamoveModalServiceType === veh.key;
                                    return (
                                        <div
                                            key={veh.key}
                                            onClick={() => {
                                                setLalamoveModalServiceType(veh.key);
                                                setLalamoveEstimatedFeeInfo(null);
                                            }}
                                            style={{
                                                padding: '8px 10px',
                                                borderRadius: 6,
                                                border: isSelected ? '2px solid #eb6100' : '1px solid #e2e8f0',
                                                background: isSelected ? '#fff7e6' : '#fafafa',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease-in-out',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12, color: isSelected ? '#d4380d' : '#334155' }}>
                                                <span style={{ fontSize: 16 }}>{veh.icon}</span>
                                                <span>{veh.name}</span>
                                            </div>
                                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {veh.desc}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Addresses Preview */}
                            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, border: '1px dashed #cbd5e1', marginBottom: 10, fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#334155' }}>
                                    <span style={{ color: '#52c41a', fontWeight: 600 }}>🟢 Điểm lấy:</span>
                                    <span>{lalamoveConfig?.defaultPickAddress || 'Kho ERP4U, Tân Thới Nhất, Quận 12, TP.HCM'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                                    <span style={{ color: '#d4380d', fontWeight: 600 }}>🔴 Điểm giao:</span>
                                    <span style={{ fontWeight: 500, color: shipAddress ? '#1e293b' : '#ff4d4f' }}>
                                        {shipAddress || '⚠️ Chưa có địa chỉ giao hàng (vui lòng chọn hoặc nhập ở trên)'}
                                    </span>
                                </div>
                            </div>

                            {/* Fee Calculation Result Card */}
                            {lalamoveEstimatedFeeInfo && (
                                <div style={{ background: '#fff7e6', padding: '10px 14px', borderRadius: 6, border: '1px solid #ffbb96', marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                                Ước tính cước xe <b>{lalamoveEstimatedFeeInfo.vehicleName}</b> (~{lalamoveEstimatedFeeInfo.distanceKm} km):
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: '#d4380d' }}>
                                                {Number(lalamoveEstimatedFeeInfo.estimatedFee).toLocaleString()} đ
                                            </div>
                                            {lalamoveEstimatedFeeInfo.priceBreakdown && (
                                                <div style={{ fontSize: 11, color: '#595959', marginTop: 2 }}>
                                                    Cước gốc: {Number(lalamoveEstimatedFeeInfo.priceBreakdown.base || 0).toLocaleString()}đ
                                                    {Number(lalamoveEstimatedFeeInfo.priceBreakdown.vat || 0) > 0 && ` • VAT: ${Number(lalamoveEstimatedFeeInfo.priceBreakdown.vat).toLocaleString()}đ`}
                                                </div>
                                            )}
                                            {lalamoveEstimatedFeeInfo.dropCoordinates?.lat && (
                                                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 3 }}>
                                                    📍 GPS điểm giao: <code>{lalamoveEstimatedFeeInfo.dropCoordinates.lat}, {lalamoveEstimatedFeeInfo.dropCoordinates.lng}</code>
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            size="middle"
                                            type="primary"
                                            icon={<CheckCircleOutlined />}
                                            style={{ background: '#eb6100', borderColor: '#eb6100' }}
                                            onClick={handleApplyLalamoveEstimatedFee}
                                        >
                                            Áp dụng vào Chi phí VC
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Actions Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px dashed #f0f0f0', flexWrap: 'wrap', gap: 8 }}>
                                <Button
                                    size="small"
                                    type="dashed"
                                    icon={<CalculatorOutlined />}
                                    loading={lalamoveEstimateLoading}
                                    onClick={handleLalamoveEstimateFee}
                                    style={{ color: '#d4380d', borderColor: '#ffd591' }}
                                >
                                    ⚡ Tra cước Lalamove
                                </Button>
                                {!editingDeliveryId && !isDraft && (
                                    <Checkbox checked={pushToLalamoveDirectly} onChange={e => setPushToLalamoveDirectly(e.target.checked)}>
                                        <span style={{ fontSize: 12, color: '#d4380d', fontWeight: 500 }}>
                                            🚀 Tự động đặt cuốc Lalamove khi lưu phiếu
                                        </span>
                                    </Checkbox>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <Input.TextArea rows={2} placeholder="Ghi chú giao hàng..." value={shipNote} onChange={e => setShipNote(e.target.value)} style={{ marginBottom: 10 }} />

                <div style={{ marginBottom: 10 }}>
                    <AttachmentUpload value={attachments} onChange={setAttachments} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontWeight: 'bold' }}>Danh sách sản phẩm xuất kho:</div>
                    <Space size="small">
                        <Button 
                            size="small" 
                            type="dashed"
                            onClick={() => {
                                const filled = shipItems.map(item => ({
                                    ...item,
                                    quantity: item.max > 0 ? item.max : 0
                                }));
                                setShipItems(filled);
                                message.success('Đã điền toàn bộ số lượng cần giao');
                            }}
                        >
                            ⚡ Điền nhanh toàn bộ SL cần giao
                        </Button>
                        <Button 
                            size="small" 
                            onClick={() => {
                                const cleared = shipItems.map(item => ({
                                    ...item,
                                    quantity: 0
                                }));
                                setShipItems(cleared);
                            }}
                        >
                            Xóa trắng SL
                        </Button>
                    </Space>
                </div>
                {!isDraft && (
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#fa8c16' }}>ℹ️</span>
                        <span>Ưu tiên xuất cho sản phẩm đã duyệt giữ kho. Sản phẩm chưa duyệt vẫn có thể nhập nếu còn tồn kho khả dụng hoặc chọn <b>Bản nháp</b>.</span>
                    </div>
                )}
                {isDraft && <div style={{ fontSize: 12, color: '#1890ff', marginBottom: 10, fontStyle: 'italic' }}>* Đang tạo Phiếu Nháp: Có thể điền số lượng tự do không cần giữ kho. Tồn kho sẽ KHÔNG bị trừ.</div>}

                <Table 
                    dataSource={shipItems} 
                    rowKey="sku" 
                    pagination={false} 
                    size="small" 
                    columns={[
                        { 
                            title: 'Sản phẩm', 
                            dataIndex: 'sku',
                            render: (sku: string, r: any) => (
                                <div>
                                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.name || sku}</div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>SKU: <code>{sku}</code></div>
                                </div>
                            )
                        },
                        { 
                            title: 'Trạng thái', 
                            width: 100, 
                            align: 'center', 
                            render: (r: any) => {
                                if (r.bookingStatus === 'CONFIRMED') return <Tag color="green" style={{ margin: 0 }}>Sẵn sàng</Tag>;
                                if (r.bookingStatus === 'TEMPORARY') return <Tag color="orange" style={{ margin: 0 }}>Chưa duyệt</Tag>;
                                return <Tag style={{ margin: 0 }}>Chưa giữ kho</Tag>;
                            }
                        },
                        { title: 'SL Cần giao', dataIndex: 'max', width: 90, align: 'right' },
                        { 
                            title: 'Giao lần này', 
                            width: 130,
                            align: 'center',
                            render: (_: any, r: any, idx: number) => {
                                const isRestricted = !isDraft && r.bookingStatus !== 'CONFIRMED' && (r.stock || 0) <= 0;
                                return (
                                    <InputNumber 
                                        max={r.max} 
                                        min={0} 
                                        value={r.quantity} 
                                        disabled={isRestricted}
                                        style={{ width: '100%' }}
                                        onChange={(v: any) => { 
                                            const newItems = [...shipItems]; 
                                            newItems[idx].quantity = v || 0; 
                                            setShipItems(newItems); 
                                        }} 
                                    />
                                );
                            }
                        },
                        {
                            title: 'Thành tiền',
                            width: 130,
                            align: 'right',
                            render: (_: any, r: any) => {
                                const lineTotal = (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);
                                return <span style={{ fontWeight: 500 }}>{lineTotal.toLocaleString('vi-VN')} đ</span>;
                            }
                        }
                    ]} 
                    summary={(pageData) => {
                        const totalQty = pageData.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
                        const totalAmt = pageData.reduce((sum, r) => sum + ((Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)), 0);
                        return (
                            <Table.Summary fixed>
                                <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
                                    <Table.Summary.Cell index={0} colSpan={2}>
                                        Tổng cộng đợt xuất này ({pageData.filter(r => Number(r.quantity) > 0).length} sản phẩm):
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={2} />
                                    <Table.Summary.Cell index={3} align="center">
                                        <span style={{ color: '#1677ff' }}>{totalQty}</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={4} align="right">
                                        <span style={{ color: '#008444' }}>{totalAmt.toLocaleString('vi-VN')} đ</span>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        );
                    }}
                />

                {shipItems.every(i => Number(i.quantity) <= 0) && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#d46b08', background: '#fffbe6', border: '1px solid #ffe58f', padding: '6px 10px', borderRadius: 4 }}>
                        💡 <b>Lưu ý:</b> Các sản phẩm đều có số lượng xuất là 0. Khi đẩy đơn sang GHTK, hệ thống sẽ tự động dùng danh sách toàn bộ sản phẩm của Đơn Hàng Bán để GHTK không bị "0 Sản phẩm".
                    </div>
                )}

                {/* KHU VỰC THÔNG BÁO GIAO HÀNG (GỬI ZALO / KHÁCH HÀNG) */}
                <Divider style={{ margin: '16px 0 12px 0' }} />
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MessageOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>Nội Dung Thông Báo Giao Hàng (Gửi Khách / Zalo):</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Select
                                size="small"
                                style={{ width: 230 }}
                                value={selectedNoticeTemplateId}
                                onChange={val => handleNoticeTemplateSelect(val)}
                                options={deliveryNoticeTemplates.map(t => ({
                                    value: t.id,
                                    label: t.name + (t.isDefault ? ' (Mặc định)' : '')
                                }))}
                            />
                            <Tooltip title="Điền lại thông tin mới nhất từ danh sách xuất kho & đơn hàng">
                                <Button size="small" icon={<CalculatorOutlined />} onClick={handleRegenerateNotice}>
                                    Điền lại
                                </Button>
                            </Tooltip>
                            <Tooltip title="Sao chép nội dung vào Clipboard">
                                <Button size="small" type="primary" ghost icon={<CopyOutlined />} onClick={() => handleCopyNotice(deliveryNotice)}>
                                    Sao chép
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                    <Input.TextArea
                        rows={7}
                        value={deliveryNotice}
                        onChange={e => setDeliveryNotice(e.target.value)}
                        placeholder="Nội dung thông báo giao hàng sẽ tự động điền theo mẫu. Bạn có thể tự do chỉnh sửa trước khi lưu phiếu xuất..."
                        style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        💡 Thông báo này sẽ được lưu cùng Phiếu xuất kho. Bạn có thể sao chép nhanh gửi Zalo cho Khách hàng bất kỳ lúc nào từ danh sách phiếu.
                    </div>
                </div>
            </Modal>

            {/* Quick Upload Modal */}
            <Modal title="Cập nhật chứng từ giao hàng" open={uploadModalOpen} onCancel={() => setUploadModalOpen(false)} onOk={handleUploadSave} width={500}>
                <div style={{ marginBottom: 15 }}>Tải lên hình ảnh chứng thực giao hàng (Phiếu xuất kho có ký nhận, hình ảnh hàng hóa tại công trình...)</div>
                <AttachmentUpload value={uploadAttachments} onChange={setUploadAttachments} />
            </Modal>

            {/* GHTK Tracking Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CarOutlined style={{ color: '#008444' }} />
                        <span>Hành trình Vận Đơn GHTK: <b>{trackingDelivery?.tracking_code}</b></span>
                    </div>
                }
                open={trackingModalOpen}
                onCancel={() => setTrackingModalOpen(false)}
                footer={[
                    <Button key="print" type="dashed" icon={<FilePdfOutlined />} onClick={() => handlePrintGhtkLabel(trackingDelivery)}>
                        In nhãn A6
                    </Button>,
                    <Button key="close" type="primary" onClick={() => setTrackingModalOpen(false)}>
                        Đóng
                    </Button>
                ]}
                width={550}
            >
                {trackingLoading ? (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <Spin tip="Đang tra cứu hành trình từ GHTK..." />
                    </div>
                ) : (
                    <div>
                        <div style={{ background: '#f6ffed', padding: 10, borderRadius: 6, border: '1px solid #b7eb8f', marginBottom: 15 }}>
                            <div style={{ fontWeight: 600, color: '#008444', marginBottom: 4 }}>
                                Trạng thái: {trackingData?.status_text || trackingDelivery?.shipping_status_text || 'Đang cập nhật'}
                            </div>
                            <div style={{ fontSize: 12, color: '#595959' }}>
                                Người nhận: <b>{trackingDelivery?.contact_name}</b> ({trackingDelivery?.contact_phone})
                            </div>
                            <div style={{ fontSize: 12, color: '#595959' }}>
                                Địa chỉ: {trackingDelivery?.delivery_address}
                            </div>
                        </div>

                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Lịch sử vận chuyển:</div>
                        {trackingData?.timeline && trackingData.timeline.length > 0 ? (
                            <div style={{ maxHeight: 250, overflowY: 'auto', paddingLeft: 10 }}>
                                {trackingData.timeline.map((t: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 12, borderLeft: '2px solid #008444', paddingLeft: 10 }}>
                                        <div style={{ fontSize: 11, color: '#888', minWidth: 120 }}>
                                            {dayjs(t.time).format('DD/MM/YYYY HH:mm')}
                                        </div>
                                        <div style={{ fontSize: 12, fontWeight: 500 }}>
                                            {t.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: '#888', fontStyle: 'italic', fontSize: 12, textAlign: 'center', padding: '15px 0' }}>
                                Chưa có cập nhật mới từ Shipper GHTK.
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* MODAL CẤU HÌNH NHANH GHTK */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CarOutlined style={{ color: '#008444' }} />
                        <span>Cấu hình Kết nối Giao Hàng Tiết Kiệm (GHTK)</span>
                    </div>
                }
                open={ghtkConfigModalOpen}
                onCancel={() => setGhtkConfigModalOpen(false)}
                footer={[
                    <Button key="cancel" onClick={() => setGhtkConfigModalOpen(false)}>Đóng</Button>,
                    <Button 
                        key="test" 
                        icon={<ThunderboltOutlined />} 
                        loading={ghtkTestLoading} 
                        onClick={handleTestGhtkConnection}
                    >
                        Kiểm tra kết nối
                    </Button>,
                    <Button 
                        key="save" 
                        type="primary" 
                        style={{ background: '#008444', borderColor: '#008444' }} 
                        loading={ghtkSaveLoading} 
                        onClick={handleSaveGhtkConfig}
                    >
                        Lưu cấu hình
                    </Button>
                ]}
                width={560}
            >
                <Alert 
                    type="info" 
                    showIcon 
                    style={{ marginBottom: 16 }}
                    message={
                        <div style={{ fontSize: 12 }}>
                            Lấy API Token tại: <b>Cổng Khách Hàng GHTK</b> &gt; <i>Thông tin shop / Tài khoản</i>.
                            Token sẽ được lưu an toàn trong hệ thống để tạo vận đơn và tính phí ship tự động.
                        </div>
                    }
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                            API Token GHTK <span style={{ color: 'red' }}>*</span>
                        </div>
                        <Input.Password
                            placeholder={ghtkConfig?.hasToken ? `Đã có token (${ghtkConfig.maskedToken}). Nhập mới nếu muốn thay đổi.` : "Dán chuỗi API Token được GHTK cấp vào đây..."}
                            value={ghtkTokenInput}
                            onChange={e => setGhtkTokenInput(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Môi trường kết nối:</div>
                            <Radio.Group 
                                value={ghtkIsSandboxInput} 
                                onChange={e => setGhtkIsSandboxInput(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <Radio.Button value={false} style={{ width: '50%', textAlign: 'center' }}>Thực tế (Prod)</Radio.Button>
                                <Radio.Button value={true} style={{ width: '50%', textAlign: 'center' }}>Thử nghiệm (Test)</Radio.Button>
                            </Radio.Group>
                        </div>

                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Mã Đối Tác / Client Source:</div>
                            <Input 
                                placeholder="VD: S308157 hoặc PACE_ERP" 
                                value={ghtkPartnerCodeInput}
                                onChange={e => setGhtkPartnerCodeInput(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Mã kho lấy hàng mặc định (pick_address_id):</div>
                            <Input 
                                placeholder="Mã kho từ GHTK (VD: 88256)" 
                                value={ghtkDefaultPickAddressInput}
                                onChange={e => setGhtkDefaultPickAddressInput(e.target.value)}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Hình thức gửi hàng mặc định:</div>
                            <Radio.Group 
                                buttonStyle="solid" 
                                value={ghtkDefaultPickOptionInput} 
                                onChange={e => setGhtkDefaultPickOptionInput(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <Radio.Button value="cod" style={{ width: '50%', textAlign: 'center' }}>🚚 Shipper lấy</Radio.Button>
                                <Radio.Button value="post" style={{ width: '50%', textAlign: 'center' }}>🏪 Gửi bưu cục</Radio.Button>
                            </Radio.Group>
                        </div>
                    </div>

                    {ghtkTestResult && (
                        <Alert 
                            type={ghtkTestResult.success ? 'success' : 'error'}
                            showIcon
                            style={{ marginTop: 8 }}
                            message={ghtkTestResult.message}
                            description={
                                ghtkTestResult.pickAddresses?.length > 0 && (
                                    <div style={{ marginTop: 4, fontSize: 11 }}>
                                        Kho nhận diện được: {ghtkTestResult.pickAddresses.map((p: any) => `${p.pick_name || 'Kho'} (${p.address})`).join('; ')}
                                    </div>
                                )
                            }
                        />
                    )}
                </div>
            </Modal>

            {/* Modal Xem & Chỉnh sửa Thông báo Giao Hàng từ lịch sử phiếu */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MessageOutlined style={{ color: '#1677ff' }} />
                        <span>Thông Báo Giao Hàng - Phiếu: <b>{selectedDeliveryForNotice?.code}</b></span>
                    </div>
                }
                open={viewNoticeModalOpen}
                onCancel={() => setViewNoticeModalOpen(false)}
                width={650}
                footer={[
                    <Button key="close" onClick={() => setViewNoticeModalOpen(false)}>
                        Đóng
                    </Button>,
                    <Button 
                        key="copy" 
                        type="dashed" 
                        icon={<CopyOutlined />} 
                        onClick={() => handleCopyNotice(editingSavedNotice)}
                    >
                        Sao chép nội dung
                    </Button>,
                    <Button 
                        key="save" 
                        type="primary" 
                        loading={isSavingNotice} 
                        onClick={handleSaveDeliveryNoticeOnly}
                    >
                        Lưu thay đổi
                    </Button>
                ]}
            >
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                        Khách hàng: <b>{order?.customer?.name || order?.customer_name}</b> | Ngày: <b>{dayjs(selectedDeliveryForNotice?.delivery_date).format('DD/MM/YYYY')}</b>
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12 }}>Đổi mẫu:</span>
                        <Select
                            size="small"
                            style={{ width: 220 }}
                            placeholder="Chọn mẫu khác..."
                            onChange={(tplId) => {
                                const tpl = deliveryNoticeTemplates.find(t => t.id === tplId);
                                if (tpl && selectedDeliveryForNotice) {
                                    const gen = formatDeliveryNotice(tpl.content, {
                                        order,
                                        delivery: selectedDeliveryForNotice,
                                        shipItems: selectedDeliveryForNotice.items || [],
                                        shipDate: selectedDeliveryForNotice.delivery_date,
                                        shipAddress: selectedDeliveryForNotice.delivery_address,
                                        shipContactName: selectedDeliveryForNotice.contact_name,
                                        shipContactPhone: selectedDeliveryForNotice.contact_phone,
                                        shippingCarrier: selectedDeliveryForNotice.shipping_carrier,
                                        isCod: Number(selectedDeliveryForNotice.pick_money) > 0,
                                        pickMoney: selectedDeliveryForNotice.pick_money,
                                        companyConfig: companyConfig || {},
                                        products
                                    });
                                    setEditingSavedNotice(gen);
                                    message.info(`Đã áp dụng mẫu: ${tpl.name}`);
                                }
                            }}
                            options={deliveryNoticeTemplates.map(t => ({
                                value: t.id,
                                label: t.name
                            }))}
                        />
                    </div>
                </div>
                <Input.TextArea
                    rows={13}
                    value={editingSavedNotice}
                    onChange={e => setEditingSavedNotice(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: '1.5' }}
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>
                    * Bạn có thể chỉnh sửa nội dung thông báo trên đây và bấm "Lưu thay đổi" để cập nhật vào phiếu xuất kho, hoặc bấm "Sao chép nội dung" để gửi Zalo cho khách.
                </div>
            </Modal>

            {/* Modal Gửi ZNS Thông Báo Giao Hàng */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SendOutlined style={{ color: '#0068ff' }} />
                        <span>Gửi Thông Báo Giao Hàng ZNS qua Zalo OA: <b>{selectedDeliveryForZns?.code}</b></span>
                    </div>
                }
                open={znsDeliveryModalOpen}
                onCancel={() => setZnsDeliveryModalOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setZnsDeliveryModalOpen(false)}>
                        Đóng
                    </Button>,
                    <Button
                        key="send"
                        type="primary"
                        style={{ background: '#0068ff', borderColor: '#0068ff' }}
                        loading={isSendingDeliveryZns}
                        onClick={handleConfirmSendDeliveryZns}
                        icon={<SendOutlined />}
                    >
                        Xác nhận gửi ZNS
                    </Button>
                ]}
                width={620}
            >
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 14 }}
                    message={
                        <div style={{ fontSize: 12 }}>
                            Hệ thống sẽ gửi mẫu ZNS Thông Báo Giao Hàng qua Zalo OA chính thức đến số điện thoại người nhận.
                        </div>
                    }
                />

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#1e293b' }}>
                        Thông tin người nhận Zalo:
                    </div>

                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Chọn số điện thoại:</div>
                        <Radio.Group
                            value={znsDeliveryPhone}
                            onChange={e => setZnsDeliveryPhone(e.target.value)}
                            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                        >
                            {selectedDeliveryForZns?.contact_phone && (
                                <Radio value={selectedDeliveryForZns.contact_phone}>
                                    <span>SĐT Người nhận tại công trình / PXK: <b>{selectedDeliveryForZns.contact_phone}</b> ({selectedDeliveryForZns.contact_name})</span>
                                </Radio>
                            )}
                            {order?.receiver_phone && order.receiver_phone !== selectedDeliveryForZns?.contact_phone && (
                                <Radio value={order.receiver_phone}>
                                    <span>SĐT Người nhận đơn hàng: <b>{order.receiver_phone}</b> ({order.receiver_name})</span>
                                </Radio>
                            )}
                            {order?.customer?.phone && order.customer.phone !== selectedDeliveryForZns?.contact_phone && order.customer.phone !== order?.receiver_phone && (
                                <Radio value={order.customer.phone}>
                                    <span>SĐT Khách hàng: <b>{order.customer.phone}</b> ({order.customer.name})</span>
                                </Radio>
                            )}
                        </Radio.Group>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, marginTop: 8 }}>
                        <div>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Số điện thoại gửi ZNS: <span style={{ color: 'red' }}>*</span></div>
                            <Input
                                placeholder="VD: 0938429210"
                                value={znsDeliveryPhone}
                                onChange={e => setZnsDeliveryPhone(e.target.value)}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Tên người nhận xưng hô:</div>
                            <Input
                                placeholder="VD: Anh Nam"
                                value={znsDeliveryRecipientName}
                                onChange={e => setZnsDeliveryRecipientName(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #d9d9d9', marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, color: '#334155' }}>
                        Dữ liệu tin nhắn sẽ gửi:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
                        <div>Mã phiếu XK: <b>{selectedDeliveryForZns?.code}</b></div>
                        <div>Mã đơn hàng: <b>{order?.order_code || 'Chưa có'}</b></div>
                        <div>ĐV Vận chuyển: <b>{selectedDeliveryForZns?.shipping_legs?.length ? `${selectedDeliveryForZns.shipping_legs.length} chặng` : (selectedDeliveryForZns?.shipping_carrier || 'Chành xe / Nội bộ')}</b></div>
                        <div>Mã vận đơn: <b>{selectedDeliveryForZns?.tracking_code || 'Chưa có'}</b></div>
                        <div>Thu COD: <b>{Number(selectedDeliveryForZns?.pick_money || 0).toLocaleString()}đ</b></div>
                        <div>Ngày giao: <b>{dayjs(selectedDeliveryForZns?.delivery_date).format('DD/MM/YYYY')}</b></div>
                        <div style={{ gridColumn: 'span 2' }}>Địa chỉ nhận: <b>{selectedDeliveryForZns?.delivery_address || 'Theo thỏa thuận'}</b></div>
                    </div>
                </div>

                {deliveryZnsResult && (
                    <Alert
                        type={deliveryZnsResult.success ? 'success' : 'warning'}
                        showIcon
                        style={{ marginTop: 10 }}
                        message={deliveryZnsResult.success ? 'Gửi ZNS thành công!' : 'Kết quả gửi tin ZNS'}
                        description={
                            <div>
                                <div>{deliveryZnsResult.message}</div>
                                {deliveryZnsResult.data?.msg_id && (
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                                        Mã tin nhắn Zalo (msg_id): <code>{deliveryZnsResult.data.msg_id}</code>
                                    </div>
                                )}
                            </div>
                        }
                    />
                )}
            </Modal>

            {/* MODAL ĐẶT XE LALAMOVE (API v3) */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 22 }}>🚚</span>
                            <div>
                                <div style={{ fontWeight: 700, color: '#eb6100', fontSize: 16 }}>Đặt Xe Lalamove - Giao Hỏa Tốc & Xe Tải</div>
                                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                                    Phiếu xuất: <b>{selectedDeliveryForLalamove?.code}</b> • Đơn hàng: <b>{order?.code}</b>
                                </div>
                            </div>
                        </div>
                        {lalamoveConfig && (
                            <Tag color={lalamoveConfig.isConfigured ? (lalamoveConfig.isSandbox ? 'blue' : 'green') : 'orange'}>
                                {lalamoveConfig.isConfigured ? (lalamoveConfig.isSandbox ? 'Sandbox Test' : 'Production Live') : 'Chế độ Demo'}
                            </Tag>
                        )}
                    </div>
                }
                open={lalamoveBookingModalOpen}
                onCancel={() => setLalamoveBookingModalOpen(false)}
                width={760}
                footer={[
                    <Button key="cancel" onClick={() => setLalamoveBookingModalOpen(false)}>Đóng</Button>,
                    <Button 
                        key="re-quote" 
                        icon={<ThunderboltOutlined />} 
                        loading={lalamoveLoadingQuotation} 
                        onClick={() => fetchLalamoveQuotation(
                            lalamoveServiceType,
                            lalamovePickupLat, lalamovePickupLng, lalamovePickupAddress,
                            lalamoveDropLat, lalamoveDropLng, lalamoveDropAddress,
                            selectedDeliveryForLalamove?.package_count || 1,
                            selectedDeliveryForLalamove?.weight_gram || 500
                        )}
                    >
                        Lấy lại báo giá
                    </Button>,
                    <Button 
                        key="confirm-push" 
                        type="primary" 
                        style={{ background: '#eb6100', borderColor: '#eb6100' }} 
                        icon={<SendOutlined />} 
                        loading={lalamovePushingOrder} 
                        onClick={handleConfirmPushLalamove}
                    >
                        🚀 Xác nhận Đặt Xe Lalamove
                    </Button>
                ]}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* CHỌN LOẠI PHƯƠNG TIỆN */}
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#1e293b' }}>
                            1. Chọn loại phương tiện vận chuyển:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {[
                                { key: 'MOTORCYCLE', name: 'Xe máy', icon: '🛵', desc: 'Nhỏ gọn < 30kg' },
                                { key: 'VAN_500KG', name: 'Bán tải 500kg (Van)', icon: '🚐', desc: 'Khuyên dùng: 20-40 nệm, che mưa' },
                                { key: 'VAN_1000KG', name: 'Bán tải 1T (Van)', icon: '🚐', desc: '50-80 nệm hoặc combo bàn ghế' },
                                { key: 'TRUCK_1000KG', name: 'Xe tải 1 tấn', icon: '🚚', desc: 'Dự án trường, hàng lớn' },
                                { key: 'TRUCK_1500KG', name: 'Xe tải 1.5 tấn', icon: '🚚', desc: 'Giao sỉ ra Chành xe Bến xe' },
                                { key: 'TRUCK_2000KG', name: 'Xe tải 2 tấn', icon: '🚛', desc: 'Đơn trường mầm non lớn' },
                            ].map(veh => {
                                const isSelected = lalamoveServiceType === veh.key;
                                return (
                                    <div 
                                        key={veh.key}
                                        onClick={() => {
                                            setLalamoveServiceType(veh.key);
                                            fetchLalamoveQuotation(
                                                veh.key,
                                                lalamovePickupLat, lalamovePickupLng, lalamovePickupAddress,
                                                lalamoveDropLat, lalamoveDropLng, lalamoveDropAddress,
                                                selectedDeliveryForLalamove?.package_count || 1,
                                                selectedDeliveryForLalamove?.weight_gram || 500
                                            );
                                        }}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: isSelected ? '2px solid #eb6100' : '1px solid #e2e8f0',
                                            background: isSelected ? '#fff7e6' : '#ffffff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: isSelected ? '0 2px 8px rgba(235,97,0,0.15)' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: isSelected ? '#eb6100' : '#334155' }}>
                                            <span style={{ fontSize: 18 }}>{veh.icon}</span>
                                            <span>{veh.name}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{veh.desc}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* LỘ TRÌNH VẬN CHUYỂN */}
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>
                            2. Lộ trình giao hàng (Tọa độ GPS):
                        </div>
                        
                        {/* Điểm 1: Kho ERP4U */}
                        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#0958d9', marginBottom: 4 }}>
                                <span>🟢 Điểm 1 (Bốc hàng): Kho ERP4U</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 8 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Địa chỉ kho:</div>
                                    <Input size="small" value={lalamovePickupAddress} onChange={e => setLalamovePickupAddress(e.target.value)} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Tọa độ Vĩ độ (Lat):</div>
                                    <Input size="small" value={lalamovePickupLat} onChange={e => setLalamovePickupLat(e.target.value)} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Tọa độ Kinh độ (Lng):</div>
                                    <Input size="small" value={lalamovePickupLng} onChange={e => setLalamovePickupLng(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Điểm 2: Giao hàng */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#d4380d' }}>
                                    <span>🔴 Điểm 2 (Giao hàng): Khách nhận / Bến xe / Chành xe</span>
                                </div>
                                <Button 
                                    size="small" 
                                    icon={<ThunderboltOutlined />} 
                                    loading={lalamoveGeocoding}
                                    onClick={handleReGeocodeAndQuote}
                                    style={{ fontSize: 11, height: 22 }}
                                >
                                    Định vị GPS tự động
                                </Button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Địa chỉ nhận:</div>
                                    <Input size="small" value={lalamoveDropAddress} onChange={e => setLalamoveDropAddress(e.target.value)} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Vĩ độ nhận (Lat):</div>
                                    <Input size="small" value={lalamoveDropLat} onChange={e => setLalamoveDropLat(e.target.value)} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Kinh độ nhận (Lng):</div>
                                    <Input size="small" value={lalamoveDropLng} onChange={e => setLalamoveDropLng(e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Tên người nhận:</div>
                                    <Input size="small" value={lalamoveDropName} onChange={e => setLalamoveDropName(e.target.value)} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>SĐT người nhận (E.164):</div>
                                    <Input size="small" value={lalamoveDropPhone} onChange={e => setLalamoveDropPhone(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GHI CHÚ BỐC XẾP */}
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                            3. Ghi chú cho tài xế Lalamove (Số lượng kiện, yêu cầu che mưa, hỗ trợ bốc xếp):
                        </div>
                        <Input.TextArea 
                            rows={2} 
                            value={lalamoveRemarks} 
                            onChange={e => setLalamoveRemarks(e.target.value)} 
                            placeholder="VD: Giao 30 nệm mầm non, yêu cầu xe bạt che mưa, bốc vào sảnh tầng trệt..."
                        />
                    </div>

                    {/* HIỂN THỊ BÁO GIÁ CƯỚC REALTIME */}
                    <div style={{ background: '#fff7e6', padding: '12px 16px', borderRadius: 8, border: '1px solid #ffd591', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 12, color: '#d4380d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>⚡ CƯỚC PHÍ TẠM TÍNH LALAMOVE:</span>
                                {lalamoveLoadingQuotation && <Spin size="small" />}
                            </div>
                            {lalamoveQuotation ? (
                                <div style={{ marginTop: 4 }}>
                                    <span style={{ fontSize: 22, fontWeight: 800, color: '#eb6100' }}>
                                        {Number(lalamoveQuotation.priceBreakdown?.total || 0).toLocaleString()} VNĐ
                                    </span>
                                    <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b' }}>
                                        (Khoảng cách: {lalamoveQuotation.distance?.value ? (Number(lalamoveQuotation.distance.value) / 1000).toFixed(1) : 0} km)
                                    </span>
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                                    Chưa có báo giá. Hãy nhấn <b>"Lấy lại báo giá"</b> hoặc kiểm tra lại tọa độ 2 đầu.
                                </div>
                            )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <Tag color="orange" style={{ fontSize: 11 }}>Khóa giá 5 phút</Tag>
                            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>Trừ trực tiếp Ví trả trước</div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* MODAL XEM ẢNH NGHIỆM THU POD */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PictureOutlined style={{ color: '#52c41a' }} />
                        <span>Ảnh Chụp Nghiệm Thu Giao Hàng (Proof of Delivery - POD)</span>
                    </div>
                }
                open={lalamovePodModalOpen}
                onCancel={() => setLalamovePodModalOpen(false)}
                footer={[<Button key="close" onClick={() => setLalamovePodModalOpen(false)}>Đóng</Button>]}
                width={560}
            >
                {selectedLalamovePodImage ? (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <img 
                            src={selectedLalamovePodImage} 
                            alt="Proof of Delivery" 
                            style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, border: '1px solid #e2e8f0', objectFit: 'contain' }} 
                        />
                        <div style={{ marginTop: 12 }}>
                            <a href={selectedLalamovePodImage} target="_blank" rel="noreferrer">
                                <Button icon={<EyeOutlined />}>Mở ảnh gốc trong tab mới</Button>
                            </a>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>Chưa có ảnh chụp nghiệm thu</div>
                )}
            </Modal>

            {/* MODAL THÊM TIỀN TIP / PHÍ ƯU TIÊN */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DollarOutlined style={{ color: '#faad14' }} />
                        <span>Thêm Phí Ưu Tiên / Tiền Tip Cho Tài Xế Lalamove</span>
                    </div>
                }
                open={lalamoveTipModalOpen}
                onCancel={() => setLalamoveTipModalOpen(false)}
                onOk={handleConfirmTip}
                confirmLoading={lalamoveTipping}
                okText="Xác nhận gửi Tip"
                okButtonProps={{ style: { background: '#eb6100', borderColor: '#eb6100' } }}
            >
                <Alert
                    message="Thêm phí ưu tiên (tip) giúp tài xế nhận cuốc xe nhanh hơn trong giờ cao điểm hoặc trời mưa ngập."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Chọn mức phí ưu tiên nhanh:</div>
                    <Space size="middle" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                        {[10000, 20000, 30000, 50000, 100000].map(amt => (
                            <Button 
                                key={amt}
                                type={lalamoveTipAmount === amt ? 'primary' : 'default'}
                                style={lalamoveTipAmount === amt ? { background: '#eb6100', borderColor: '#eb6100' } : {}}
                                onClick={() => setLalamoveTipAmount(amt)}
                            >
                                +{amt.toLocaleString()}đ
                            </Button>
                        ))}
                    </Space>
                    <div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Hoặc nhập số tiền tùy chọn (VNĐ):</div>
                        <InputNumber
                            style={{ width: '100%' }}
                            min={5000}
                            step={5000}
                            value={lalamoveTipAmount}
                            onChange={v => setLalamoveTipAmount(v || 0)}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            addonAfter="VNĐ"
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
export default SalesDeliveries;
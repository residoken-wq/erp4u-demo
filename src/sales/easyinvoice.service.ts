import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SystemService } from '../system/system.service';
import { SalesOrder } from './sales-order.entity';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

function readNumberInVietnamese(number: number): string {
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

    if (number === 0) return 'Không đồng';

    let str = '';
    let numStr = Math.round(number).toString();
    
    // Split into chunks of 3
    const chunks = [];
    while (numStr.length > 0) {
        chunks.push(numStr.substring(Math.max(0, numStr.length - 3)));
        numStr = numStr.substring(0, Math.max(0, numStr.length - 3));
    }

    for (let i = 0; i < chunks.length; i++) {
        if (parseInt(chunks[i]) === 0 && i !== 0) continue;
        
        let chunkStr = '';
        const chunk = chunks[i].padStart(3, '0');
        const hundreds = parseInt(chunk[0]);
        const tens = parseInt(chunk[1]);
        const ones = parseInt(chunk[2]);

        if (hundreds > 0 || (i < chunks.length - 1 && chunks.length > 1 && parseInt(chunks[i]) > 0)) {
            chunkStr += digits[hundreds] + ' trăm ';
        }

        if (tens === 0 && ones > 0 && (hundreds > 0 || chunkStr.length > 0)) {
            chunkStr += 'lẻ ';
        } else if (tens === 1) {
            chunkStr += 'mười ';
        } else if (tens > 1) {
            chunkStr += digits[tens] + ' mươi ';
        }

        if (ones === 1 && tens > 1) {
            chunkStr += 'mốt ';
        } else if (ones === 5 && tens > 0) {
            chunkStr += 'lăm ';
        } else if (ones > 0 || (tens === 0 && hundreds === 0 && i === 0)) {
            if (!(tens === 0 && hundreds === 0 && i > 0)) {
                 chunkStr += digits[ones] + ' ';
            }
        }

        if (chunkStr.trim().length > 0) {
            str = chunkStr + units[i] + ' ' + str;
        }
    }

    str = str.trim().replace(/\s+/g, ' ') + ' đồng';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

@Injectable()
export class EasyInvoiceService {
    private readonly logger = new Logger(EasyInvoiceService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly systemService: SystemService
    ) {}

    private async getConfig() {
        const config = await this.systemService.getEasyInvoiceConfig();
        const url = config.EASYINVOICE_URL || 'http://api.softdreams.vn/'; // Default to test
        const username = config.EASYINVOICE_USERNAME;
        const password = config.EASYINVOICE_PASSWORD;
        const taxCode = config.EASYINVOICE_TAX_CODE;
        const pattern = config.EASYINVOICE_PATTERN;
        const serial = config.EASYINVOICE_SERIAL;

        if (!username || !password || !taxCode) {
            throw new Error('EasyInvoice configuration is missing. Please configure in settings.');
        }

        return { url, username, password, taxCode, pattern, serial };
    }

    private generateToken(httpMethod: string, username: string, password: string, taxCode: string): string {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID().replace(/-/g, '').toLowerCase();
        const signatureRawData = `${httpMethod.toUpperCase()}${timestamp}${nonce}`;
        
        const hash = crypto.createHash('md5').update(signatureRawData).digest();
        const signature = hash.toString('base64');
        
        return `${signature}:${nonce}:${timestamp}:${username}:${password}:${taxCode}`;
    }

    private async requestApi(endpoint: string, data: any, method: 'post' | 'get' = 'post') {
        const config = await this.getConfig();
        const baseUrl = config.url.endsWith('/') ? config.url : `${config.url}/`;
        const fullUrl = `${baseUrl}${endpoint}`;
        
        const token = this.generateToken(method, config.username, config.password, config.taxCode);
        
        try {
            const response = await firstValueFrom(
                this.httpService.request({
                    url: fullUrl,
                    method,
                    data,
                    headers: {
                        'Authentication': token,
                        'Content-Type': 'application/json'
                    }
                })
            );
            return response.data;
        } catch (error: any) {
            const errorDetails = error.response?.data;
            const errorMsg = typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails;
            this.logger.error(`EasyInvoice API Error (${endpoint}):`, errorDetails || error.message);
            throw new Error(`EasyInvoice API request failed: ${error.message}. Details: ${errorMsg || 'No details'}`);
        }
    }

    private escapeXml(unsafe: string): string {
        if (!unsafe) return '';
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    private buildInvoiceXml(order: SalesOrder): string {
        // Build product xml
        let productsXml = '';
        let totalAmount = 0;
        
        if (order.items && order.items.length > 0) {
            order.items.forEach((item, index) => {
                const productName = item.vat_content || item.product?.name || item.sku || 'Sản phẩm';
                const qty = item.quantity || 0;
                const price = item.unit_price || 0;
                const total = Number((qty * price).toFixed(6)); // Total trước thuế
                const vatRate = order.vat_rate || 0;
                let vatAmount = 0;
                if (vatRate > 0) {
                     vatAmount = Number((total * (vatRate / 100)).toFixed(6));
                }
                const amount = total + vatAmount;

                totalAmount += total;

                productsXml += `
                <Product>
                    <Code>${this.escapeXml(item.sku)}</Code>
                    <No>${index + 1}</No>
                    <Feature>1</Feature>
                    <ProdName>${this.escapeXml(productName)}</ProdName>
                    <ProdUnit>Cái</ProdUnit>
                    <ProdQuantity>${qty}</ProdQuantity>
                    <ProdPrice>${price}</ProdPrice>
                    <Total>${total}</Total>
                    <VATRate>${vatRate}</VATRate>
                    <VATAmount>${vatAmount}</VATAmount>
                    <Amount>${amount}</Amount>
                </Product>
                `;
            });
        }

        // Calculate totals
        const vatRate = order.vat_rate || 0;
        let totalVatAmount = 0;
        if (vatRate > 0) {
            totalVatAmount = Number((totalAmount * (vatRate / 100)).toFixed(6));
        }
        const grandTotal = totalAmount + totalVatAmount;
        
        // Basic customer info
        const buyer = order.contact_name || order.receiver_name || 'Khách hàng';
        const cusName = order.vat_company_name || order.customer?.legal_name || order.customer?.name || '';
        const cusTaxCode = order.vat_tax_code || order.customer?.tax_code || '';
        const cusAddress = order.vat_address || order.customer?.legal_address || order.customer?.address || ' ';
        const cusPhone = order.contact_phone || order.receiver_phone || order.customer?.phone || '';
        const cusEmail = order.vat_email || order.customer?.einvoice_email || '';

        const amountInWords = readNumberInVietnamese(grandTotal); 

        const xml = `
        <Invoices>
            <Inv>
                <Invoice>
                    <Ikey>${this.escapeXml(order.order_code)}</Ikey>
                    <CusCode>${order.customer_id || 'GUEST'}</CusCode>
                    <Buyer>${this.escapeXml(buyer)}</Buyer>
                    <CusName>${this.escapeXml(cusName)}</CusName>
                    ${cusEmail ? `<Email>${this.escapeXml(cusEmail)}</Email>` : ''}
                    <CusAddress>${this.escapeXml(cusAddress)}</CusAddress>
                    ${cusPhone ? `<CusPhone>${this.escapeXml(cusPhone)}</CusPhone>` : ''}
                    ${cusTaxCode ? `<CusTaxCode>${this.escapeXml(cusTaxCode)}</CusTaxCode>` : ''}
                    <PaymentMethod>2 - Chuyển khoản</PaymentMethod>
                    <CurrencyUnit>VND</CurrencyUnit>
                    <Products>
                        ${productsXml}
                    </Products>
                    <Total>${totalAmount}</Total>
                    <VATRate>${vatRate}</VATRate>
                    <VATAmount>${totalVatAmount}</VATAmount>
                    <Amount>${grandTotal}</Amount>
                    <AmountInWords>${amountInWords}</AmountInWords>
                </Invoice>
            </Inv>
        </Invoices>
        `;
        return xml.trim();
    }

    // 1. Tạo hóa đơn nháp (API V.1)
    async createDraftInvoice(order: SalesOrder) {
        const config = await this.getConfig();
        const xmlData = this.buildInvoiceXml(order);
        
        const payload = {
            XmlData: xmlData,
            Pattern: config.pattern || undefined,
            Serial: config.serial || undefined,
        };

        const result = await this.requestApi('api/publish/importInvoice', payload);
        
        if (result.Status !== 2 && result.Status !== '2') {
            throw new Error(`Lỗi tạo HĐ nháp: ${result.Message} - ${JSON.stringify(result.Data)}`);
        }

        return result.Data;
    }

    // 2. Tra cứu thông tin hóa đơn (Lấy LinkView, Status) (API V.25)
    async getInvoiceInfo(ikey: string) {
        const payload = {
            Ikeys: [ikey]
        };

        const result = await this.requestApi('api/publish/getInvoicesByIkeys', payload);
        
        if (result.Status !== 2 && result.Status !== '2') {
            throw new Error(`Lỗi tra cứu thông tin: ${result.Message}`);
        }

        if (result.Data?.Invoices && result.Data.Invoices.length > 0) {
            return result.Data.Invoices[0];
        }
        
        return null;
    }

    // 3. Tải Hóa đơn PDF / XML (API V.24)
    async downloadInvoicePdf(ikey: string) {
        const payload = {
            Ikey: ikey,
            Option: 0
        };

        const result = await this.requestApi('api/publish/getInvoicePdf', payload);
        // Có thể trả về chuỗi Base64
        return result; 
    }
    
    // 4. Gửi email (API V.28)
    async sendEmailNotice(ikey: string, email: string) {
        const payload = {
            IkeyEmail: {
                [ikey]: email
            }
        };

        const result = await this.requestApi('api/business/sendIssuanceNotice', payload);
        
        if (result.Status !== 2 && result.Status !== '2') {
            throw new Error(`Lỗi gửi email: ${result.Message}`);
        }

        return result.Data;
    }
}

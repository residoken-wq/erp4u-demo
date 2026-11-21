import { ForbiddenException } from '@nestjs/common';
import { DemoModeService } from '../demo-mode.service';
import { EmailService } from '../email.service';
import { GhtkService } from '../../../shipping/carriers/ghtk.service';
import { LalamoveService } from '../../../shipping/carriers/lalamove.service';
import { EasyInvoiceService } from '../../../sales/easyinvoice.service';
import { UsersService } from '../../../users/users.service';
import { isCorsOriginAllowed } from '../../utils/cors.util';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Task P3b: DEMO_MODE Hardening and Security Controls', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Check 1: DEMO_MODE=true blocks outbound calls (Mocked)', () => {
        const demoConfig = {
            get: (key: string) => {
                if (key === 'DEMO_MODE') return 'true';
                return null;
            },
        } as any;
        const demoModeService = new DemoModeService(demoConfig);

        it('EmailService.sendMail skips transport when DEMO_MODE=true', async () => {
            const emailService = new EmailService(
                { get: jest.fn() } as any,
                { query: jest.fn().mockResolvedValue([]) } as any,
                demoModeService
            );
            const mockTransport = { sendMail: jest.fn().mockResolvedValue({ messageId: 'real-1' }) };
            (emailService as any).createTransporter = jest.fn().mockReturnValue(mockTransport);

            const result = await emailService.sendMail('target@example.com', 'Subject', '<p>Test</p>');
            expect(result).toBe(true);
            expect(mockTransport.sendMail).not.toHaveBeenCalled();
        });

        it('GhtkService.pushDeliveryToGhtk skips HTTP API and assigns mock tracking when DEMO_MODE=true', async () => {
            const mockDeliveryRepo = {
                findOne: jest.fn().mockResolvedValue({
                    id: 123,
                    code: 'DEL-123',
                    shipping_carrier: null,
                    tracking_code: null,
                }),
                save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
            };
            const mockOrderRepo = {
                findOne: jest.fn().mockResolvedValue({ id: 1, code: 'SO-1' }),
            };
            const ghtkService = new GhtkService(
                {} as any,
                mockDeliveryRepo as any,
                mockOrderRepo as any,
                demoModeService
            );

            const result = await ghtkService.pushDeliveryToGhtk(123, {} as any);
            expect(result.success).toBe(true);
            expect(result.order.tracking_id).toContain('DEMO-GHTK-123');
            expect(mockedAxios.post).not.toHaveBeenCalled();
            expect(mockDeliveryRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    tracking_code: expect.stringContaining('DEMO-GHTK-123'),
                })
            );
        });

        it('LalamoveService.pushDeliveryToLalamove skips HTTP API when DEMO_MODE=true', async () => {
            const mockDeliveryRepo = {
                findOne: jest.fn().mockResolvedValue({
                    id: 456,
                    code: 'DEL-456',
                    delivery_address: '123 Đường Test, Q1, HCM',
                    contact_name: 'Khách Demo',
                    contact_phone: '0909999999',
                    package_count: 1,
                    weight_gram: 500,
                }),
                save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
            };
            const lalamoveService = new LalamoveService(
                {} as any,
                mockDeliveryRepo as any,
                {} as any,
                demoModeService
            );
            lalamoveService.getConfig = jest.fn().mockResolvedValue({
                apiKey: 'test-key',
                apiSecret: 'test-secret',
                apiUrl: 'https://sandbox-rest.lalamove.com',
                defaultPickAddress: 'Kho HN',
                defaultSenderName: 'Kho Demo',
                defaultSenderPhone: '0901111111',
            });
            lalamoveService.geocodeAddress = jest.fn().mockResolvedValue({ lat: '10.8', lng: '106.6' });

            const result = await lalamoveService.pushDeliveryToLalamove(456, {});
            expect(result.success).toBe(true);
            expect(result.is_mock).toBe(true);
            expect(result.tracking_code).toContain('LLM_');
            expect(mockedAxios.post).not.toHaveBeenCalled();
        });

        it('EasyInvoiceService.createDraftInvoice skips Softdreams API when DEMO_MODE=true', async () => {
            const easyInvoiceService = new EasyInvoiceService(
                {} as any,
                {} as any,
                demoModeService
            );
            const mockOrder: any = {
                code: 'ORD-999',
                customer_name: 'Khách hàng Demo',
                customer_phone: '0900000000',
                items: [{ product_name: 'Hàng Mẫu', quantity: 2, unit_price: 100000, vat_rate: 10 }],
            };
            const result = await easyInvoiceService.createDraftInvoice(mockOrder);
            expect(result.apiResult.demo).toBe(true);
            expect(result.apiResult.Pattern).toBe('1/001');
            expect(result.apiResult.Serial).toBe('C26TAA');
        });
    });

    describe('Check 2: DEMO_MODE=false allows outbound calls', () => {
        const prodConfig = {
            get: (key: string) => {
                if (key === 'DEMO_MODE') return 'false';
                return null;
            },
        } as any;
        const prodDemoModeService = new DemoModeService(prodConfig);

        it('EmailService.sendMail executes nodemailer transport when DEMO_MODE=false', async () => {
            const emailService = new EmailService(
                { get: jest.fn() } as any,
                { query: jest.fn().mockResolvedValue([]) } as any,
                prodDemoModeService
            );
            const mockTransport = { sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-out-123' }) };
            (emailService as any).createTransporter = jest.fn().mockReturnValue(mockTransport);

            const result = await emailService.sendMail('customer@example.com', 'Tiêu đề thật', '<p>Nội dung</p>');
            expect(result).toBe(true);
            expect(mockTransport.sendMail).toHaveBeenCalledTimes(1);
        });

        it('DemoModeService.guard returns false when DEMO_MODE=false', () => {
            expect(prodDemoModeService.isDemoMode()).toBe(false);
            expect(prodDemoModeService.guard('EMAIL', 'cust@example.com')).toBe(false);
        });
    });

    describe('Demo Users Account Protection', () => {
        const demoConfig = {
            get: (key: string) => (key === 'DEMO_MODE' ? 'true' : null),
        } as any;
        const demoModeService = new DemoModeService(demoConfig);

        it.each(['admin', 'sales01', 'warehouse01', 'accountant01', 'hr01'])(
            'protects demo account "%s" from password change',
            async (username) => {
                const mockUserRepo = {
                    findOne: jest.fn().mockResolvedValue({ id: 1, username }),
                    save: jest.fn(),
                };
                const usersService = new UsersService(
                    mockUserRepo as any, {} as any, {} as any, {} as any, demoModeService
                );

                await expect(usersService.changePassword(1, 'newPassword123!')).rejects.toThrow(
                    new ForbiddenException('Không được phép trên bản demo')
                );
                expect(mockUserRepo.save).not.toHaveBeenCalled();
            }
        );

        it.each(['admin', 'sales01', 'warehouse01', 'accountant01', 'hr01'])(
            'protects demo account "%s" from deletion',
            async (username) => {
                const mockUserRepo = {
                    findOne: jest.fn().mockResolvedValue({ id: 2, username }),
                    delete: jest.fn(),
                };
                const usersService = new UsersService(
                    mockUserRepo as any, {} as any, {} as any, {} as any, demoModeService
                );

                await expect(usersService.deleteUser(2)).rejects.toThrow(
                    new ForbiddenException('Không được phép trên bản demo')
                );
                expect(mockUserRepo.delete).not.toHaveBeenCalled();
            }
        );

        it.each(['admin', 'sales01', 'warehouse01', 'accountant01', 'hr01'])(
            'protects demo account "%s" from group change',
            async (username) => {
                const mockUserRepo = {
                    findOne: jest.fn().mockResolvedValue({ id: 3, username, group_id: 2 }),
                    update: jest.fn(),
                };
                const usersService = new UsersService(
                    mockUserRepo as any, {} as any, {} as any, {} as any, demoModeService
                );

                await expect(usersService.updateUser(3, { group_id: 1 })).rejects.toThrow(
                    new ForbiddenException('Không được phép trên bản demo')
                );
                expect(mockUserRepo.update).not.toHaveBeenCalled();
            }
        );

        it('allows normal user to be updated when DEMO_MODE=true', async () => {
            const mockUserRepo = {
                findOne: jest.fn()
                    .mockResolvedValueOnce({ id: 10, username: 'custom_user', group_id: 3 })
                    .mockResolvedValueOnce({ id: 10, username: 'custom_user', group_id: 2 }),
                update: jest.fn().mockResolvedValue({ affected: 1 }),
            };
            const usersService = new UsersService(
                mockUserRepo as any, {} as any, {} as any, {} as any, demoModeService
            );

            const updated = await usersService.updateUser(10, { group_id: 2 });
            expect(mockUserRepo.update).toHaveBeenCalledWith(10, { group_id: 2 });
            expect(updated?.group_id).toBe(2);
        });
    });

    describe('Check 4: CORS and Health Check logic', () => {
        it('isCorsOriginAllowed rejects unknown origin in production', () => {
            const allowed = ['https://erp4u.demo.com', 'https://admin.demo.com'];
            expect(isCorsOriginAllowed('https://evil.com', allowed, 'production')).toBe(false);
            expect(isCorsOriginAllowed('https://erp4u.demo.com', allowed, 'production')).toBe(true);
            expect(isCorsOriginAllowed(undefined, allowed, 'production')).toBe(true);
        });

        it('isCorsOriginAllowed allows any origin in development', () => {
            expect(isCorsOriginAllowed('http://localhost:5173', [], 'development')).toBe(true);
            expect(isCorsOriginAllowed('http://any-site.com', [], 'development')).toBe(true);
        });
    });
});

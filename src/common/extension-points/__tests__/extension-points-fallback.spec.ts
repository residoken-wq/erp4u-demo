import { HrService } from '../../../hr/hr.service';
import { PfoSourcingService } from '../../../planning/pfo-sourcing.service';
import { PublicController } from '../../../public/public.controller';
import { ProductsService } from '../../../products/products.service';
import { UploadController } from '../../../upload/upload.controller';
import { NotificationsService } from '../../../notifications/notifications.service';

describe('Task P7c4d: Extension points fallback in pure core (no premium plugins)', () => {
  describe('1. HR -> AI extension point fallback', () => {
    let hrService: HrService;
    let mockCandidateRepo: any;
    let mockEmployeeReviewRepo: any;

    beforeEach(() => {
      mockCandidateRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          job_post: { description: 'Software Engineer requirements' },
          cv_url: 'http://example.com/cv.pdf',
        }),
      };
      mockEmployeeReviewRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          ai_feedback: null,
          reviewee: { id: 1, full_name: 'Nguyen Van A' },
        }),
        save: jest.fn(async (review) => review),
      };

      // Instantiate HrService with aiService = undefined
      hrService = new HrService(
        {} as any, // employeeRepo
        {} as any, // attendanceRepo
        {} as any, // leaveRepo
        {} as any, // entitlementRepo
        {} as any, // assetRepo
        {} as any, // payslipRepo
        {} as any, // trainingRepo
        {} as any, // shiftRepo
        {} as any, // jobRepo
        mockCandidateRepo, // candidateRepo
        {} as any, // assessmentRepo
        {} as any, // interviewRepo
        {} as any, // reviewQuestionRepo
        {} as any, // reviewCampaignRepo
        mockEmployeeReviewRepo, // employeeReviewRepo
        {} as any, // activityLogRepo
        { get: jest.fn() } as any, // configService
        undefined, // aiService is undefined (no AI plugin)
        { sendMail: jest.fn() } as any, // emailService
      );
    });

    it('parseJDCompetencies returns null without 500 when AI is not installed', async () => {
      const result = await hrService.parseJDCompetencies('Senior NestJS developer with 5 years experience');
      expect(result).toBeNull();
    });

    it('generateAIQuestions returns empty array without 500 when AI is not installed', async () => {
      const questions = await hrService.generateAIQuestions(1);
      expect(questions).toEqual([]);
    });

    it('submitEmployeeReview uses default fallback feedback without 500 when AI is not installed', async () => {
      const review = await hrService.submitEmployeeReview(
        10,
        { teamwork: 5, punctuality: 5 },
      );
      expect(review.ai_feedback).toBe('Đã ghi nhận kết quả đánh giá.');
    });
  });

  describe('2. Planning & Public -> DESIGN extension point fallback', () => {
    it('PfoSourcingService instantiates cleanly when DESIGN is not installed', () => {
      const pfoSourcingService = new PfoSourcingService(
        {} as any, // poRepo
        {} as any, // poItemRepo
        {} as any, // materialReqRepo
        {} as any, // milestoneRepo
        {} as any, // goodsIssueRepo
        {} as any, // goodsIssueItemRepo
        undefined, // designsService is undefined (no DESIGN plugin)
      );

      expect(pfoSourcingService).toBeDefined();
    });

    it('PublicController handles quotes and actions gracefully when DESIGN is not installed', async () => {
      const mockSalesService = {
        getQuoteByUuid: jest.fn().mockResolvedValue(null),
        customerAction: jest.fn().mockResolvedValue({ status: 'ACCEPTED' }),
      };

      const publicController = new PublicController(
        { findOne: jest.fn() } as any, // configRepo
        mockSalesService as any,
        {} as any, // systemService
        {} as any, // hrService
        undefined, // designsService is undefined (no DESIGN plugin)
        { guard: jest.fn().mockReturnValue(false) } as any, // demoModeService
      );

      const quote = await publicController.getPortalQuote('unknown-uuid', {});
      expect(quote).toBeNull();

      const actionRes = await publicController.portalQuoteAction(
        'uuid-123',
        { action: 'ACCEPT' },
        { headers: {}, connection: { remoteAddress: '127.0.0.1' } } as any,
      );
      expect(actionRes).toEqual({ status: 'ACCEPTED' });
      expect(mockSalesService.customerAction).toHaveBeenCalledWith(
        'uuid-123',
        'ACCEPT',
        expect.any(Object),
      );
    });
  });

  describe('3. Products & Upload -> WEBSITE extension point fallback', () => {
    it('ProductsService returns null config and handles gracefully without WEBSITE', async () => {
      const productsService = new ProductsService(
        {} as any, // productRepo
        {} as any, // categoryRepo
        {} as any, // bomRepo
        {} as any, // variantRepo
        {} as any, // productSemiFinishedRepo
        {} as any, // salesOrderItemRepo
        {} as any, // dataSource
        {} as any, // demoModeService
        {} as any, // configService
        undefined, // websiteService is undefined (no WEBSITE plugin)
      );

      const config = await productsService.getWebsiteConfig(1);
      expect(config).toBeNull();

      await expect(
        productsService.saveWebsiteConfig(1, { is_visible: true }),
      ).rejects.toThrow();
    });

    it('UploadController getImageUsage succeeds without WEBSITE plugin', async () => {
      const uploadService = {
        listFiles: jest.fn().mockResolvedValue([]),
      };
      const mockProductRepo = {
        find: jest.fn().mockResolvedValue([]),
      };
      const mockConfigRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
      };

      const uploadController = new UploadController(
        uploadService as any,
        mockProductRepo as any,
        mockConfigRepo as any,
        undefined, // websiteService is undefined (no WEBSITE plugin)
      );

      const result = await uploadController.getImageUsage();
      expect(result).toBeDefined();
    });
  });

  describe('4. Notifications -> ZNS extension point fallback', () => {
    it('NotificationsService handles notifications cleanly when ZNS is not installed', async () => {
      const mockNotificationRepo = {
        create: jest.fn((data) => data),
        save: jest.fn(async (entity) => ({ id: 42, ...entity })),
      };

      const notificationsService = new NotificationsService(
        mockNotificationRepo as any,
        undefined, // no notification channels (e.g. ZNS)
      );

      expect(notificationsService).toBeDefined();
    });
  });
});

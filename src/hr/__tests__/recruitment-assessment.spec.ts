import { HrService } from '../hr.service';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity';
import { Candidate, CandidateStatus } from '../entities/candidate.entity';
import { Interview, InterviewStatus } from '../entities/interview.entity';
import { ActivityLog } from '../../system/entities/activity-log.entity';

describe('Recruitment Assessment AI Evaluation & HR Manual Decision (Task P3a)', () => {
    let service: HrService;

    // Mock repositories
    let mockCandidateRepo: any;
    let mockAssessmentRepo: any;
    let mockInterviewRepo: any;
    let mockActivityLogRepo: any;
    let mockAiService: any;
    let mockEmailService: any;
    let mockConfigService: any;

    beforeEach(() => {
        mockCandidateRepo = {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            save: jest.fn(),
            create: jest.fn(data => data),
        };

        mockAssessmentRepo = {
            findOne: jest.fn(),
            save: jest.fn(data => Promise.resolve(data)),
            create: jest.fn(data => data),
        };

        mockInterviewRepo = {
            create: jest.fn(data => ({ id: 101, ...data })),
            save: jest.fn(data => Promise.resolve({ id: 101, ...data })),
            find: jest.fn(),
        };

        mockActivityLogRepo = {
            create: jest.fn(data => data),
            save: jest.fn(data => Promise.resolve({ id: 1, ...data })),
        };

        mockAiService = {
            evaluateAssessment: jest.fn(),
            generateRecruitmentQuestions: jest.fn(),
            parseJDCompetencies: jest.fn(),
        };

        mockEmailService = {
            sendMail: jest.fn().mockResolvedValue(true),
        };

        mockConfigService = {
            get: jest.fn((key: string) => {
                if (key === 'PUBLIC_APP_URL') return 'http://localhost:5173';
                return null;
            }),
        };

        // Construct HrService with mocks
        service = new HrService(
            {} as any, // employeeRepo
            {} as any, // attendanceRepo
            {} as any, // leaveRepo
            {} as any, // entitlementRepo
            {} as any, // assetRepo
            {} as any, // payslipRepo
            {} as any, // trainingRepo
            {} as any, // shiftRepo
            {} as any, // jobPostRepo
            mockCandidateRepo,
            mockAssessmentRepo,
            mockInterviewRepo,
            {} as any, // reviewQuestionRepo
            {} as any, // reviewCampaignRepo
            {} as any, // employeeReviewRepo
            mockActivityLogRepo,
            mockConfigService,
            mockAiService,
            mockEmailService
        );
    });

    describe('AI Evaluation: evaluateAssessment', () => {
        it('Score 9 (High): should update score and set status to ASSESSED without creating interview or sending email', async () => {
            const mockAssessment: Partial<Assessment> = {
                id: 1,
                candidate_id: 10,
                questions_json: [{ id: 1, question: 'React hooks?' }],
                answers_json: [{ question_id: 1, answer_text: 'useState, useEffect' }],
                candidate: {
                    id: 10,
                    name: 'Ứng viên Test 01',
                    email: 'candidate1@example.com',
                    portal_token: 'uuid-candidate-01',
                    job_post: { title: 'Frontend Developer' },
                } as any,
            };

            mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);
            mockAiService.evaluateAssessment.mockResolvedValue({
                score: 9,
                pros: ['Hiểu sâu về React lifecycle', 'Kinh nghiệm phong phú'],
                cons: [],
                recommendation: 'HIRE',
                duplication_flag: false,
            });

            const result = await service.evaluateAssessment(1);

            // 1. Assessment status should be EVALUATED and feedback saved
            expect(result.status).toBe(AssessmentStatus.EVALUATED);
            expect(result.ai_feedback.score).toBe(9);
            expect(mockAssessmentRepo.save).toHaveBeenCalled();

            // 2. Candidate status must be ASSESSED (waiting for HR review), not INTERVIEW_SCHEDULED
            expect(mockCandidateRepo.update).toHaveBeenCalledWith(10, {
                overall_score: 9,
                status: CandidateStatus.ASSESSED,
            });

            // 3. Must NOT create interview autonomously
            expect(mockInterviewRepo.create).not.toHaveBeenCalled();
            expect(mockInterviewRepo.save).not.toHaveBeenCalled();

            // 4. Must NOT send email autonomously
            expect(mockEmailService.sendMail).not.toHaveBeenCalled();
        });

        it('Score 2 (Low / Reject): should update score and set status to ASSESSED without setting REJECTED or sending email', async () => {
            const mockAssessment: Partial<Assessment> = {
                id: 2,
                candidate_id: 20,
                questions_json: [{ id: 1, question: 'SQL Joins?' }],
                answers_json: [{ question_id: 1, answer_text: 'Không biết' }],
                candidate: {
                    id: 20,
                    name: 'Ứng viên Test 02',
                    email: 'candidate2@example.com',
                    portal_token: 'uuid-candidate-02',
                    job_post: { title: 'Backend Developer' },
                } as any,
            };

            mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);
            mockAiService.evaluateAssessment.mockResolvedValue({
                score: 2,
                pros: [],
                cons: ['Chưa nắm kiến thức cơ bản SQL'],
                recommendation: 'REJECT',
                duplication_flag: false,
            });

            const result = await service.evaluateAssessment(2);

            // 1. Assessment status should be EVALUATED
            expect(result.status).toBe(AssessmentStatus.EVALUATED);
            expect(result.ai_feedback.score).toBe(2);

            // 2. Candidate status must be ASSESSED, NOT REJECTED
            expect(mockCandidateRepo.update).toHaveBeenCalledWith(20, {
                overall_score: 2,
                status: CandidateStatus.ASSESSED,
            });

            // 3. Must NOT create interview
            expect(mockInterviewRepo.create).not.toHaveBeenCalled();
            expect(mockInterviewRepo.save).not.toHaveBeenCalled();

            // 4. Must NOT send email autonomously
            expect(mockEmailService.sendMail).not.toHaveBeenCalled();
        });
    });

    describe('HR Manual Decision: approveInterview', () => {
        it('should create interview, set candidate status to INTERVIEW_SCHEDULED, send invitation email, and record ActivityLog', async () => {
            const mockAssessment: Partial<Assessment> = {
                id: 1,
                candidate_id: 10,
                ai_feedback: { score: 9 },
                candidate: {
                    id: 10,
                    name: 'Ứng viên Test 01',
                    email: 'candidate1@example.com',
                    portal_token: 'uuid-candidate-01',
                    overall_score: 9,
                    status: CandidateStatus.ASSESSED,
                } as any,
            };

            mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);

            const user = { id: 5, username: 'hr01', full_name: 'Nhân Sự HR 01' };
            const scheduleDate = new Date('2026-12-01T14:00:00Z');

            const result = await service.approveInterview(1, user, {
                scheduled_at: scheduleDate,
                location: 'Văn phòng HN',
                meeting_link: 'https://meet.google.com/xyz',
                hr_interviewer: 'Trưởng phòng HR',
            });

            expect(result.success).toBe(true);
            expect(result.interview).toBeDefined();

            // 1. Interview created and saved with correct info
            expect(mockInterviewRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    candidate_id: 10,
                    location: 'Văn phòng HN',
                    meeting_link: 'https://meet.google.com/xyz',
                    hr_interviewer: 'Trưởng phòng HR',
                    result_status: InterviewStatus.PENDING,
                })
            );
            expect(mockInterviewRepo.save).toHaveBeenCalled();

            // 2. Candidate status updated to INTERVIEW_SCHEDULED
            expect(mockCandidateRepo.update).toHaveBeenCalledWith(10, {
                status: CandidateStatus.INTERVIEW_SCHEDULED,
            });

            // 3. Email sent with portal link using PUBLIC_APP_URL
            expect(mockEmailService.sendMail).toHaveBeenCalledWith(
                'candidate1@example.com',
                expect.stringContaining('Vượt qua bài test - Thư mời phỏng vấn'),
                expect.stringContaining('http://localhost:5173/portal/recruitment/uuid-candidate-01')
            );

            // 4. ActivityLog saved
            expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 5,
                    username: 'hr01',
                    action: 'APPROVE_INTERVIEW',
                    module: 'HR',
                    entity_id: '1',
                })
            );
            expect(mockActivityLogRepo.save).toHaveBeenCalled();
        });
    });

    describe('HR Manual Decision: rejectAssessment', () => {
        it('should update candidate status to REJECTED, send feedback email, and record ActivityLog', async () => {
            const mockAssessment: Partial<Assessment> = {
                id: 2,
                candidate_id: 20,
                ai_feedback: {
                    score: 2,
                    pros: ['Nhiệt tình'],
                    cons: ['Chưa đủ kinh nghiệm'],
                    recommendation: 'REJECT',
                },
                candidate: {
                    id: 20,
                    name: 'Ứng viên Test 02',
                    email: 'candidate2@example.com',
                    portal_token: 'uuid-candidate-02',
                    overall_score: 2,
                    status: CandidateStatus.ASSESSED,
                } as any,
            };

            mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);

            const user = { id: 5, username: 'hr01', full_name: 'Nhân Sự HR 01' };

            const result = await service.rejectAssessment(2, user, 'Không phù hợp yêu cầu');

            expect(result.success).toBe(true);
            expect(result.status).toBe(CandidateStatus.REJECTED);

            // 1. Candidate status updated to REJECTED
            expect(mockCandidateRepo.update).toHaveBeenCalledWith(20, {
                status: CandidateStatus.REJECTED,
            });

            // 2. Email sent with rejection feedback
            expect(mockEmailService.sendMail).toHaveBeenCalledWith(
                'candidate2@example.com',
                expect.stringContaining('Phản hồi kết quả bài đánh giá'),
                expect.stringContaining('chưa đạt yêu cầu cho vị trí này')
            );

            // 3. ActivityLog saved
            expect(mockActivityLogRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 5,
                    username: 'hr01',
                    action: 'REJECT_CANDIDATE',
                    module: 'HR',
                    entity_id: '2',
                })
            );
            expect(mockActivityLogRepo.save).toHaveBeenCalled();
        });
    });
});

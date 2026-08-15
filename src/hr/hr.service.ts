import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { LeaveRequest, LeaveStatus, LeaveType } from './entities/leave-request.entity';
import { LeaveEntitlement } from './entities/leave-entitlement.entity';
import { AssetAssignment } from './entities/asset-assignment.entity';
import { Payslip } from './entities/payslip.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { WorkShift, AttendanceCalcType } from './entities/work-shift.entity';
import { JobPost, JobPostStatus } from './entities/job-post.entity';
import { Candidate, CandidateStatus } from './entities/candidate.entity';
import { Assessment, AssessmentStatus } from './entities/assessment.entity';
import { Interview, InterviewStatus } from './entities/interview.entity';
import { ReviewQuestion } from './entities/review-question.entity';
import { ReviewCampaign, CampaignStatus } from './entities/review-campaign.entity';
import { EmployeeReview, ReviewStatus } from './entities/employee-review.entity';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../common/services/email.service';
import { randomUUID } from 'crypto';

@Injectable()
export class HrService implements OnModuleInit {
    constructor(
        @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
        @InjectRepository(Attendance) private attendanceRepo: Repository<Attendance>,
        @InjectRepository(LeaveRequest) private leaveRepo: Repository<LeaveRequest>,
        @InjectRepository(LeaveEntitlement) private entitlementRepo: Repository<LeaveEntitlement>,
        @InjectRepository(AssetAssignment) private assetRepo: Repository<AssetAssignment>,
        @InjectRepository(Payslip) private payslipRepo: Repository<Payslip>,
        @InjectRepository(TrainingPlan) private trainingRepo: Repository<TrainingPlan>,
        @InjectRepository(WorkShift) private shiftRepo: Repository<WorkShift>,
        @InjectRepository(JobPost) private jobPostRepo: Repository<JobPost>,
        @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
        @InjectRepository(Assessment) private assessmentRepo: Repository<Assessment>,
        @InjectRepository(Interview) private interviewRepo: Repository<Interview>,
        @InjectRepository(ReviewQuestion) private reviewQuestionRepo: Repository<ReviewQuestion>,
        @InjectRepository(ReviewCampaign) private reviewCampaignRepo: Repository<ReviewCampaign>,
        @InjectRepository(EmployeeReview) private employeeReviewRepo: Repository<EmployeeReview>,
        private aiService: AiService,
        private emailService: EmailService,
    ) { }

    async onModuleInit() {
        // Auto-seed 360-degree review questions from parsed_questions.json if table is empty
        try {
            const count = await this.reviewQuestionRepo.count();
            if (count === 0) {
                const fs = require('fs');
                const path = require('path');
                const dataPath = path.join(process.cwd(), 'parsed_questions.json');
                if (fs.existsSync(dataPath)) {
                    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                    for (const item of data) {
                        const q = this.reviewQuestionRepo.create({
                            content: item.content,
                            category: item.category,
                            type: item.type as any
                        });
                        await this.reviewQuestionRepo.save(q);
                    }
                    console.log(`[HrModule] Seeded ${data.length} review questions successfully.`);
                }
            }
        } catch (e) {
            console.error('[HrModule] Error auto-seeding review questions:', e);
        }
    }

    // ==================== WORK SHIFT ====================
    async findAllShifts() {
        return this.shiftRepo.find({ order: { name: 'ASC' } });
    }

    async createShift(data: Partial<WorkShift>) {
        const shift = this.shiftRepo.create(data);
        return this.shiftRepo.save(shift);
    }

    async updateShift(id: number, data: Partial<WorkShift>) {
        await this.shiftRepo.update(id, data);
        return this.shiftRepo.findOne({ where: { id } });
    }

    async deleteShift(id: number) {
        return this.shiftRepo.delete(id);
    }

    // ==================== EMPLOYEE ====================
    async findAllEmployees() {
        return this.employeeRepo.find({ relations: ['user', 'work_shift'], order: { id: 'DESC' } });
    }

    async findOneEmployee(id: number) {
        const emp = await this.employeeRepo.findOne({ where: { id }, relations: ['user', 'work_shift'] });
        if (!emp) throw new NotFoundException('Employee not found');
        return emp;
    }


    async findEmployeeByUserId(userId: number) {
        return this.employeeRepo.findOne({ where: { user_id: userId }, relations: ['user', 'work_shift'] });
    }

    async createEmployee(data: Partial<Employee>) {
        const employee = this.employeeRepo.create(data);
        return this.employeeRepo.save(employee);
    }

    async updateEmployee(id: number, data: Partial<Employee>) {
        await this.employeeRepo.update(id, data);
        return this.findOneEmployee(id);
    }

    async deleteEmployee(id: number) {
        return this.employeeRepo.delete(id);
    }

    // ==================== ATTENDANCE ====================
    async findAttendances(employeeId?: number, month?: number, year?: number) {
        const where: any = {};
        if (employeeId) where.employee_id = employeeId;

        // Filter by month/year if provided
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            where.date = Between(startDate, endDate);
        }

        return this.attendanceRepo.find({
            where,
            relations: ['employee'],
            order: { date: 'DESC', check_in: 'DESC' }
        });
    }

    async checkIn(employeeId: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find the latest attendance record for today
        const attendance = await this.attendanceRepo.findOne({
            where: { employee_id: employeeId, date: today },
            order: { check_in: 'DESC' }
        });

        // If the latest record has no check_out, then employee is currently checked in
        if (attendance && !attendance.check_out) {
            return { message: 'Đang trong ca làm việc (chưa check-out)', attendance };
        }

        const employee = await this.employeeRepo.findOne({
            where: { id: employeeId },
            relations: ['work_shift']
        });

        const now = new Date();
        let isLate = now.getHours() >= 9; // Late if after 9 AM fallback

        if (employee && employee.work_shift && employee.work_shift.start_time) {
            const [hours, minutes] = employee.work_shift.start_time.split(':').map(Number);
            const tolerance = employee.work_shift.late_tolerance_minutes || 0;
            
            const shiftStart = new Date();
            shiftStart.setHours(hours, minutes + tolerance, 0, 0);

            isLate = now.getTime() > shiftStart.getTime();
        }

        const newAttendance = this.attendanceRepo.create({
            employee_id: employeeId,
            date: today,
            check_in: now,
            status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT
        });

        return this.attendanceRepo.save(newAttendance);
    }

    async checkOut(employeeId: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await this.attendanceRepo.findOne({
            where: { employee_id: employeeId, date: today },
            order: { check_in: 'DESC' }
        });

        if (!attendance) {
            throw new NotFoundException('No check-in record for today');
        }

        if (attendance.check_out) {
            return { message: 'Already checked out today', attendance };
        }

        attendance.check_out = new Date();

        // Calculate work hours
        if (attendance.check_in) {
            const diffMs = attendance.check_out.getTime() - attendance.check_in.getTime();
            attendance.work_hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        }

        return this.attendanceRepo.save(attendance);
    }

    async createAttendance(data: Partial<Attendance>) {
        const attendance = this.attendanceRepo.create(data);
        return this.attendanceRepo.save(attendance);
    }

    async updateAttendance(id: number, data: Partial<Attendance>) {
        await this.attendanceRepo.update(id, data);
        return this.attendanceRepo.findOne({ where: { id }, relations: ['employee'] });
    }

    async deleteAttendance(id: number) {
        return this.attendanceRepo.delete(id);
    }

    // ==================== LEAVE REQUEST ====================
    async findAllLeaves(status?: LeaveStatus) {
        const where: any = {};
        if (status) where.status = status;
        return this.leaveRepo.find({
            where,
            relations: ['employee', 'approved_by'],
            order: { created_at: 'DESC' }
        });
    }

    async createLeave(data: Partial<LeaveRequest>) {
        // Calculate days if not explicitly provided by frontend
        if (data.start_date && data.end_date && !data.days) {
            const start = new Date(data.start_date);
            const end = new Date(data.end_date);
            data.days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
        // Ensure days is a valid number (support 0.5 for half-day)
        if (data.days !== undefined) {
            data.days = Number(data.days);
            if (data.days < 0.5) data.days = 0.5; // Minimum 0.5 day
        }
        const leave = this.leaveRepo.create(data);
        return this.leaveRepo.save(leave);
    }

    async approveLeave(id: number, approverId: number, approved: boolean, rejectReason?: string) {
        const leave = await this.leaveRepo.findOne({ where: { id } });
        if (!leave) throw new NotFoundException('Leave request not found');

        leave.status = approved ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
        leave.approved_by_id = approverId;
        leave.approved_at = new Date();
        if (!approved && rejectReason) leave.reject_reason = rejectReason;

        return this.leaveRepo.save(leave);
    }

    async deleteLeave(id: number) {
        return this.leaveRepo.delete(id);
    }

    // ==================== LEAVE ENTITLEMENT ====================
    async findEntitlements(employeeId?: number, year?: number) {
        const where: any = {};
        if (employeeId) where.employee_id = employeeId;
        if (year) where.year = year;
        return this.entitlementRepo.find({ where, relations: ['employee'], order: { year: 'DESC' } });
    }

    async createEntitlement(data: Partial<LeaveEntitlement>) {
        // Check if entitlement already exists for this employee+year
        const existing = await this.entitlementRepo.findOne({
            where: { employee_id: data.employee_id, year: data.year }
        });

        if (existing) {
            // Update existing
            await this.entitlementRepo.update(existing.id, {
                annual_days: data.annual_days,
                carried_days: data.carried_days,
            });
            return this.entitlementRepo.findOne({ where: { id: existing.id }, relations: ['employee'] });
        }

        // Create new
        const entitlement = this.entitlementRepo.create(data);
        return this.entitlementRepo.save(entitlement);
    }

    async updateEntitlement(id: number, data: Partial<LeaveEntitlement>) {
        await this.entitlementRepo.update(id, data);
        return this.entitlementRepo.findOne({ where: { id }, relations: ['employee'] });
    }

    async getLeaveBalance(employeeId: number, year: number) {
        // Get entitlement for this year
        const entitlement = await this.entitlementRepo.findOne({
            where: { employee_id: employeeId, year }
        });

        // Get approved annual leaves for this year
        const approvedLeaves = await this.leaveRepo.find({
            where: {
                employee_id: employeeId,
                leave_type: LeaveType.ANNUAL,
                status: LeaveStatus.APPROVED,
            }
        });

        // Filter leaves within the year
        const usedDays = approvedLeaves
            .filter(l => new Date(l.start_date).getFullYear() === year)
            .reduce((sum, l) => sum + Number(l.days), 0);

        const annual = entitlement ? Number(entitlement.annual_days) : 12;
        const carried = entitlement ? Number(entitlement.carried_days) : 0;
        const total = annual + carried;
        const remaining = total - usedDays;

        return {
            year,
            annual_days: annual,
            carried_days: carried,
            total_days: total,
            used_days: usedDays,
            remaining_days: remaining,
        };
    }

    // ==================== ASSET ASSIGNMENT ====================
    async findAllAssets(employeeId?: number) {
        const where: any = {};
        if (employeeId) where.employee_id = employeeId;
        return this.assetRepo.find({ where, relations: ['employee'], order: { assigned_date: 'DESC' } });
    }

    async createAsset(data: Partial<AssetAssignment>) {
        const asset = this.assetRepo.create(data);
        return this.assetRepo.save(asset);
    }

    async updateAsset(id: number, data: Partial<AssetAssignment>) {
        await this.assetRepo.update(id, data);
        return this.assetRepo.findOne({ where: { id }, relations: ['employee'] });
    }

    async deleteAsset(id: number) {
        return this.assetRepo.delete(id);
    }

    // ==================== PAYSLIP ====================
    async findPayslips(employeeId?: number, month?: number, year?: number) {
        const where: any = {};
        if (employeeId) where.employee_id = employeeId;
        if (month) where.month = month;
        if (year) where.year = year;
        return this.payslipRepo.find({ where, relations: ['employee'], order: { year: 'DESC', month: 'DESC' } });
    }

    async createPayslip(data: Partial<Payslip>) {
        // Fetch employee to check work shift type
        let calcType = AttendanceCalcType.DAILY;
        if (data.employee_id) {
            const employee = await this.employeeRepo.findOne({
                where: { id: data.employee_id },
                relations: ['work_shift']
            });
            if (employee && employee.work_shift) {
                calcType = employee.work_shift.calc_type;
            }
        }

        // Calculate derived values
        const actual = Number(data.actual_work_days) || 0;
        const standard = Number(data.standard_work_days) || 26;
        const base = Number(data.base_salary) || 0;

        if (calcType === AttendanceCalcType.HOURLY) {
            // For hourly employees, actual_work_days represents total hours worked
            // Formula: base_salary (hourly rate) * actual hours
            data.actual_salary = Math.round((base * actual) / 1000) * 1000;
        } else {
            // For daily employees, actual_work_days represents days worked
            // Formula: ROUND(base_salary / standard_work_days * actual_work_days, -3) = rounds to nearest 1000
            // Using standard_work_days instead of fixed 25 for better accuracy
            data.actual_salary = Math.round((base / standard * actual) / 1000) * 1000;
        }

        const meal = Number(data.allowance_meal) || 0;
        const transport = Number(data.allowance_transport) || 0;
        const phone = Number(data.allowance_phone) || 0;
        const bonus = Number(data.bonus) || 0;

        data.gross_income = data.actual_salary + meal + transport + phone + bonus;

        // Insurance calculations
        if (data.include_insurance !== false) {
            const insuranceBase = calcType === AttendanceCalcType.HOURLY ? data.actual_salary : base;

            // Company contributions (based on insuranceBase)
            data.bhxh_company = Math.round(insuranceBase * 0.175);
            data.bhyt_company = Math.round(insuranceBase * 0.03);
            data.bhtn_company = Math.round(insuranceBase * 0.01);

            // Employee contributions
            data.bhxh_employee = Math.round(insuranceBase * 0.08);
            data.bhyt_employee = Math.round(insuranceBase * 0.015);
            data.bhtn_employee = Math.round(insuranceBase * 0.01);
        } else {
            data.bhxh_company = 0;
            data.bhyt_company = 0;
            data.bhtn_company = 0;
            data.bhxh_employee = 0;
            data.bhyt_employee = 0;
            data.bhtn_employee = 0;
        }

        // Net salary
        const totalDeductions =
            Number(data.bhxh_employee) +
            Number(data.bhyt_employee) +
            Number(data.bhtn_employee) +
            Number(data.union_fee || 0) +
            Number(data.tax_income || 0) +
            Number(data.other_deductions || 0);

        data.net_salary = data.gross_income - totalDeductions;

        const payslip = this.payslipRepo.create(data);
        return this.payslipRepo.save(payslip);
    }

    async updatePayslip(id: number, data: Partial<Payslip>) {
        // Recalculate if salary data changed
        if (data.base_salary || data.actual_work_days) {
            const existing = await this.payslipRepo.findOne({ where: { id } });
            const merged = { ...existing, ...data };
            return this.createPayslip({ ...merged, id });
        }
        await this.payslipRepo.update(id, data);
        return this.payslipRepo.findOne({ where: { id }, relations: ['employee'] });
    }

    async deletePayslip(id: number) {
        return this.payslipRepo.delete(id);
    }

    // ==================== TRAINING PLAN ====================
    async findTrainingPlans(employeeId?: number) {
        const where: any = {};
        if (employeeId) where.employee_id = employeeId;
        return this.trainingRepo.find({ where, relations: ['employee'], order: { created_at: 'DESC' } });
    }

    async createTrainingPlan(data: Partial<TrainingPlan>) {
        const plan = this.trainingRepo.create(data);
        return this.trainingRepo.save(plan);
    }

    async updateTrainingPlan(id: number, data: Partial<TrainingPlan>) {
        // Calculate progress from milestones
        if (data.milestones && Array.isArray(data.milestones)) {
            const total = data.milestones.length;
            const completed = data.milestones.filter(m => m.completed).length;
            data.progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        }
        await this.trainingRepo.update(id, data);
        return this.trainingRepo.findOne({ where: { id }, relations: ['employee'] });
    }

    async deleteTrainingPlan(id: number) {
        return this.trainingRepo.delete(id);
    }

    // ==================== RECRUITMENT ====================

    // --- JOB POSTS ---
    async findAllJobs() {
        return this.jobPostRepo.find({ order: { created_at: 'DESC' } });
    }

    async findJobBySlug(slug: string) {
        return this.jobPostRepo.findOne({ where: { slug } });
    }

    async createJob(data: Partial<JobPost>) {
        const job = this.jobPostRepo.create(data);
        return this.jobPostRepo.save(job);
    }

    async updateJob(id: number, data: Partial<JobPost>) {
        await this.jobPostRepo.update(id, data);
        return this.jobPostRepo.findOne({ where: { id } });
    }

    async deleteJob(id: number) {
        return this.jobPostRepo.delete(id);
    }

    async parseJDCompetencies(description: string) {
        return this.aiService.parseJDCompetencies(description);
    }

    // --- CANDIDATES ---
    async findCandidates(jobId?: number) {
        const where: any = {};
        if (jobId) where.job_post_id = jobId;
        return this.candidateRepo.find({ where, relations: ['job_post'], order: { applied_at: 'DESC' } });
    }

    async getCandidateByToken(token: string) {
        return this.candidateRepo.findOne({ 
            where: { portal_token: token },
            relations: ['job_post'] 
        });
    }

    async createCandidate(data: Partial<Candidate>) {
        data.portal_token = randomUUID();
        const candidate = this.candidateRepo.create(data);
        const saved = await this.candidateRepo.save(candidate);

        // Send email with portal link
        const portalUrl = `https://localhost:3000/portal/recruitment/${saved.portal_token}`;
        const html = `
            <h2>Chào <span style="color:#0056b3">${saved.name}</span>,</h2>
            <p>Cảm ơn bạn đã ứng tuyển tại ERP4U.</p>
            <p>Vui lòng truy cập Portal Ứng Viên để theo dõi tiến trình tuyển dụng và thực hiện bài đánh giá năng lực khi được yêu cầu:</p>
            <p><a href="${portalUrl}" style="padding:10px 20px; background:#0056b3; color:white; text-decoration:none; border-radius:5px; display:inline-block; margin-top:10px; margin-bottom:10px;">Truy Cập Portal</a></p>
            <p style="font-size:12px; color:#555;">Hoặc copy link này vào trình duyệt: ${portalUrl}</p>
        `;
        await this.emailService.sendMail(saved.email, '[ERP4U] Nhận hồ sơ ứng tuyển & Truy cập Portal', html);

        return saved;
    }

    async updateCandidate(id: number, data: Partial<Candidate>) {
        await this.candidateRepo.update(id, data);
        return this.candidateRepo.findOne({ where: { id } });
    }

    async deleteCandidate(id: number) {
        return this.candidateRepo.delete(id);
    }

    // --- ASSESSMENTS ---
    async getAssessmentByCandidate(candidateId: number) {
        return this.assessmentRepo.findOne({
            where: { candidate_id: candidateId },
            order: { created_at: 'DESC' }
        });
    }

    async createAssessment(candidateId: number, questions: any[]) {
        const assessment = this.assessmentRepo.create({
            candidate_id: candidateId,
            questions_json: questions,
            status: AssessmentStatus.PENDING
        });
        
        // Update candidate status
        await this.candidateRepo.update(candidateId, { status: CandidateStatus.ASSESSMENT_SENT });
        const saved = await this.assessmentRepo.save(assessment);

        // Notification email
        const candidate = await this.candidateRepo.findOne({ where: { id: candidateId }, relations: ['job_post'] });
        if (candidate) {
            const portalUrl = `https://localhost:3000/portal/recruitment/${candidate.portal_token}`;
            const html = `
                <h2>Chào ${candidate.name},</h2>
                <p>Nhân sự ERP4U vừa gửi cho bạn một bài đánh giá năng lực cho vị trí <strong>${candidate.job_post?.title || 'ứng tuyển'}</strong>.</p>
                <p>Vui lòng truy cập Portal Ứng Viên để hoàn thành bài test càng sớm càng tốt.</p>
                <p><a href="${portalUrl}" style="padding:10px 20px; background:#0056b3; color:white; text-decoration:none; border-radius:5px; display:inline-block; margin-top:10px;">Làm Bài Đánh Giá Ngay</a></p>
            `;
            await this.emailService.sendMail(candidate.email, `[ERP4U] Yêu cầu thực hiện bài đánh giá`, html);
        }

        return saved;
    }

    async submitAssessment(token: string, answers: any[]) {
        const candidate = await this.getCandidateByToken(token);
        if (!candidate) throw new NotFoundException('Invalid token');

        const assessment = await this.getAssessmentByCandidate(candidate.id);
        if (!assessment) throw new NotFoundException('No pending assessment found');

        assessment.answers_json = answers;
        assessment.status = AssessmentStatus.SUBMITTED;
        assessment.submitted_at = new Date();
        await this.assessmentRepo.save(assessment);

        return this.evaluateAssessment(assessment.id); // Auto evaluate after submit
    }

    async evaluateAssessment(assessmentId: number) {
        const assessment = await this.assessmentRepo.findOne({
            where: { id: assessmentId },
            relations: ['candidate', 'candidate.job_post']
        });

        if (!assessment) throw new NotFoundException('Assessment not found');

        const job = assessment.candidate.job_post;

        const prompt = `
### TASK:
Evaluate candidate answers based on the job description. Review for duplicated answers, generic AI-generated content patterns, and copy-pasting.
Job Title: ${job?.title}
Job Description: ${job?.description}
Questions & Candidate Answers: ${JSON.stringify({ questions: assessment.questions_json, answers: assessment.answers_json })}

### OUTPUT FORMAT:
You MUST return ONLY a valid JSON object in this structure:
{
  "score": <number 1-10>,
  "pros": ["point 1", "point 2"],
  "cons": ["point 1", "point 2"],
  "recommendation": "HIRE" | "POTENTIAL" | "REJECT",
  "duplication_flag": <boolean: true if answers appear highly suspicious, AI-generated, or copy-pasted>
}
`;

        const feedback = await this.aiService.evaluateAssessment(prompt);
        
        if (feedback) {
            assessment.ai_feedback = feedback;
            assessment.status = AssessmentStatus.EVALUATED;
            await this.assessmentRepo.save(assessment);

            const score = feedback?.score;
            if (score !== undefined) {
                let updateData: Partial<Candidate> = {
                    overall_score: score,
                    status: CandidateStatus.ASSESSED
                };

                // Feature 3: Auto-Schedule Interview when score >= 7
                if (score >= 7) {
                    const scheduledDate = new Date();
                    scheduledDate.setDate(scheduledDate.getDate() + 3);
                    scheduledDate.setHours(14, 0, 0, 0); // Default to 2:00 PM
                    
                    const interview = this.interviewRepo.create({
                        candidate_id: assessment.candidate_id,
                        scheduled_at: scheduledDate,
                        location: 'Google Meet',
                        hr_interviewer: 'HR Dept',
                        result_status: InterviewStatus.PENDING
                    });
                    await this.interviewRepo.save(interview);

                    updateData.status = CandidateStatus.INTERVIEW_SCHEDULED;
                    
                    // Notify candidate of the auto-scheduled interview
                    const html = `
                        <h2>Chúc mừng ${assessment.candidate.name},</h2>
                        <p>Bài đánh giá của bạn (Điểm: ${score}/10) đã đạt yêu cầu!</p>
                        <p>Chúng tôi đã tự động lên lịch phỏng vấn vào lúc <strong>${scheduledDate.toLocaleString('vi-VN')}</strong>.</p>
                        <p>Vui lòng truy cập Portal Ứng Viên để xem chi tiết lịch hẹn phỏng vấn.</p>
                        <a href="https://localhost:3000/portal/recruitment/${assessment.candidate.portal_token}" style="padding:10px 20px; background:#0056b3; color:white; text-decoration:none; border-radius:5px; display:inline-block; margin-top:10px;">Xem lịch phỏng vấn</a>
                    `;
                    await this.emailService.sendMail(assessment.candidate.email, '[ERP4U] Vượt qua bài test - Thư mời phỏng vấn', html);
                } else {
                    // Score < 7: Send rejection/feedback email
                    const recommendation = feedback?.recommendation || 'REJECT';
                    const pros = (feedback?.pros || []).map((p: string) => `<li>${p}</li>`).join('');
                    const cons = (feedback?.cons || []).map((c: string) => `<li>${c}</li>`).join('');

                    if (recommendation === 'REJECT') {
                        updateData.status = CandidateStatus.REJECTED;
                    }

                    const html = `
                        <h2>Chào ${assessment.candidate.name},</h2>
                        <p>Cảm ơn bạn đã hoàn thành bài đánh giá năng lực tại ERP4U.</p>
                        <p>Sau khi xem xét kỹ lưỡng, kết quả bài test của bạn (Điểm: <strong>${score}/10</strong>) ${recommendation === 'REJECT' ? 'chưa đạt yêu cầu cho vị trí này.' : 'được đánh giá ở mức <strong>Tiềm năng</strong>.'}</p>
                        ${pros ? `<p><strong>Điểm mạnh:</strong></p><ul>${pros}</ul>` : ''}
                        ${cons ? `<p><strong>Cần cải thiện:</strong></p><ul>${cons}</ul>` : ''}
                        <p>${recommendation === 'REJECT' 
                            ? 'Chúng tôi hy vọng sẽ có cơ hội hợp tác cùng bạn trong tương lai. ERP4U luôn chào đón bạn ứng tuyển lại các vị trí phù hợp khác.' 
                            : 'Chúng tôi sẽ lưu hồ sơ của bạn và liên hệ nếu có vị trí phù hợp hơn.'}</p>
                        <p style="color:#888; font-size:12px; margin-top:20px;">Trân trọng,<br/>Phòng Nhân sự — ERP4U</p>
                    `;
                    await this.emailService.sendMail(assessment.candidate.email, `[ERP4U] Phản hồi kết quả bài đánh giá`, html);
                }

                await this.candidateRepo.update(assessment.candidate_id, updateData);
            }
        }
        
        return assessment;
    }

    async generateAIQuestions(candidateId: number) {
        const candidate = await this.candidateRepo.findOne({
            where: { id: candidateId },
            relations: ['job_post']
        });
        if (!candidate) throw new NotFoundException('Candidate not found');

        return this.aiService.generateRecruitmentQuestions(
            candidate.job_post?.description || '',
            candidate.cv_url || ''
        );
    }

    // --- INTERVIEWS ---
    async findInterviews(candidateId?: number) {
         const where: any = {};
         if (candidateId) where.candidate_id = candidateId;
         return this.interviewRepo.find({ where, relations: ['candidate'], order: { scheduled_at: 'ASC' } });
    }

    async createInterview(data: Partial<Interview>) {
        const interview = this.interviewRepo.create(data);
        await this.candidateRepo.update(data.candidate_id, { status: CandidateStatus.INTERVIEW_SCHEDULED });
        const saved = await this.interviewRepo.save(interview);

        // Notify candidate of the manually scheduled interview
        const candidate = await this.candidateRepo.findOne({ where: { id: data.candidate_id } });
        if (candidate) {
            const html = `
                <h2>Chào ${candidate.name},</h2>
                <p>Nhân sự ERP4U vừa lên lịch phỏng vấn cho bạn.</p>
                <p>Vui lòng đăng nhập vào Portal Ứng Viên để xem chi tiết lịch phỏng vấn và địa điểm / meeting link.</p>
                <a href="https://localhost:3000/portal/recruitment/${candidate.portal_token}" style="padding:10px 20px; background:#0056b3; color:white; text-decoration:none; border-radius:5px; display:inline-block; margin-top:10px;">Chi tiết lịch phỏng vấn</a>
            `;
            await this.emailService.sendMail(candidate.email, '[ERP4U] Thư mời phỏng vấn & Lịch hẹn', html);
        }

        return saved;
    }

    async updateInterview(id: number, data: Partial<Interview>) {
        await this.interviewRepo.update(id, data);
        return this.interviewRepo.findOne({ where: { id } });
    }
    
    async deleteInterview(id: number) {
        return this.interviewRepo.delete(id);
    }

    // ==================== 360 REVIEW MODULE ====================

    // --- Review Questions ---
    async findAllReviewQuestions() {
        return this.reviewQuestionRepo.find({ order: { created_at: 'DESC' } });
    }

    async createReviewQuestion(data: Partial<ReviewQuestion>) {
        const q = this.reviewQuestionRepo.create(data);
        return this.reviewQuestionRepo.save(q);
    }

    async updateReviewQuestion(id: number, data: Partial<ReviewQuestion>) {
        await this.reviewQuestionRepo.update(id, data);
        return this.reviewQuestionRepo.findOne({ where: { id } });
    }

    async deleteReviewQuestion(id: number) {
        return this.reviewQuestionRepo.delete(id);
    }

    // --- Review Campaigns ---
    async findAllReviewCampaigns() {
        return this.reviewCampaignRepo.find({ order: { created_at: 'DESC' } });
    }

    async createReviewCampaign(data: Partial<ReviewCampaign> & { participant_ids?: number[] }) {
        const { participant_ids, ...campaignData } = data;
        const campaign = this.reviewCampaignRepo.create(campaignData);
        const savedCampaign = await this.reviewCampaignRepo.save(campaign);

        if (savedCampaign.status === CampaignStatus.ACTIVE && participant_ids && participant_ids.length > 0) {
            await this.generateReviewsForCampaign(savedCampaign, participant_ids);
        }

        return savedCampaign;
    }

    async updateReviewCampaign(id: number, data: Partial<ReviewCampaign> & { participant_ids?: number[] }) {
        const { participant_ids, ...campaignData } = data;
        
        const existing = await this.reviewCampaignRepo.findOne({ where: { id } });
        if (!existing) throw new NotFoundException('Campaign not found');

        await this.reviewCampaignRepo.update(id, campaignData);
        const updated = await this.reviewCampaignRepo.findOne({ where: { id } });

        // If transitioning to ACTIVE, generate reviews
        if (existing.status !== CampaignStatus.ACTIVE && updated?.status === CampaignStatus.ACTIVE && participant_ids && participant_ids.length > 0) {
            await this.generateReviewsForCampaign(updated, participant_ids);
        }

        return updated;
    }

    async deleteReviewCampaign(id: number) {
        // Also delete associated reviews
        await this.employeeReviewRepo.delete({ campaign_id: id });
        return this.reviewCampaignRepo.delete(id);
    }

    private async generateReviewsForCampaign(campaign: ReviewCampaign, participantIds: number[]) {
        const config = campaign.config_json || []; // e.g., [{ category: 'Kỹ năng', count: 3 }]
        
        // Fetch all questions
        const allQuestions = await this.reviewQuestionRepo.find();
        
        // Create reviews
        for (const empId of participantIds) {
            // 1. Self Review
            const selfQuestions = this.pickRandomQuestions(allQuestions, config);
            const selfReview = this.employeeReviewRepo.create({
                campaign_id: campaign.id,
                reviewer_id: empId,
                reviewee_id: empId,
                questions_json: selfQuestions,
                status: ReviewStatus.PENDING,
            });
            await this.employeeReviewRepo.save(selfReview);

            // 2. Peer Reviews (Cross-evaluation)
            // Pick 2 random peers (if available)
            const peers = participantIds.filter(id => id !== empId);
            const selectedPeers = peers.sort(() => 0.5 - Math.random()).slice(0, 2);
            
            for (const peerId of selectedPeers) {
                const peerQuestions = this.pickRandomQuestions(allQuestions, config);
                const peerReview = this.employeeReviewRepo.create({
                    campaign_id: campaign.id,
                    reviewer_id: peerId, // Peer evaluates empId
                    reviewee_id: empId,
                    questions_json: peerQuestions,
                    status: ReviewStatus.PENDING,
                });
                await this.employeeReviewRepo.save(peerReview);
            }
        }
    }

    private pickRandomQuestions(allQuestions: ReviewQuestion[], config: any[]) {
        let picked = [];
        for (const conf of config) {
            const categoryQuestions = allQuestions.filter(q => q.category === conf.category);
            const shuffled = categoryQuestions.sort(() => 0.5 - Math.random());
            picked.push(...shuffled.slice(0, conf.count));
        }
        return picked;
    }

    // --- Employee Reviews ---
    async findEmployeeReviews(reviewerId?: number, campaignId?: number) {
        const where: any = {};
        if (reviewerId) where.reviewer_id = reviewerId;
        if (campaignId) where.campaign_id = campaignId;

        return this.employeeReviewRepo.find({
            where,
            relations: ['campaign', 'reviewer', 'reviewee'],
            order: { created_at: 'DESC' }
        });
    }

    async submitEmployeeReview(id: number, answers: any) {
        const review = await this.employeeReviewRepo.findOne({ where: { id }, relations: ['reviewee'] });
        if (!review) throw new NotFoundException('Review not found');

        review.answers_json = answers;
        review.status = ReviewStatus.SUBMITTED;
        review.submitted_at = new Date();

        // Use AI to generate feedback
        const isSelf = review.reviewer_id === review.reviewee_id;
        const prompt = `
        Bạn là một chuyên gia Nhân sự. Dựa vào các câu hỏi và câu trả lời đánh giá 360 độ sau đây của nhân viên ${review.reviewee.full_name} (${isSelf ? 'Tự đánh giá' : 'Đồng nghiệp đánh giá'}), hãy đưa ra:
        1. Nhận xét tổng quan (Điểm mạnh, điểm yếu).
        2. Gợi ý cải thiện (Actionable feedback).
        
        Câu hỏi và câu trả lời:
        ${JSON.stringify({ questions: review.questions_json, answers: review.answers_json })}
        
        OUTPUT FORMAT: Return ONLY a valid JSON object with the key "feedback_markdown" containing the markdown feedback.
        `;

        try {
            const result = await this.aiService.evaluateAssessment(prompt);
            review.ai_feedback = result?.feedback_markdown || "Đã ghi nhận kết quả đánh giá.";
        } catch (e) {
            review.ai_feedback = "Đã ghi nhận kết quả đánh giá.";
        }

        return this.employeeReviewRepo.save(review);
    }
}

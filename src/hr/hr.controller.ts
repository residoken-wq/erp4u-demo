import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaveStatus } from './entities/leave-request.entity';
import { Public } from '../auth/public.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission, Perm } from '../auth/permissions.decorator';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrController {
    constructor(private readonly hrService: HrService) { }

    // ==================== WORK SHIFT ====================
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('shifts')
    findAllShifts() {
        return this.hrService.findAllShifts();
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('shifts')
    createShift(@Body() data: any) {
        return this.hrService.createShift(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('shifts/:id')
    updateShift(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateShift(+id, data);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('shifts/:id')
    deleteShift(@Param('id') id: string) {
        return this.hrService.deleteShift(+id);
    }

    // ==================== EMPLOYEE ====================
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('employees')
    findAllEmployees() {
        return this.hrService.findAllEmployees();
    }

    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('employees/by-user/:userId')
    findEmployeeByUserId(@Param('userId') userId: string) {
        return this.hrService.findEmployeeByUserId(+userId);
    }

    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('employees/:id')
    findOneEmployee(@Param('id') id: string) {
        return this.hrService.findOneEmployee(+id);
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('employees')
    createEmployee(@Body() data: any) {
        return this.hrService.createEmployee(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('employees/:id')
    updateEmployee(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateEmployee(+id, data);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('employees/:id')
    deleteEmployee(@Param('id') id: string) {
        return this.hrService.deleteEmployee(+id);
    }

    // ==================== ATTENDANCE ====================
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('attendances')
    findAttendances(
        @Query('employee_id') employeeId?: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
    ) {
        return this.hrService.findAttendances(
            employeeId ? +employeeId : undefined,
            month ? +month : undefined,
            year ? +year : undefined,
        );
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('check-in')
    checkIn(@Body('employee_id') employeeId: number) {
        return this.hrService.checkIn(employeeId);
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('check-out')
    checkOut(@Body('employee_id') employeeId: number) {
        return this.hrService.checkOut(employeeId);
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('attendances')
    createAttendance(@Body() data: any) {
        return this.hrService.createAttendance(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('attendances/:id')
    updateAttendance(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateAttendance(+id, data);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('attendances/:id')
    deleteAttendance(@Param('id') id: string) {
        return this.hrService.deleteAttendance(+id);
    }

    // ==================== LEAVE REQUEST ====================
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('leaves')
    findAllLeaves(@Query('status') status?: LeaveStatus) {
        return this.hrService.findAllLeaves(status);
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('leaves')
    createLeave(@Body() data: any) {
        return this.hrService.createLeave(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('leaves/:id/approve')
    approveLeave(
        @Param('id') id: string,
        @Body() body: { approved: boolean; reject_reason?: string },
        @Request() req: any,
    ) {
        return this.hrService.approveLeave(+id, req.user.userId, body.approved, body.reject_reason);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('leaves/:id')
    deleteLeave(@Param('id') id: string) {
        return this.hrService.deleteLeave(+id);
    }

    // ==================== LEAVE ENTITLEMENT ====================
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('entitlements')
    findEntitlements(
        @Query('employee_id') employeeId?: string,
        @Query('year') year?: string,
    ) {
        return this.hrService.findEntitlements(
            employeeId ? +employeeId : undefined,
            year ? +year : undefined,
        );
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('entitlements')
    createEntitlement(@Body() data: any) {
        return this.hrService.createEntitlement(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('entitlements/:id')
    updateEntitlement(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateEntitlement(+id, data);
    }

    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('balance/:employeeId')
    getLeaveBalance(
        @Param('employeeId') employeeId: string,
        @Query('year') year?: string,
    ) {
        const y = year ? +year : new Date().getFullYear();
        return this.hrService.getLeaveBalance(+employeeId, y);
    }

    // ==================== ASSET ASSIGNMENT ====================
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('assets')
    findAllAssets(@Query('employee_id') employeeId?: string) {
        return this.hrService.findAllAssets(employeeId ? +employeeId : undefined);
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('assets')
    createAsset(@Body() data: any) {
        return this.hrService.createAsset(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('assets/:id')
    updateAsset(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateAsset(+id, data);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('assets/:id')
    deleteAsset(@Param('id') id: string) {
        return this.hrService.deleteAsset(+id);
    }

    // ==================== PAYSLIP ====================
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('payslips')
    findPayslips(
        @Query('employee_id') employeeId?: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
    ) {
        return this.hrService.findPayslips(
            employeeId ? +employeeId : undefined,
            month ? +month : undefined,
            year ? +year : undefined,
        );
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('payslips')
    createPayslip(@Body() data: any) {
        return this.hrService.createPayslip(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('payslips/:id')
    updatePayslip(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updatePayslip(+id, data);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('payslips/:id')
    deletePayslip(@Param('id') id: string) {
        return this.hrService.deletePayslip(+id);
    }

    // ==================== TRAINING PLAN ====================
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('trainings')
    findTrainingPlans(@Query('employee_id') employeeId?: string) {
        return this.hrService.findTrainingPlans(employeeId ? +employeeId : undefined);
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('trainings')
    createTrainingPlan(@Body() data: any) {
        return this.hrService.createTrainingPlan(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('trainings/:id')
    updateTrainingPlan(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateTrainingPlan(+id, data);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('trainings/:id')
    deleteTrainingPlan(@Param('id') id: string) {
        return this.hrService.deleteTrainingPlan(+id);
    }

    // ==================== RECRUITMENT ====================

    @Get('recruitment/jobs')
    @RequirePermission('HR', 'can_view')
    findAllJobs() {
        return this.hrService.findAllJobs();
    }

    @Post('recruitment/jobs')
    @RequirePermission('HR', 'can_create')
    createJob(@Body() data: any) {
        return this.hrService.createJob(data);
    }

    @Put('recruitment/jobs/:id')
    @RequirePermission('HR', 'can_update')
    updateJob(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateJob(+id, data);
    }

    @Delete('recruitment/jobs/:id')
    @RequirePermission('HR', 'can_delete')
    deleteJob(@Param('id') id: string) {
        return this.hrService.deleteJob(+id);
    }

    @Post('recruitment/jobs/parse-requirements')
    @RequirePermission('HR', 'can_create')
    parseRequirements(@Body('description') description: string) {
        // We inject AiService implicitly via HrService, wait, HrService does not expose it natively unless we add a wrapper.
        // It's better to add the wrapper in HrService or inject AiService directly into HrController.
        // Let's call hrService.parseJDCompetencies (need to add it)
        return this.hrService.parseJDCompetencies(description);
    }

    @Get('recruitment/candidates')
    @RequirePermission('HR', 'can_view')
    findCandidates(@Query('job_id') jobId?: string) {
        return this.hrService.findCandidates(jobId ? +jobId : undefined);
    }

    @Post('recruitment/candidates')
    @RequirePermission('HR', 'can_create')
    createCandidate(@Body() data: any) {
        return this.hrService.createCandidate(data);
    }

    @Put('recruitment/candidates/:id')
    @RequirePermission('HR', 'can_update')
    updateCandidate(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateCandidate(+id, data);
    }

    @Delete('recruitment/candidates/:id')
    @RequirePermission('HR', 'can_delete')
    deleteCandidate(@Param('id') id: string) {
        return this.hrService.deleteCandidate(+id);
    }

    @Post('recruitment/candidates/:id/send-assessment')
    @RequirePermission('HR', 'can_update')
    sendAssessment(@Param('id') id: string, @Body('questions') questions: any[]) {
        return this.hrService.createAssessment(+id, questions);
    }

    @Post('recruitment/candidates/:id/generate-questions')
    @RequirePermission('HR', 'can_update')
    generateQuestions(@Param('id') id: string) {
        return this.hrService.generateAIQuestions(+id);
    }

    @Get('recruitment/assessments/:candidateId')
    @RequirePermission('HR', 'can_view')
    getAssessment(@Param('candidateId') candidateId: string) {
        return this.hrService.getAssessmentByCandidate(+candidateId);
    }
    
    @Post('recruitment/assessments/:id/evaluate')
    @RequirePermission('HR', 'can_update')
    evaluateAssessment(@Param('id') id: string) {
        return this.hrService.evaluateAssessment(+id);
    }

    @Get('recruitment/interviews')
    @RequirePermission('HR', 'can_view')
    findInterviews(@Query('candidate_id') candidateId?: string) {
        return this.hrService.findInterviews(candidateId ? +candidateId : undefined);
    }

    @Post('recruitment/interviews')
    @RequirePermission('HR', 'can_create')
    createInterview(@Body() data: any) {
        return this.hrService.createInterview(data);
    }

    @Put('recruitment/interviews/:id')
    @RequirePermission('HR', 'can_update')
    updateInterview(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateInterview(+id, data);
    }

    @Delete('recruitment/interviews/:id')
    @RequirePermission('HR', 'can_delete')
    deleteInterview(@Param('id') id: string) {
        return this.hrService.deleteInterview(+id);
    }
    // ==================== 360 REVIEW MODULE ====================

    // --- Review Questions ---
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('review-questions')
    findAllReviewQuestions() {
        return this.hrService.findAllReviewQuestions();
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('review-questions')
    createReviewQuestion(@Body() data: any) {
        return this.hrService.createReviewQuestion(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('review-questions/:id')
    updateReviewQuestion(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateReviewQuestion(+id, data);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('review-questions/:id')
    deleteReviewQuestion(@Param('id') id: string) {
        return this.hrService.deleteReviewQuestion(+id);
    }

    // --- Review Campaigns ---
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('review-campaigns')
    findAllReviewCampaigns() {
        return this.hrService.findAllReviewCampaigns();
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('review-campaigns')
    createReviewCampaign(@Body() data: any) {
        return this.hrService.createReviewCampaign(data);
    }

    @RequirePermission('HR', 'can_update')
    @Perm('HR', 'update')
    @Put('review-campaigns/:id')
    updateReviewCampaign(@Param('id') id: string, @Body() data: any) {
        return this.hrService.updateReviewCampaign(+id, data);
    }

    @RequirePermission('HR', 'can_delete')
    @Perm('HR', 'delete')
    @Delete('review-campaigns/:id')
    deleteReviewCampaign(@Param('id') id: string) {
        return this.hrService.deleteReviewCampaign(+id);
    }

    // --- Employee Reviews ---
    @RequirePermission('HR', 'can_view')
    @Perm('HR', 'view')
    @Get('employee-reviews')
    findEmployeeReviews(
        @Query('reviewer_id') reviewerId?: string,
        @Query('campaign_id') campaignId?: string,
    ) {
        return this.hrService.findEmployeeReviews(
            reviewerId ? +reviewerId : undefined,
            campaignId ? +campaignId : undefined,
        );
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('employee-reviews/:id/submit')
    submitEmployeeReview(@Param('id') id: string, @Body('answers') answers: any) {
        return this.hrService.submitEmployeeReview(+id, answers);
    }

    @RequirePermission('HR', 'can_create')
    @Perm('HR', 'create')
    @Post('review-questions-seed')
    async seedReviewQuestions() {
        const fs = require('fs');
        const path = require('path');
        const dataPath = path.join(process.cwd(), 'parsed_questions.json');
        if (fs.existsSync(dataPath)) {
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            for (const item of data) {
                await this.hrService.createReviewQuestion(item);
            }
            return { message: `Seeded ${data.length} questions` };
        }
        return { message: 'File not found' };
    }
}

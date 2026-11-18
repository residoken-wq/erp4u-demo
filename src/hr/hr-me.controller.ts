import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthOnly } from '../auth/permissions.decorator';
import { LeaveStatus, LeaveType } from './entities/leave-request.entity';

@Controller('hr/me')
@UseGuards(JwtAuthGuard)
export class HrMeController {
  constructor(private readonly hrService: HrService) {}

  private async resolveMyEmployee(req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new NotFoundException('Tài khoản chưa được liên kết hồ sơ nhân viên');
    }
    const employee = await this.hrService.findEmployeeByUserId(+userId);
    if (!employee) {
      throw new NotFoundException('Tài khoản chưa được liên kết hồ sơ nhân viên');
    }
    return employee;
  }

  @Get()
  @AuthOnly()
  async getMyProfile(@Request() req: any) {
    return this.resolveMyEmployee(req);
  }

  @Get('attendances')
  @AuthOnly()
  async getMyAttendances(
    @Request() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.findAttendances(
      employee.id,
      month ? +month : undefined,
      year ? +year : undefined,
    );
  }

  @Get('leaves')
  @AuthOnly()
  async getMyLeaves(
    @Request() req: any,
    @Query('status') status?: LeaveStatus,
  ) {
    const employee = await this.resolveMyEmployee(req);
    const leaves = await this.hrService.findAllLeaves(status);
    return leaves.filter((l: any) => l.employee_id === employee.id);
  }

  @Get('payslips')
  @AuthOnly()
  async getMyPayslips(
    @Request() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.findPayslips(
      employee.id,
      month ? +month : undefined,
      year ? +year : undefined,
    );
  }

  @Get('assets')
  @AuthOnly()
  async getMyAssets(@Request() req: any) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.findAllAssets(employee.id);
  }

  @Get('balance')
  @AuthOnly()
  async getMyLeaveBalance(
    @Request() req: any,
    @Query('year') year?: string,
  ) {
    const employee = await this.resolveMyEmployee(req);
    const y = year ? +year : new Date().getFullYear();
    return this.hrService.getLeaveBalance(employee.id, y);
  }

  @Post('check-in')
  @AuthOnly()
  async checkIn(@Request() req: any) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.checkIn(employee.id);
  }

  @Post('check-out')
  @AuthOnly()
  async checkOut(@Request() req: any) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.checkOut(employee.id);
  }

  @Post('leaves')
  @AuthOnly()
  async createMyLeave(@Request() req: any, @Body() body: any) {
    const employee = await this.resolveMyEmployee(req);
    const { type, leave_type, start_date, end_date, days, reason } = body || {};
    return this.hrService.createLeave({
      employee_id: employee.id,
      leave_type: (leave_type || type || LeaveType.ANNUAL) as LeaveType,
      start_date,
      end_date,
      days,
      reason,
      status: LeaveStatus.PENDING,
    });
  }

  @Get('reviews')
  @AuthOnly()
  async getMyReviews(@Request() req: any) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.findEmployeeReviews(employee.id);
  }

  @Post('reviews/:id/submit')
  @AuthOnly()
  async submitMyReview(
    @Request() req: any,
    @Param('id') id: string,
    @Body('answers') answers: any,
  ) {
    const employee = await this.resolveMyEmployee(req);
    const myReviews = await this.hrService.findEmployeeReviews(employee.id);
    const target = myReviews.find((r: any) => r.id === Number(id));
    if (!target) {
      throw new ForbiddenException('Review does not belong to you');
    }
    return this.hrService.submitEmployeeReview(Number(id), answers);
  }
}

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
import { RequiresPackage } from '../common/packages/requires-package.decorator';
import { PackageKey } from '../common/packages/package.registry';

@Controller('hr/me')
@RequiresPackage(PackageKey.HR)
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
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
  async getMyProfile(@Request() req: any) {
    return this.resolveMyEmployee(req);
  }

  @Get('attendances')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
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

  @Get('attendances/:id')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
  async getMyAttendanceById(@Request() req: any, @Param('id') id: string) {
    const employee = await this.resolveMyEmployee(req);
    const attendance = await this.hrService.findOneAttendance(+id);
    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi chấm công');
    }
    if (attendance.employee_id !== employee.id) {
      throw new ForbiddenException('Bạn chỉ có thể xem chấm công của chính mình');
    }
    return attendance;
  }

  @Get('leaves')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
  async getMyLeaves(
    @Request() req: any,
    @Query('status') status?: LeaveStatus,
  ) {
    const employee = await this.resolveMyEmployee(req);
    const leaves = await this.hrService.findAllLeaves(status);
    return leaves.filter((l: any) => l.employee_id === employee.id);
  }

  @Get('leaves/:id')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
  async getMyLeaveById(@Request() req: any, @Param('id') id: string) {
    const employee = await this.resolveMyEmployee(req);
    const leave = await this.hrService.findOneLeave(+id);
    if (!leave) {
      throw new NotFoundException('Không tìm thấy đơn nghỉ phép');
    }
    if (leave.employee_id !== employee.id) {
      throw new ForbiddenException('Bạn chỉ có thể xem đơn nghỉ phép của chính mình');
    }
    return leave;
  }

  @Post('leaves')
  @AuthOnly({ selfOr: { module: 'HR', action: 'create' } })
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

  @Get('payslips')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
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

  @Get('payslips/:id')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
  async getMyPayslipById(@Request() req: any, @Param('id') id: string) {
    const employee = await this.resolveMyEmployee(req);
    const payslip = await this.hrService.findOnePayslip(+id);
    if (!payslip) {
      throw new NotFoundException('Không tìm thấy phiếu lương');
    }
    if (payslip.employee_id !== employee.id) {
      throw new ForbiddenException('Bạn chỉ có thể xem phiếu lương của chính mình');
    }
    return payslip;
  }

  @Get('assets')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
  async getMyAssets(@Request() req: any) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.findAllAssets(employee.id);
  }

  @Get('balance')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
  async getMyLeaveBalance(
    @Request() req: any,
    @Query('year') year?: string,
  ) {
    const employee = await this.resolveMyEmployee(req);
    const y = year ? +year : new Date().getFullYear();
    return this.hrService.getLeaveBalance(employee.id, y);
  }

  @Post('check-in')
  @AuthOnly({ selfOr: { module: 'HR', action: 'create' } })
  async checkIn(@Request() req: any) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.checkIn(employee.id);
  }

  @Post('check-out')
  @AuthOnly({ selfOr: { module: 'HR', action: 'create' } })
  async checkOut(@Request() req: any) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.checkOut(employee.id);
  }

  @Get('reviews')
  @AuthOnly({ selfOr: { module: 'HR', action: 'view' } })
  async getMyReviews(@Request() req: any) {
    const employee = await this.resolveMyEmployee(req);
    return this.hrService.findEmployeeReviews(employee.id);
  }

  @Post('reviews/:id/submit')
  @AuthOnly({ selfOr: { module: 'HR', action: 'create' } })
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

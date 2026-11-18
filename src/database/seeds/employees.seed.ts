import { DataSource, DeepPartial } from 'typeorm';
import { Employee, Gender } from '../../hr/entities/employee.entity';
import { WorkShift } from '../../hr/entities/work-shift.entity';
import { User } from '../../users/entities/user.entity';

export async function seedEmployees(dataSource: DataSource) {
  const empRepo = dataSource.getRepository(Employee);
  const shiftRepo = dataSource.getRepository(WorkShift);
  const userRepo = dataSource.getRepository(User);

  console.log('  -> Seeding Work Shifts & Employees (Encrypted)...');
  let defaultShift = await shiftRepo.findOne({ where: { name: 'Ca Hành Chính (8:00 - 17:00)' } });
  if (!defaultShift) {
    defaultShift = shiftRepo.create({
      name: 'Ca Hành Chính (8:00 - 17:00)',
      start_time: '08:00',
      end_time: '17:00',
      break_duration_minutes: 60,
      is_night_shift: false,
    } as DeepPartial<WorkShift>);
    defaultShift = await shiftRepo.save(defaultShift);
  }

  const users = await userRepo.find();
  const userMap = new Map(users.map((u) => [u.username, u]));

  const employeesData = [
    { username: 'admin', full_name: 'Quản Trị Viên Demo', department: 'Ban Giám Đốc', position: 'Tổng Giám Đốc', base_salary: 45000000, phone: '0900000011', address: 'Số 1 Đường Mẫu, Quận Mẫu, TP. Mẫu', gender: Gender.MALE },
    { username: 'sales01', full_name: 'Nhân viên Demo 01 (Trưởng Phòng Kinh Doanh)', department: 'Phòng Kinh Doanh', position: 'Trưởng Phòng Kinh Doanh', base_salary: 22000000, phone: '0900000012', address: 'Số 2 Đường Mẫu, Quận Mẫu, TP. Mẫu', gender: Gender.MALE },
    { username: 'warehouse01', full_name: 'Nhân viên Demo 02 (Thủ Kho Trưởng)', department: 'Kho Vận & Vật Tư', position: 'Thủ Kho Trưởng', base_salary: 16000000, phone: '0900000013', address: 'Số 3 Đường Mẫu, Quận Mẫu, TP. Mẫu', gender: Gender.FEMALE },
    { username: 'accountant01', full_name: 'Nhân viên Demo 03 (Kế Toán Trưởng)', department: 'Phòng Kế Toán', position: 'Kế Toán Trưởng', base_salary: 20000000, phone: '0900000014', address: 'Số 4 Đường Mẫu, Quận Mẫu, TP. Mẫu', gender: Gender.MALE },
    { username: 'hr01', full_name: 'Nhân viên Demo 04 (Trưởng Phòng Nhân Sự)', department: 'Phòng Nhân Sự', position: 'Trưởng Phòng Nhân Sự', base_salary: 18000000, phone: '0900000015', address: 'Số 5 Đường Mẫu, Quận Mẫu, TP. Mẫu', gender: Gender.FEMALE },
  ];

  for (const e of employeesData) {
    const user = userMap.get(e.username);
    let emp = await empRepo.findOne({ where: { full_name: e.full_name } });
    if (!emp) {
      emp = empRepo.create({
        full_name: e.full_name,
        department: e.department,
        position: e.position,
        base_salary: e.base_salary,
        phone: e.phone,
        address: e.address,
        gender: e.gender,
        work_shift: defaultShift,
        user: user,
        user_id: user?.id,
        hire_date: new Date('2024-01-15'),
        is_active: true,
      } as DeepPartial<Employee>);
      await empRepo.save(emp);
    }
  }
}

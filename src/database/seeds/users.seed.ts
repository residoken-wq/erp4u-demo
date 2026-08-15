import { DataSource } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserGroup } from '../../users/entities/user-group.entity';
import * as bcrypt from 'bcrypt';

export async function seedUsers(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const groupRepo = dataSource.getRepository(UserGroup);

  console.log('  -> Seeding Demo Users...');
  const groups = await groupRepo.find();
  const groupMap = new Map(groups.map((g) => [g.name, g.id]));

  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const demoPassword = await bcrypt.hash('demo123', salt);

  const demoUsers = [
    { username: 'admin', full_name: 'Quản Trị Viên (Admin)', email: 'admin@erp4u.demo', password: adminPassword, groupName: 'Admin' },
    { username: 'sales01', full_name: 'Nguyễn Văn Minh (Sales Lead)', email: 'sales@erp4u.demo', password: demoPassword, groupName: 'Kinh Doanh' },
    { username: 'warehouse01', full_name: 'Trần Thị Thu Thảo (Thủ Kho)', email: 'warehouse@erp4u.demo', password: demoPassword, groupName: 'Quản Lý Kho' },
    { username: 'accountant01', full_name: 'Lê Hoàng Anh (Kế Toán Trưởng)', email: 'accounting@erp4u.demo', password: demoPassword, groupName: 'Kế Toán' },
    { username: 'hr01', full_name: 'Phạm Ngọc Mai (Trưởng Phòng HR)', email: 'hr@erp4u.demo', password: demoPassword, groupName: 'Nhân Sự' },
  ];

  for (const u of demoUsers) {
    let user = await userRepo.findOne({ where: { username: u.username } });
    const groupId = groupMap.get(u.groupName);

    if (!user) {
      user = userRepo.create({
        username: u.username,
        full_name: u.full_name,
        email: u.email,
        password: u.password,
        is_active: true,
        group_id: groupId,
      });
      await userRepo.save(user);
    }
  }
}

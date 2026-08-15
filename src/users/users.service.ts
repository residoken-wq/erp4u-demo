import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserGroup } from './entities/user-group.entity';
import { GroupPermission } from './entities/group-permission.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserGroup) private groupRepo: Repository<UserGroup>,
    @InjectRepository(GroupPermission) private permRepo: Repository<GroupPermission>,
  ) { }

  // --- USER MANAGEMENT ---
  async getAllUsers() {
    return this.userRepo.find({ relations: ['group'], order: { id: 'DESC' } });
  }

  async createUser(data: any) {
    const existing = await this.userRepo.findOne({ where: { username: data.username } });
    if (existing) throw new BadRequestException('Tên đăng nhập đã tồn tại');

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.userRepo.create({ ...data, password: hashedPassword });
    return this.userRepo.save(user);
  }

  async updateUser(id: number, data: any) {
    await this.userRepo.update(id, data);
    return this.userRepo.findOne({ where: { id }, relations: ['group'] });
  }

  async deleteUser(id: number) {
    return this.userRepo.delete(id);
  }

  async changePassword(id: number, newPass: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.password = await bcrypt.hash(newPass, 10);
    return this.userRepo.save(user);
  }

  async getOnlineUsers() {
    const timeLimit = new Date(Date.now() - 15 * 60 * 1000); // 15 mins
    return this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.group', 'group')
      .where('user.last_activity_at > :timeLimit', { timeLimit })
      .orderBy('user.last_activity_at', 'DESC')
      .getMany();
  }

  // --- GROUP & PERMISSION MANAGEMENT ---
  async getAllGroups() {
    return this.groupRepo.find({ order: { id: 'ASC' }, relations: ['permissions'] });
  }

  async getGroupDetail(id: number) {
    return this.groupRepo.findOne({ where: { id }, relations: ['permissions'] });
  }

  async createGroup(data: any) {
    const group = this.groupRepo.create({ name: data.name, description: data.description });
    const saved = await this.groupRepo.save(group);

    if (data.permissions && data.permissions.length > 0) {
      const permObjects = data.permissions.map((p: any) => ({
        ...p,
        group_id: saved.id
      }));

      const perms = this.permRepo.create(permObjects);
      await this.permRepo.save(perms);
    }
    return saved;
  }

  async updateGroupPermissions(groupId: number, data: any) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');

    if (data.name) await this.groupRepo.update(groupId, { name: data.name, description: data.description });

    // Xóa quyền cũ và thêm quyền mới
    if (data.permissions) {
      await this.permRepo.delete({ group_id: groupId });

      const permObjects = data.permissions.map((p: any) => ({
        ...p,
        group_id: groupId
      }));

      const perms = this.permRepo.create(permObjects);
      await this.permRepo.save(perms);
    }
    return { success: true };
  }

  // --- QUAN TRỌNG: Lấy user kèm theo Permissions ---
  async findOneByUsernameForAuth(username: string) {
    return this.userRepo.createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.group', 'group')
      .leftJoinAndSelect('group.permissions', 'permissions') // Lấy danh sách quyền
      .where('user.username = :username', { username })
      .getOne();
  }
}
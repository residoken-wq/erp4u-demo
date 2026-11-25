import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectsService } from '../projects.service';
import { Project } from '../entities/project.entity';
import { Milestone } from '../entities/milestone.entity';
import { SalesOrder } from '../../sales/sales-order.entity';
import { Task } from '../../tasks/task.entity';
import { Transaction } from '../../finance/transaction.entity';
import { PurchaseOrder } from '../../purchasing/entities/purchase-order.entity';
import { SystemConfig } from '../../system/system-config.entity';
import { PermissionCacheService } from '../../auth/permission-cache.service';

describe('ProjectsService (Unit Tests / P12b1-r4)', () => {
  let service: ProjectsService;
  let mockProjectRepo: any;
  let mockMilestoneRepo: any;
  let mockSoRepo: any;
  let mockTaskRepo: any;
  let mockTransRepo: any;
  let mockPoRepo: any;
  let mockConfigRepo: any;
  let mockPermCacheService: any;

  const mockProjects = [
    {
      id: 101,
      title: 'Project 101 by User 10',
      created_by_id: 10,
      manager_id: 10,
      members: [],
      tasks: [],
      sales_order: null,
    },
    {
      id: 102,
      title: 'Project 102 by User 20',
      created_by_id: 20,
      manager_id: 20,
      members: [{ id: 30 }],
      tasks: [{ assignee_id: 40 }],
      sales_order: { assigned_to_id: 50 },
    },
  ];

  beforeEach(async () => {
    mockProjectRepo = {
      find: jest.fn().mockResolvedValue([...mockProjects]),
      findOne: jest.fn().mockImplementation(({ where: { id } }: any) => {
        const found = mockProjects.find((p) => p.id === id);
        return Promise.resolve(found ? { ...found } : null);
      }),
    };

    mockMilestoneRepo = { find: jest.fn().mockResolvedValue([]) };
    mockSoRepo = { findOne: jest.fn().mockResolvedValue(null) };
    mockTaskRepo = { find: jest.fn().mockResolvedValue([]) };
    mockTransRepo = { find: jest.fn().mockResolvedValue([]) };
    mockPoRepo = { find: jest.fn().mockResolvedValue([]) };
    mockConfigRepo = { findOne: jest.fn().mockResolvedValue(null) };

    mockPermCacheService = {
      hasAny: jest.fn().mockImplementation((groupId: number, perms: any[]) => {
        // Only group 2 has PROJECTS:update
        if (groupId === 2 && perms.some((p) => p.module === 'PROJECTS' && p.action === 'update')) {
          return true;
        }
        return false;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Milestone), useValue: mockMilestoneRepo },
        { provide: getRepositoryToken(SalesOrder), useValue: mockSoRepo },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(Transaction), useValue: mockTransRepo },
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPoRepo },
        { provide: getRepositoryToken(SystemConfig), useValue: mockConfigRepo },
        { provide: PermissionCacheService, useValue: mockPermCacheService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('findAll', () => {
    it('admin user (username === "admin") sees all projects', async () => {
      const adminUser = { id: 1, username: 'admin', groupId: 1 };
      const res = await service.findAll(adminUser);
      expect(res.length).toBe(2);
      expect(res.map((p) => p.id)).toEqual([101, 102]);
    });

    it('user with PROJECTS:update sees all projects', async () => {
      const managerUser = { id: 99, username: 'project_lead', groupId: 2 };
      const res = await service.findAll(managerUser);
      expect(res.length).toBe(2);
      expect(res.map((p) => p.id)).toEqual([101, 102]);
    });

    it('user in groupId 1 but NOT admin and WITHOUT PROJECTS:update only sees own/assigned projects', async () => {
      const nonAdminGroup1 = { id: 10, username: 'group1_staff', groupId: 1 };
      const res = await service.findAll(nonAdminGroup1);
      // User 10 created project 101, but not 102
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(101);
    });

    it('user sees projects where they are member, task assignee, or SO owner', async () => {
      // Member (id 30)
      const resMember = await service.findAll({ id: 30, username: 'member_user', groupId: 9 });
      expect(resMember.map((p) => p.id)).toEqual([102]);

      // Task assignee (id 40)
      const resTask = await service.findAll({ id: 40, username: 'task_user', groupId: 9 });
      expect(resTask.map((p) => p.id)).toEqual([102]);

      // SO owner (id 50)
      const resSO = await service.findAll({ id: 50, username: 'so_user', groupId: 9 });
      expect(resSO.map((p) => p.id)).toEqual([102]);
    });

    it('unrelated user sees empty list', async () => {
      const stranger = { id: 999, username: 'stranger', groupId: 1 };
      const res = await service.findAll(stranger);
      expect(res).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('admin user can access any project', async () => {
      const adminUser = { id: 1, username: 'admin', groupId: 1 };
      const res = await service.findOne(102, adminUser);
      expect(res.id).toBe(102);
    });

    it('user with PROJECTS:update can access any project', async () => {
      const managerUser = { id: 99, username: 'project_lead', groupId: 2 };
      const res = await service.findOne(102, managerUser);
      expect(res.id).toBe(102);
    });

    it('user in groupId 1 but NOT admin and WITHOUT PROJECTS:update gets 404 on others project', async () => {
      const nonAdminGroup1 = { id: 10, username: 'group1_staff', groupId: 1 };
      // User 10 did not create or belong to project 102
      await expect(service.findOne(102, nonAdminGroup1)).rejects.toThrow(NotFoundException);
    });

    it('creator can access own project', async () => {
      const creator = { id: 10, username: 'group1_staff', groupId: 1 };
      const res = await service.findOne(101, creator);
      expect(res.id).toBe(101);
    });
  });
});

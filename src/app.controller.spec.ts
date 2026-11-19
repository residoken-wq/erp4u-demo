import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { DataSource } from 'typeorm';
import { ServiceUnavailableException } from '@nestjs/common';

describe('AppController', () => {
    let appController: AppController;
    let mockDataSource: { query: jest.Mock };

    beforeEach(async () => {
        mockDataSource = {
            query: jest.fn(),
        };

        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                },
            ],
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe('root', () => {
        it('should be defined', () => {
            expect(appController).toBeDefined();
        });
    });

    describe('GET /health', () => {
        it('should return { status: "ok" } when database query succeeds', async () => {
            mockDataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);
            const res = await appController.health();
            expect(res).toEqual({ status: 'ok' });
            expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
        });

        it('should throw ServiceUnavailableException (503) without leaking details when database query fails', async () => {
            mockDataSource.query.mockRejectedValueOnce(new Error('Connection refused'));
            await expect(appController.health()).rejects.toThrow(ServiceUnavailableException);
        });
    });
});

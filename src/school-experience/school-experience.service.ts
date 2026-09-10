import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    SchoolExperienceRevision,
    SchoolExperienceStatus,
} from './entities/school-experience-revision.entity';

@Injectable()
export class SchoolExperienceService {
    constructor(
        @InjectRepository(SchoolExperienceRevision)
        private readonly revisionRepo: Repository<SchoolExperienceRevision>,
    ) {}

    /**
     * Canonical baseline seed data matching Instruction 07-10 contracts
     */
    public getDefaultConfig() {
        return {
            version: 1,
            r7RenderMode: 'illustrated_sequence' as const,
            rooms: {
                R1: {
                    id: 'R1',
                    name: 'Lớp Lá',
                    title: 'Lớp Lá · Nệm Cotton Cara',
                    desc: 'Dòng nệm mầm non bán chạy nhất, vải Cotton Cara thoáng khí viền xám.',
                    thumbnail: '/images/tour360/real-photos/catalogue/cara_blue.jpg',
                    active: true,
                    productReference: 'REF-MAT-CARA-STD',
                },
                R2: {
                    id: 'R2',
                    name: 'Lớp Nắng',
                    title: 'Lớp Nắng · Nệm Satin Hàn Quốc',
                    desc: 'Chất liệu Satin Hàn Quốc mướt mát, chống nhăn và êm ái cho làn da nhạy cảm.',
                    thumbnail: '/images/tour360/real-photos/catalogue/NEM_MN_-_01.jpg',
                    active: true,
                    productReference: 'REF-MAT-SATIN-STD',
                },
                R3: {
                    id: 'R3',
                    name: 'Lớp Mầm',
                    title: 'Lớp Mầm · Nệm Foam Gấp 4',
                    desc: 'Nệm foam gấp 4 đoạn tiện lợi, dễ dàng gấp gọn và xếp lên kệ cubby.',
                    thumbnail: '/images/tour360/cubby_nap.jpg',
                    active: true,
                    productReference: 'REF-FOAM-FOLD4',
                },
                R4: {
                    id: 'R4',
                    name: 'Lớp Mây',
                    title: 'Lớp Mây · Túi Ngủ Mầm Non',
                    desc: 'Túi ngủ ấm áp liền chăn đệm, giữ ấm an toàn và tạo thói quen tự lập cho bé.',
                    thumbnail: '/images/tour360/classroom_wide.jpg',
                    active: true,
                    productReference: 'REF-SLEEP-CARA-STD',
                },
                R5: {
                    id: 'R5',
                    name: 'Góc Gọn Gàng',
                    title: 'Góc Gọn Gàng · Túi Bảo Quản',
                    desc: 'Kệ cất túi cá nhân của các con với nhãn tên, quai xách chắc chắn.',
                    thumbnail: '/images/tour360/products/tui-quai-xach.jpg',
                    active: true,
                    productReference: 'REF-BAG-DRAWSTRING',
                },
                R6: {
                    id: 'R6',
                    name: 'Lớp ERP4U',
                    title: 'Lớp ERP4U · Phối Hợp 5 Dòng Sản Phẩm',
                    desc: 'Trưng bày phối hợp trọn bộ nệm, túi ngủ, nệm foam và kệ túi trong lớp học.',
                    thumbnail: '/images/tour360/showroom/classroom-concept.png',
                    active: true,
                    productReference: 'REF-CAMPUS-COMBO',
                },
                R7: {
                    id: 'R7',
                    name: 'Phòng Đón Bé',
                    title: 'Phòng Đón Bé · Bàn Giao Cuối Tuần',
                    desc: 'Nhận đúng túi của bé Mây, kiểm tra nhãn tên và bàn giao cùng cô An.',
                    thumbnail: '/images/tour360/r7/me-linh/h0-greet.webp',
                    active: true,
                    productReference: 'REF-BAG-HANDLE',
                },
                H0: {
                    id: 'H0',
                    name: 'Hành Lang',
                    title: 'Hành Lang Trường Mầm Non ERP4U',
                    desc: 'Lối đi chung kết nối toàn trường',
                    thumbnail: '/images/tour360/school-pov/05_School-Map.png',
                    active: true,
                },
            },
            productBindings: {
                'REF-MAT-CARA-STD_blue_real_photo': {
                    productReference: 'REF-MAT-CARA-STD',
                    colorId: 'blue',
                    slotType: 'real_photo' as const,
                    assetUrl: '/images/tour360/real-photos/catalogue/cara_blue.jpg',
                    updatedAt: new Date().toISOString(),
                },
                'REF-MAT-CARA-STD_green_real_photo': {
                    productReference: 'REF-MAT-CARA-STD',
                    colorId: 'green',
                    slotType: 'real_photo' as const,
                    assetUrl: '/images/tour360/real-photos/catalogue/cara_green.jpg',
                    updatedAt: new Date().toISOString(),
                },
                'REF-MAT-CARA-STD_orange_real_photo': {
                    productReference: 'REF-MAT-CARA-STD',
                    colorId: 'orange',
                    slotType: 'real_photo' as const,
                    assetUrl: '/images/tour360/real-photos/catalogue/cara_orange.jpg',
                    updatedAt: new Date().toISOString(),
                },
                'REF-MAT-CARA-STD_yellow_real_photo': {
                    productReference: 'REF-MAT-CARA-STD',
                    colorId: 'yellow',
                    slotType: 'real_photo' as const,
                    assetUrl: '/images/tour360/real-photos/catalogue/cara_yellow.jpg',
                    updatedAt: new Date().toISOString(),
                },
                'REF-MAT-CARA-STD_pink_real_photo': {
                    productReference: 'REF-MAT-CARA-STD',
                    colorId: 'pink',
                    slotType: 'real_photo' as const,
                    assetUrl: '/images/tour360/real-photos/catalogue/cara_pink.jpg',
                    updatedAt: new Date().toISOString(),
                },
                'REF-MAT-CARA-STD_mint_real_photo': {
                    productReference: 'REF-MAT-CARA-STD',
                    colorId: 'mint',
                    slotType: 'real_photo' as const,
                    assetUrl: '/images/tour360/real-photos/catalogue/cara_mint.jpg',
                    updatedAt: new Date().toISOString(),
                },
            },
            r7MediaMatrix: this.generateInitialR7Matrix(),
            mapConfig: {
                quickRoute: ['R1', 'R6', 'R7'],
                showVisitedBadge: true,
                defaultZoom: 1,
            },
        };
    }

    private generateInitialR7Matrix() {
        const roles = ['co-an', 'me-linh', 'be-may'];
        const steps = ['h0-greet', 'h1-table', 'h2-label', 'h3-ready', 'h4-transfer', 'h5-received'];
        const matrix: Record<string, any> = {};

        roles.forEach(role => {
            steps.forEach(step => {
                const key = `r7/${role}/${step}`;
                matrix[key] = {
                    roleId: role,
                    stepCode: step,
                    assetUrl: `/images/tour360/r7/${role}/${step}.webp`,
                    mediaDesktopUrl: `/images/tour360/r7/${role}/${step}.webp`,
                    mediaMobileUrl: `/images/tour360/r7/${role}/${step}.webp`,
                    mediaType: 'image',
                    status: 'available',
                    focalPoint: [50, 50],
                    actionBounds: { x: 30, y: 40, width: 40, height: 40 },
                    faceBounds: { x: 35, y: 15, width: 30, height: 25 },
                    description: `Minh họa góc nhìn ${role} - ${step}`,
                };
            });
        });

        return matrix;
    }

    /**
     * Returns the currently published configuration for public consumption.
     * Idempotent: If database has no revisions yet, creates initial published revision.
     */
    async getPublishedConfig() {
        try {
            const published = await this.revisionRepo.findOne({
                where: { status: SchoolExperienceStatus.PUBLISHED },
                order: { revision_number: 'DESC' },
            });

            if (published && published.config_data) {
                return {
                    revisionNumber: published.revision_number,
                    publishedAt: published.published_at || published.updated_at,
                    ...published.config_data,
                };
            }

            // Seed initial published revision if none exists
            const seedConfig = this.getDefaultConfig();
            const initialRev = this.revisionRepo.create({
                revision_number: 1,
                status: SchoolExperienceStatus.PUBLISHED,
                author: 'ERP4U System',
                changelog: 'Khởi tạo cấu hình mặc định (Instruction 10)',
                config_data: seedConfig,
                published_at: new Date(),
            });

            const saved = await this.revisionRepo.save(initialRev);
            return {
                revisionNumber: saved.revision_number,
                publishedAt: saved.published_at,
                ...saved.config_data,
            };
        } catch (err) {
            console.warn('[SchoolExperienceService] DB chưa sẵn sàng, trả về cấu hình seed tĩnh:', err.message);
            return {
                revisionNumber: 1,
                publishedAt: new Date().toISOString(),
                ...this.getDefaultConfig(),
            };
        }
    }

    /**
     * Admin: Retrieves the working DRAFT configuration
     */
    async getDraftConfig() {
        let draft = await this.revisionRepo.findOne({
            where: { status: SchoolExperienceStatus.DRAFT },
            order: { updated_at: 'DESC' },
        });

        if (!draft) {
            // Clone from latest published revision
            const published = await this.getPublishedConfig();
            const lastRevNumber = published.revisionNumber || 1;

            draft = this.revisionRepo.create({
                revision_number: lastRevNumber + 1,
                status: SchoolExperienceStatus.DRAFT,
                author: 'Admin',
                changelog: 'Bản nháp đang chỉnh sửa',
                config_data: published,
            });

            draft = await this.revisionRepo.save(draft);
        }

        return {
            id: draft.id,
            revisionNumber: draft.revision_number,
            updatedAt: draft.updated_at,
            author: draft.author,
            ...draft.config_data,
        };
    }

    /**
     * Admin: Saves working draft
     */
    async saveDraft(data: any, author: string = 'Admin') {
        let draft = await this.revisionRepo.findOne({
            where: { status: SchoolExperienceStatus.DRAFT },
        });

        if (!draft) {
            const published = await this.getPublishedConfig();
            draft = this.revisionRepo.create({
                revision_number: (published.revisionNumber || 1) + 1,
                status: SchoolExperienceStatus.DRAFT,
                author,
                changelog: 'Lưu bản nháp',
                config_data: { ...published, ...data },
            });
        } else {
            draft.author = author;
            draft.config_data = { ...draft.config_data, ...data };
        }

        const saved = await this.revisionRepo.save(draft);
        return {
            success: true,
            id: saved.id,
            revisionNumber: saved.revision_number,
            updatedAt: saved.updated_at,
            message: 'Đã lưu bản nháp thành công',
        };
    }

    /**
     * Admin: Publishes the draft atomically into a new revision
     */
    async publishDraft(author: string = 'Admin', changelog: string = 'Xuất bản thay đổi') {
        const draft = await this.revisionRepo.findOne({
            where: { status: SchoolExperienceStatus.DRAFT },
        });

        if (!draft || !draft.config_data) {
            throw new BadRequestException('Không có bản nháp nào để xuất bản');
        }

        // Integrity Check: If R7 is illustrated_sequence, verify that reachable slots are not missing
        if (draft.config_data.r7RenderMode === 'illustrated_sequence') {
            const matrix = draft.config_data.r7MediaMatrix || {};
            const missingSlots: string[] = [];
            Object.entries(matrix).forEach(([slotKey, slotData]: [string, any]) => {
                if (!slotData?.assetUrl || slotData?.status === 'missing') {
                    missingSlots.push(slotKey);
                }
            });

            if (missingSlots.length > 0) {
                throw new BadRequestException(
                    `Không thể xuất bản: Chuỗi minh họa R7 còn ${missingSlots.length} ô thiếu hình ảnh (${missingSlots.slice(0, 3).join(', ')}...)`
                );
            }

            // Mobile Crop Bounds Safety Check
            const invalidBoundsSlots: string[] = [];
            Object.entries(matrix).forEach(([slotKey, slotData]: [string, any]) => {
                if (slotData?.faceBounds) {
                    const { x, y, width, height } = slotData.faceBounds;
                    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 100 || y + height > 100) {
                        invalidBoundsSlots.push(`${slotKey} (vùng mặt vượt biên)`);
                    }
                }
                if (slotData?.actionBounds) {
                    const { x, y, width, height } = slotData.actionBounds;
                    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 100 || y + height > 100) {
                        invalidBoundsSlots.push(`${slotKey} (vùng hành động vượt biên)`);
                    }
                }
            });

            if (invalidBoundsSlots.length > 0) {
                throw new BadRequestException(
                    `Không thể xuất bản: Tọa độ vùng an toàn di động không hợp lệ tại: ${invalidBoundsSlots.slice(0, 3).join(', ')}`
                );
            }
        }

        // Archive previously published revision
        await this.revisionRepo.update(
            { status: SchoolExperienceStatus.PUBLISHED },
            { status: SchoolExperienceStatus.ARCHIVED },
        );

        // Mark draft as published
        draft.status = SchoolExperienceStatus.PUBLISHED;
        draft.published_at = new Date();
        draft.author = author;
        draft.changelog = changelog;
        const publishedRev = await this.revisionRepo.save(draft);

        // Create new working draft cloned from this state for future edits
        const nextDraft = this.revisionRepo.create({
            revision_number: publishedRev.revision_number + 1,
            status: SchoolExperienceStatus.DRAFT,
            author,
            changelog: 'Bản nháp kế tiếp',
            config_data: publishedRev.config_data,
        });
        await this.revisionRepo.save(nextDraft);

        return {
            success: true,
            revisionNumber: publishedRev.revision_number,
            publishedAt: publishedRev.published_at,
            message: `Xuất bản thành công Revision #${publishedRev.revision_number}`,
        };
    }

    /**
     * Admin: Lists all revision history
     */
    async getRevisions() {
        const list = await this.revisionRepo.find({
            select: ['id', 'revision_number', 'status', 'author', 'changelog', 'created_at', 'published_at'],
            order: { revision_number: 'DESC' },
            take: 30,
        });
        return list;
    }

    /**
     * Admin: Rolls back to a previous revision
     */
    async rollbackToRevision(revisionId: number, author: string = 'Admin') {
        const target = await this.revisionRepo.findOne({
            where: { id: revisionId },
        });

        if (!target) {
            throw new NotFoundException(`Không tìm thấy revision với ID ${revisionId}`);
        }

        // Archive active published
        await this.revisionRepo.update(
            { status: SchoolExperienceStatus.PUBLISHED },
            { status: SchoolExperienceStatus.ARCHIVED },
        );

        // Find highest revision number
        const latest = await this.revisionRepo.findOne({
            order: { revision_number: 'DESC' },
        });
        const nextNumber = (latest?.revision_number || 0) + 1;

        // Create new published revision with target's configuration
        const restored = this.revisionRepo.create({
            revision_number: nextNumber,
            status: SchoolExperienceStatus.PUBLISHED,
            author,
            changelog: `Khôi phục từ revision #${target.revision_number} (${target.changelog || 'Không có mô tả'})`,
            config_data: target.config_data,
            published_at: new Date(),
        });

        const saved = await this.revisionRepo.save(restored);

        // Also update working draft to match restored config
        await this.saveDraft(target.config_data, author);

        return {
            success: true,
            restoredRevisionNumber: saved.revision_number,
            originalRevisionNumber: target.revision_number,
            message: `Đã khôi phục về phiên bản #${target.revision_number} thành công`,
        };
    }
}

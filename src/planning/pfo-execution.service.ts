import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionFulfillmentOrder, PfoStatus } from './pfo.entity';
import { PfoMilestone, PfoMilestoneType, MilestoneStatus } from './pfo-milestone.entity';
import { PfoMaterialRequirement } from './pfo-material-requirement.entity';
import { PfoQcRecord, QcResult, QcStage } from './pfo-qc-record.entity';

@Injectable()
export class PfoExecutionService {
    constructor(
        @InjectRepository(ProductionFulfillmentOrder) private pfoRepo: Repository<ProductionFulfillmentOrder>,
        @InjectRepository(PfoMilestone) private milestoneRepo: Repository<PfoMilestone>,
        @InjectRepository(PfoMaterialRequirement) private reqRepo: Repository<PfoMaterialRequirement>,
        @InjectRepository(PfoQcRecord) private qcRepo: Repository<PfoQcRecord>
    ) { }

    /**
     * Gate 6: Kiểm soát Xuất kho NPL cho Nhà gia công
     */
    async updateMaterialIssue(reqId: number, issueQty: number) {
        const req = await this.reqRepo.findOne({ where: { id: reqId }, relations: ['pfo'] });
        if (!req) throw new NotFoundException('Yêu cầu vật tư không tồn tại');

        const newTotal = Number(req.issued_quantity) + issueQty;

        // Hard stop: Ngăn chặn cấp vượt định mức
        if (newTotal > req.planned_quantity) {
            // Có thể bỏ qua nếu có quyền Waive/Duyệt vượt định mức
            throw new BadRequestException('Số lượng xuất kho vượt quá định mức BOM. Yêu cầu phê duyệt đặc biệt.');
        }

        req.issued_quantity = newTotal;
        await this.reqRepo.save(req);

        // Check if all materials are issued to transition PFO to IN_PRODUCTION
        const allReqs = await this.reqRepo.find({ where: { pfo_id: req.pfo_id } });
        const allIssued = allReqs.every(r => r.issued_quantity >= r.planned_quantity);

        if (allIssued && req.pfo.status === PfoStatus.MATERIAL_PREP) {
            req.pfo.status = PfoStatus.IN_PRODUCTION;
            await this.pfoRepo.save(req.pfo);
        }

        // Tự động chốt (confirm) các booking tạm thời của đơn hàng liên quan khi KHSX bắt đầu xuất kho/sản xuất
        if (req.pfo.sales_order_id) {
            await this.reqRepo.manager.update('SalesOrderItem', 
                { order_id: req.pfo.sales_order_id, booking_status: 'TEMPORARY' }, 
                { booking_status: 'CONFIRMED', booking_expires_at: null }
            );
        }

        return req;
    }

    /**
     * Cập nhật tiến độ Milestone (Cắt, May, Đóng gói...)
     */
    async updateMilestone(pfoId: number, milestoneType: PfoMilestoneType, data: any) {
        let milestone = await this.milestoneRepo.findOne({
            where: { pfo_id: pfoId, milestone_type: milestoneType }
        });

        if (!milestone) {
            milestone = this.milestoneRepo.create({
                pfo_id: pfoId,
                milestone_type: milestoneType,
            });
        }

        milestone.status = data.status || milestone.status;
        milestone.completed_quantity = data.completed_quantity !== undefined ? data.completed_quantity : milestone.completed_quantity;
        milestone.actual_date = data.actual_date ? new Date(data.actual_date) : milestone.actual_date;
        milestone.evidence_photo_url = data.evidence_photo_url || milestone.evidence_photo_url;
        milestone.note = data.note || milestone.note;

        await this.milestoneRepo.save(milestone);
        return milestone;
    }

    /**
     * Gate 8, 9, 10: Ghi nhận kết quả QC
     */
    async submitQcRecord(pfoId: number, data: { stage: QcStage; result: QcResult; inspected: number; passed: number; rejected: number; defects?: any[] }) {
        const pfo = await this.pfoRepo.findOne({ where: { id: pfoId } });
        if (!pfo) throw new NotFoundException('PFO không tồn tại');

        const qcRecord = this.qcRepo.create({
            pfo_id: pfoId,
            qc_stage: data.stage,
            result: data.result,
            inspected_quantity: data.inspected,
            passed_quantity: data.passed,
            rejected_quantity: data.rejected,
            defects: data.defects
        });

        await this.qcRepo.save(qcRecord);

        // Check Hard Stops
        if (data.stage === QcStage.FINAL_INCOMING && data.result === QcResult.REJECT) {
            // Ngăn chặn nhập kho thành phẩm
            throw new BadRequestException('Lô hàng bị REJECT tại khâu Incoming QC. Không được phép nhập kho thành phẩm.');
        }

        if (data.stage === QcStage.FINAL_INCOMING && (data.result === QcResult.PASS || data.result === QcResult.CONDITIONAL_PASS)) {
            pfo.status = PfoStatus.RECEIVING;
            await this.pfoRepo.save(pfo);
        }

        return qcRecord;
    }
}

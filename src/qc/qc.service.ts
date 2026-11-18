import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityInspection, QCStatus, QCType } from './quality-inspection.entity';
import { QCDefectItem } from './qc-defect-item.entity';
import * as dayjs from 'dayjs';

@Injectable()
export class QCService {
  constructor(
    @InjectRepository(QualityInspection) private qcRepo: Repository<QualityInspection>,
    @InjectRepository(QCDefectItem) private defectRepo: Repository<QCDefectItem>,
  ) { }

  // --- CRUD ---

  async createInspection(data: any) {
    const qc = this.qcRepo.create({
      code: data.code || `QC-${dayjs().format('YYMMDD')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      type: data.type || QCType.OUTSOURCING,
      status: QCStatus.PENDING,
      po_id: data.po_id || null,
      supplier_id: data.supplier_id || null,
      pfo_id: data.pfo_id || null,
      total_quantity: Number(data.total_quantity || 0),
      inspected_quantity: 0,
      passed_quantity: 0,
      defect_quantity: 0,
      defect_rate: 0,
      inspector: data.inspector || null,
      inspection_date: data.inspection_date || dayjs().format('YYYY-MM-DD'),
      note: data.note || null
    });
    return this.qcRepo.save(qc);
  }

  async getAll(query?: { type?: string; status?: string; supplier_id?: number; po_id?: number }) {
    const where: any = {};
    if (query?.type) where.type = query.type;
    if (query?.status) where.status = query.status;
    if (query?.supplier_id) where.supplier_id = query.supplier_id;
    if (query?.po_id) where.po_id = query.po_id;

    return this.qcRepo.find({
      where,
      relations: ['supplier', 'purchase_order', 'defect_items'],
      order: { created_at: 'DESC' }
    });
  }

  async getDetail(id: number) {
    const qc = await this.qcRepo.findOne({
      where: { id },
      relations: ['supplier', 'purchase_order', 'defect_items']
    });
    if (!qc) throw new NotFoundException('Phiếu QC không tồn tại');
    return qc;
  }

  // --- INSPECTION WORKFLOW ---

  async startInspection(id: number) {
    const qc = await this.qcRepo.findOne({ where: { id } });
    if (!qc) throw new NotFoundException('Phiếu QC không tồn tại');
    if (qc.status !== QCStatus.PENDING) throw new BadRequestException('Phiếu đã bắt đầu kiểm tra');

    qc.status = QCStatus.IN_PROGRESS;
    qc.inspection_date = dayjs().format('YYYY-MM-DD');
    return this.qcRepo.save(qc);
  }

  async addDefect(inspectionId: number, data: any) {
    const qc = await this.qcRepo.findOne({ where: { id: inspectionId } });
    if (!qc) throw new NotFoundException('Phiếu QC không tồn tại');

    const defect = this.defectRepo.create({
      inspection_id: inspectionId,
      defect_type: data.defect_type,
      severity: data.severity || 'MINOR',
      quantity: Number(data.quantity || 1),
      description: data.description || null,
      image_url: data.image_url || null,
      action_taken: data.action_taken || null
    });
    const saved = await this.defectRepo.save(defect);

    // Recalculate totals
    await this.recalculate(inspectionId);
    return saved;
  }

  async removeDefect(defectId: number) {
    const defect = await this.defectRepo.findOne({ where: { id: defectId } });
    if (!defect) throw new NotFoundException();

    const inspectionId = defect.inspection_id;
    await this.defectRepo.delete(defectId);

    // Recalculate totals
    await this.recalculate(inspectionId);
    return { success: true };
  }

  // Hoàn thành kiểm tra
  async completeInspection(id: number, data: any) {
    const qc = await this.qcRepo.findOne({ where: { id }, relations: ['defect_items'] });
    if (!qc) throw new NotFoundException('Phiếu QC không tồn tại');

    qc.inspected_quantity = Number(data.inspected_quantity || qc.total_quantity);
    qc.passed_quantity = Number(data.passed_quantity || 0);
    qc.defect_quantity = (qc.defect_items || []).reduce((s, d) => s + Number(d.quantity), 0);
    qc.defect_rate = qc.inspected_quantity > 0
      ? Number(((qc.defect_quantity / qc.inspected_quantity) * 100).toFixed(2))
      : 0;
    qc.supplier_score = data.supplier_score || null;
    qc.corrective_action = data.corrective_action || null;
    qc.note = data.note || qc.note;
    if (data.completed_at) {
        qc.completed_at = new Date(data.completed_at);
    } else {
        qc.completed_at = new Date();
    }

    // Determine result
    if (qc.defect_rate <= 2) {
      qc.status = QCStatus.PASSED;
    } else if (qc.defect_rate <= 5) {
      qc.status = QCStatus.CONDITIONAL;
    } else {
      qc.status = QCStatus.FAILED;
    }

    // Override if manually set
    if (data.status) qc.status = data.status;

    return this.qcRepo.save(qc);
  }

  // --- ANALYTICS ---

  async getSupplierQualityReport(supplierId: number) {
    const inspections = await this.qcRepo.find({
      where: { supplier_id: supplierId },
      order: { created_at: 'DESC' }
    });

    const total = inspections.length;
    const passed = inspections.filter(i => i.status === QCStatus.PASSED).length;
    const conditional = inspections.filter(i => i.status === QCStatus.CONDITIONAL).length;
    const failed = inspections.filter(i => i.status === QCStatus.FAILED).length;
    const avgDefectRate = total > 0
      ? inspections.reduce((s, i) => s + Number(i.defect_rate), 0) / total
      : 0;
    const avgScore = inspections.filter(i => i.supplier_score)
      .reduce((s, i, _, a) => s + Number(i.supplier_score) / a.length, 0) || 0;

    return {
      supplier_id: supplierId,
      total_inspections: total,
      passed,
      conditional,
      failed,
      pass_rate: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0,
      avg_defect_rate: Number(avgDefectRate.toFixed(2)),
      avg_score: Number(avgScore.toFixed(1)),
      recent: inspections.slice(0, 10)
    };
  }

  async getQCSummary() {
    const all = await this.qcRepo.find({
      relations: ['supplier'],
      order: { created_at: 'DESC' }
    });

    // Group by supplier
    const supplierMap = new Map<number, any>();
    for (const qc of all) {
      if (!qc.supplier_id) continue;
      if (!supplierMap.has(qc.supplier_id)) {
        supplierMap.set(qc.supplier_id, {
          supplier_id: qc.supplier_id,
          supplier_name: qc.supplier?.name || 'Unknown',
          total: 0, passed: 0, failed: 0,
          total_defects: 0, total_inspected: 0
        });
      }
      const s = supplierMap.get(qc.supplier_id);
      s.total++;
      if (qc.status === QCStatus.PASSED) s.passed++;
      if (qc.status === QCStatus.FAILED) s.failed++;
      s.total_defects += Number(qc.defect_quantity);
      s.total_inspected += Number(qc.inspected_quantity);
    }

    return {
      total_inspections: all.length,
      pending: all.filter(i => i.status === QCStatus.PENDING).length,
      in_progress: all.filter(i => i.status === QCStatus.IN_PROGRESS).length,
      passed: all.filter(i => i.status === QCStatus.PASSED).length,
      failed: all.filter(i => i.status === QCStatus.FAILED).length,
      conditional: all.filter(i => i.status === QCStatus.CONDITIONAL).length,
      by_supplier: Array.from(supplierMap.values()),
      recent: all.slice(0, 20)
    };
  }

  // --- PRIVATE ---

  private async recalculate(inspectionId: number) {
    const defects = await this.defectRepo.find({ where: { inspection_id: inspectionId } });
    const totalDefects = defects.reduce((s, d) => s + Number(d.quantity), 0);

    const qc = await this.qcRepo.findOne({ where: { id: inspectionId } });
    if (qc) {
      qc.defect_quantity = totalDefects;
      qc.defect_rate = qc.inspected_quantity > 0
        ? Number(((totalDefects / qc.inspected_quantity) * 100).toFixed(2))
        : 0;
      await this.qcRepo.save(qc);
    }
  }

  async deleteInspection(id: number) {
    const qc = await this.qcRepo.findOne({ where: { id } });
    if (!qc) throw new NotFoundException();
    if (![QCStatus.PENDING, QCStatus.IN_PROGRESS].includes(qc.status)) {
      throw new BadRequestException('Chỉ xóa được phiếu chưa hoàn thành');
    }
    await this.qcRepo.delete(id);
    return { success: true };
  }
}

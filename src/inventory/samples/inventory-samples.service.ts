import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SampleTransaction, SampleTransactionStatus, SampleTransactionType } from './sample-transaction.entity';
import { SampleTransactionItem } from './sample-transaction-item.entity';
import { InventoryService } from '../inventory.service';
import { InventoryStock } from '../inventory-stock.entity';

@Injectable()
export class InventorySamplesService {
    constructor(
        @InjectRepository(SampleTransaction)
        private txRepo: Repository<SampleTransaction>,
        @InjectRepository(SampleTransactionItem)
        private itemRepo: Repository<SampleTransactionItem>,
        @InjectRepository(InventoryStock)
        private stockRepo: Repository<InventoryStock>,
        private inventoryService: InventoryService
    ) {}

    async createTransaction(data: {
        type: SampleTransactionType;
        reference_type?: string;
        reference_id?: number;
        customer_id?: number;
        deposit_amount?: number;
        note?: string;
        created_by?: string;
        receiver_name?: string;
        receiver_phone?: string;
        receiver_address?: string;
        items: { product_id: number; quantity: number; note?: string }[];
    }) {
        if (!data.items || data.items.length === 0) {
            throw new BadRequestException('Vui lòng chọn ít nhất 1 sản phẩm');
        }

        const prefix = data.type === SampleTransactionType.IMPORT ? 'NHM' : 'XHM';
        const code = `${prefix}-${Date.now().toString().slice(-6)}`;

        const tx = this.txRepo.create({
            code,
            type: data.type,
            reference_type: data.reference_type,
            reference_id: data.reference_id,
            customer_id: data.customer_id,
            deposit_amount: data.deposit_amount || 0,
            note: data.note,
            receiver_name: data.receiver_name,
            receiver_phone: data.receiver_phone,
            receiver_address: data.receiver_address,
            status: SampleTransactionStatus.DRAFT,
            created_by: data.created_by
        });

        await this.txRepo.save(tx);

        for (const item of data.items) {
            const txItem = this.itemRepo.create({
                transaction_id: tx.id,
                product_id: item.product_id,
                quantity: item.quantity,
                note: item.note
            });
            await this.itemRepo.save(txItem);
        }

        return this.getTransaction(tx.id);
    }

    async updateTransaction(id: number, data: {
        type?: SampleTransactionType;
        reference_type?: string;
        reference_id?: number;
        customer_id?: number;
        deposit_amount?: number;
        note?: string;
        receiver_name?: string;
        receiver_phone?: string;
        receiver_address?: string;
        items?: { product_id: number; quantity: number; note?: string }[];
    }) {
        const tx = await this.txRepo.findOne({ where: { id }, relations: ['items'] });
        if (!tx) throw new BadRequestException('Phiếu không tồn tại');
        if (tx.status !== SampleTransactionStatus.DRAFT) {
            throw new BadRequestException('Chỉ có thể sửa phiếu ở trạng thái Nháp (DRAFT)');
        }

        if (data.type !== undefined) tx.type = data.type;
        if (data.reference_type !== undefined) tx.reference_type = data.reference_type;
        if (data.reference_id !== undefined) tx.reference_id = data.reference_id;
        if (data.customer_id !== undefined) tx.customer_id = data.customer_id;
        if (data.deposit_amount !== undefined) tx.deposit_amount = data.deposit_amount;
        if (data.note !== undefined) tx.note = data.note;
        if (data.receiver_name !== undefined) tx.receiver_name = data.receiver_name;
        if (data.receiver_phone !== undefined) tx.receiver_phone = data.receiver_phone;
        if (data.receiver_address !== undefined) tx.receiver_address = data.receiver_address;

        await this.txRepo.save(tx);

        if (data.items) {
            if (data.items.length === 0) {
                throw new BadRequestException('Vui lòng chọn ít nhất 1 sản phẩm');
            }
            // Remove old items
            await this.itemRepo.delete({ transaction_id: id });
            
            // Add new items
            for (const item of data.items) {
                const txItem = this.itemRepo.create({
                    transaction_id: tx.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    note: item.note
                });
                await this.itemRepo.save(txItem);
            }
        }

        return this.getTransaction(tx.id);
    }

    async getTransactions() {
        return this.txRepo.find({
            relations: ['items', 'items.product', 'customer'],
            order: { created_at: 'DESC' }
        });
    }

    async getTransaction(id: number) {
        return this.txRepo.findOne({
            where: { id },
            relations: ['items', 'items.product', 'customer']
        });
    }

    async confirmTransaction(id: number) {
        const tx = await this.getTransaction(id);
        if (!tx) throw new BadRequestException('Phiếu không tồn tại');
        if (tx.status !== SampleTransactionStatus.DRAFT) throw new BadRequestException('Phiếu đã được xử lý');

        // Loop items and call adjustStock
        for (const item of tx.items) {
            await this.inventoryService.adjustStock(
                tx.type,
                'PRODUCT', // Samples are usually finished products
                item.product_id,
                item.quantity,
                tx.code,
                tx.note || `Phiếu hàng mẫu ${tx.code}`,
                'KHO_MAU'
            );
        }

        tx.status = SampleTransactionStatus.COMPLETED;
        await this.txRepo.save(tx);

        return { message: 'Xác nhận xử lý phiếu hàng mẫu thành công', transaction: tx };
    }

    async deleteTransaction(id: number) {
        const tx = await this.txRepo.findOne({ where: { id } });
        if (!tx) throw new BadRequestException('Phiếu không tồn tại');
        if (tx.status === SampleTransactionStatus.COMPLETED) {
            throw new BadRequestException('Không thể xóa phiếu đã hoàn thành');
        }
        await this.txRepo.delete(id);
        return { success: true, message: 'Đã xóa phiếu' };
    }

    async getSampleStocks() {
        // Find stock directly from InventoryStock filtered by KHO_MAU
        // Can join to Product to get details
        return this.stockRepo.find({
            where: { warehouse_code: 'KHO_MAU', item_type: 'PRODUCT' },
            relations: [] // Custom mapping needed usually or generic joins
        });
        // Wait, standard ERP4U stocks are pulled and then mapped by frontend. 
        // We will just return the raw stock Repo entries. The main getStocks API of inventory returns all.
        // Frontend can map it out or we can return a formatted list.
        // Returning raw is consistent with backend.
    }
}

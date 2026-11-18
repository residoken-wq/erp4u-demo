// Data for generic demo knowledge base triage (Công ty TNHH Sản xuất Mẫu)
export interface TriageItem {
  seed_key: string;
  original: string;
  answer?: string;
}

export const KB_V2_CONFLICT_TRIAGE: {
  retire: TriageItem[];
  rewrite: TriageItem[];
  resolve: { code: string; resolution: string }[];
} = {
  retire: [
    {
      seed_key: 'kb2.demo.retire.1',
      original: 'Quy cách cũ cho sản phẩm mẫu đã ngừng sản xuất.',
    },
    {
      seed_key: 'kb2.demo.retire.2',
      original: 'Bảng giá cũ áp dụng trước năm 2026.',
    },
    {
      seed_key: 'kb2.demo.retire.3',
      original: 'Chính sách hỗ trợ vận chuyển cũ đã hết hiệu lực.',
    },
  ],
  rewrite: [
    {
      seed_key: 'kb2.price.standard',
      original: 'Báo giá sản phẩm mẫu tiêu chuẩn.',
      answer: 'Dạ sản phẩm Mẫu A có mức giá tham khảo từ 100.000 VNĐ - 250.000 VNĐ (DEMO) tùy số lượng và quy cách gia công ạ.',
    },
    {
      seed_key: 'kb2.product.material',
      original: 'Quy cách vật liệu sản phẩm mẫu.',
      answer: 'Dạ sản phẩm mẫu được sản xuất từ nguyên vật liệu tiêu chuẩn công nghiệp, bề mặt xử lý chống bám bẩn và độ bền cao ạ.',
    },
    {
      seed_key: 'kb2.service.custom_logo',
      original: 'Dịch vụ in nhãn thương hiệu theo yêu cầu.',
      answer: 'Dạ công ty nhận in tem nhãn thương hiệu đối tác cho đơn hàng từ 50 sản phẩm, chi phí dự kiến từ 10.000 - 15.000 VNĐ/sản phẩm (DEMO) ạ.',
    },
    {
      seed_key: 'kb2.leadtime.standard',
      original: 'Thời gian gia công đơn hàng tiêu chuẩn.',
      answer: 'Dạ thời gian sản xuất tiêu chuẩn cho đơn hàng mẫu là 7-10 ngày làm việc. Với đơn hàng gấp, nhân viên kinh doanh sẽ hỗ trợ phương án phù hợp ạ.',
    },
    {
      seed_key: 'kb2.policy.warranty_return',
      original: 'Chính sách đổi trả bảo hành sản phẩm mẫu.',
      answer: 'Dạ Công ty TNHH Sản xuất Mẫu bảo hành kỹ thuật 12 tháng và hỗ trợ đổi trả sản phẩm trong 7 ngày nếu lỗi do sản xuất ạ.',
    },
    {
      seed_key: 'kb2.order.moq',
      original: 'Số lượng đặt hàng tối thiểu cho đơn mẫu.',
      answer: 'Dạ số lượng đặt hàng tối thiểu (MOQ) cho sản phẩm mẫu tiêu chuẩn là 30 sản phẩm; đối với quy cách riêng là 50 sản phẩm ạ.',
    },
  ],
  resolve: [
    {
      code: 'D01',
      resolution: 'Áp dụng bảng giá đại lý phân phối theo chính sách kinh doanh năm 2026.',
    },
    {
      code: 'D02',
      resolution: 'Chiết khấu số lượng lớn >500 sản phẩm do Giám đốc kinh doanh trực tiếp phê duyệt.',
    },
    {
      code: 'D03',
      resolution: 'Dung sai kích thước sau gia công cho phép ±1cm theo tiêu chuẩn kỹ thuật.',
    },
  ],
};

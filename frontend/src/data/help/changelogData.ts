import { ChangelogItem } from './types';

export const CHANGELOG_DATA: ChangelogItem[] = [
    {
        id: 'release-2026-09-dntt',
        date: '17/09/2026',
        title: 'Bản Cập Nhật: Bổ Sung In Mẫu Đề Nghị Thanh Toán (DNTT) & Cẩm Nang SO Detail Toàn Diện',
        tag: 'Phiên bản 2.6.5',
        tagColor: 'blue',
        isLatest: true,
        modules: [
            {
                name: 'In Mẫu Đề Nghị Thanh Toán (Sales Payments)',
                tag: 'Tính năng Mới 📄',
                highlights: [
                    'Bổ sung chức năng In Giấy Đề Nghị Thanh Toán (DNTT) tại Tab 3. Thanh toán trong SO Detail.',
                    'Mẫu 1 (DNTT PDF): Tích hợp con dấu tròn đỏ và chữ ký số Giám đốc (Phạm Thu Hằng), tự động dịch số tiền thành chữ tiếng Việt, tải/lưu file PDF gửi khách hàng trực tuyến.',
                    'Mẫu 2 (In DNTT): Mẫu sạch không mộc và không chữ ký, hiển thị họ tên Giám đốc và Nhân viên đề nghị để in ký sống.',
                    'Hỗ trợ in trực tiếp từ bảng lịch sử thanh toán hoặc ngay trong modal tạo đợt thu.'
                ],
                deepLink: {
                    label: 'Xem trong Đơn Hàng',
                    path: '/orders'
                }
            },
            {
                name: 'Cẩm Nang SO Detail & Trợ Lý HelpPage',
                tag: 'Tài liệu Mới 📚',
                highlights: [
                    'Bổ sung tài liệu chuyên sâu hướng dẫn toàn bộ 9 Tab của SO Detail.',
                    'Hướng dẫn chi tiết chức năng từng nút thao tác: Lưu, Hủy đơn, Tạo dự án, Giữ kho Book, Gửi ZNS, Copy báo giá, Tạo version...',
                    'Thêm cẩm nang quy trình lập và in Giấy đề nghị thanh toán chuẩn cho Sales và Kế toán.'
                ],
                deepLink: {
                    label: 'Xem Hướng Dẫn HelpPage',
                    path: '/help'
                }
            }
        ]
    },
    {
        id: 'release-2026-09',
        date: '14/09/2026',
        title: 'Bản Cập Nhật Lớn: Phân Hệ Thiết Kế In Ấn, Sơ Đồ 2D Nesting & Trung Tâm Tri Thức',
        tag: 'Phiên bản 2.6.0',
        tagColor: 'green',
        isLatest: false,
        modules: [
            {
                name: 'Quản Lý Thiết Kế In Ấn & Thêu (Design Management)',
                tag: 'Phân hệ Mới 🎨',
                highlights: [
                    'Quản lý hồ sơ thiết kế riêng biệt (/designs): Hỗ trợ file gốc Vector (AI, CDR, SVG, PDF) và ảnh Mockup preview.',
                    'Phân loại công nghệ in thêu: In lụa, In nhiệt (Decal), In Kỹ Thuật Số (DTG), Thêu vi tính.',
                    'Quy trình duyệt market: Tạo link portal cho khách hàng duyệt mẫu online, ghi chú trực tiếp lên mockup.',
                    'Liên kết trực tiếp với Đơn Hàng (SO) và Lệnh Sản Xuất (PO Gia Công).'
                ],
                deepLink: {
                    label: 'Trải nghiệm Thiết Kế ngay',
                    path: '/designs'
                }
            },
            {
                name: 'Công Cụ Xếp Sơ Đồ Cắt 2D Nesting (MRP Nesting)',
                tag: 'Nâng cấp Sản Xuất ⚙️',
                highlights: [
                    'Giao diện trực quan Canvas 2D: Bố trí các chi tiết rập vải tối ưu theo khổ vải hữu dụng.',
                    'Thao tác linh hoạt: Kéo thả, xoay lật góc 90°/180°, tự động cảnh báo chi tiết chạm viền hoặc đè lên nhau.',
                    'Tính toán tỉ lệ hao hụt và diện tích vải sử dụng thời gian thực.',
                    'Nút "Xuất Ảnh Sơ Đồ" phân giải cao lưu file PNG đính kèm vào PO gia công cắt cho xưởng.'
                ],
                deepLink: {
                    label: 'Xem trong Lập Kế Hoạch',
                    path: '/planning'
                }
            },
            {
                name: 'Báo Cáo Gia Công In (Print Report Dashboard)',
                tag: 'Phân hệ Mới 🖨️',
                highlights: [
                    'Theo dõi sản lượng in ấn theo từng bàn in, máy in và thợ in.',
                    'Thống kê số lượng hoàn thành, tỉ lệ lỗi/hỏng vải trong quá trình in.',
                    'Báo cáo hiệu suất theo ngày, ca làm việc và nhà gia công in.'
                ],
                deepLink: {
                    label: 'Mở Báo Cáo In',
                    path: '/print-production'
                }
            },
            {
                name: 'Kiểm Tra Chất Lượng (Quality Control - QC)',
                tag: 'Phân hệ Mới 🔬',
                highlights: [
                    'Lập biên bản kiểm định chất lượng cho NPL đầu vào và thành phẩm xuất xưởng.',
                    'Đo lường tỉ lệ đạt chuẩn (Pass Rate) và ghi nhận lý do phế phẩm chi tiết.',
                    'Phê duyệt nhập kho thành phẩm sau khi hoàn thành biên bản QC.'
                ],
                deepLink: {
                    label: 'Mở Phân Hệ QC',
                    path: '/qc'
                }
            },
            {
                name: 'Bán Lẻ POS & Quản Lý Khuyến Mãi',
                tag: 'Cải tiến Bán Hàng 🛒',
                highlights: [
                    'Giao diện bán hàng POS cảm ứng mượt mà, hỗ trợ quét mã vạch và in bill nhiệt 80mm.',
                    'Cấu hình chương trình khuyến mãi linh hoạt: Giảm giá theo đơn, tặng kèm quà, chiết khấu theo nhóm khách.'
                ],
                deepLink: {
                    label: 'Mở Bán Lẻ POS',
                    path: '/pos'
                }
            },
            {
                name: 'Tự Động Hạch Toán Lợi Nhuận Đơn Hàng (SO Profit)',
                tag: 'Kế Toán & Tài Chính 💰',
                highlights: [
                    'Tự động sinh chi phí và phân bổ vào SO khi xuất NPL (GOODS_ISSUE_NPL) cho sản xuất.',
                    'Ghi nhận giá vốn hàng bán chính xác (GOODS_ISSUE_PRODUCT) khi giao hàng.',
                    'Báo cáo lãi/lỗ thời gian thực của từng đơn hàng kể cả khi sử dụng hàng có sẵn trong kho.'
                ],
                deepLink: {
                    label: 'Xem Báo Cáo Tài Chính',
                    path: '/finance'
                }
            }
        ]
    },
    {
        id: 'release-2026-04',
        date: '14/04/2026',
        title: 'Nâng Cấp Contract Builder, Tích Hợp EasyInvoice & Lập Kế Hoạch (MRP)',
        tag: 'Phiên bản 2.5.0',
        tagColor: 'blue',
        modules: [
            {
                name: 'Hóa Đơn Điện Tử EasyInvoice',
                highlights: [
                    'Đồng bộ hóa đơn nháp một chạm trực tiếp từ chi tiết đơn hàng (SO).',
                    'Kiểm tra tự động mã số thuế, tên pháp nhân từ cơ sở dữ liệu Tổng Cục Thuế.',
                    'Tải bản PDF xem trước gửi khách và đồng bộ trạng thái phát hành sau khi ký số.'
                ],
                deepLink: {
                    label: 'Xem Hóa Đơn SO',
                    path: '/orders'
                }
            },
            {
                name: 'Soạn Thảo Hợp Đồng (Contract Builder)',
                highlights: [
                    'Bổ sung các trường TextBox biến tự soạn (text_content) linh hoạt trong biểu mẫu.',
                    'Auto-fill 10 thông số của Bên Bán (seller_xxx) trực tiếp từ Cấu hình Doanh nghiệp.',
                    'Nhóm màu sắc cho hệ thống biến giúp dễ dàng thiết kế mẫu hợp đồng.'
                ]
            },
            {
                name: 'Lập Kế Hoạch Sản Xuất MRP V2',
                highlights: [
                    'Tự động gom nhiều SO để phân tích định mức NPL và năng lực sản xuất tập trung.',
                    'Tự động sinh PO Mua NPL và PO Gia Công ngoài.'
                ]
            }
        ]
    },
    {
        id: 'release-2026-02',
        date: '28/02/2026',
        title: 'Nâng Cấp Quản Lý Dự Án, Tiến Độ Gantt Chart & Thông Báo Thông Minh',
        tag: 'Phiên bản 2.4.0',
        tagColor: 'purple',
        modules: [
            {
                name: 'Quản Lý Dự Án & Tasks',
                highlights: [
                    'Hỗ trợ chế độ xem Gantt Chart trực quan cho Milestone và Tasks trong chi tiết dự án.',
                    'Gán Milestone khi tạo/sửa Task, theo dõi tiến độ tổng thể của dự án theo phần trăm.'
                ],
                deepLink: {
                    label: 'Mở Quản Lý Dự Án',
                    path: '/projects'
                }
            },
            {
                name: 'Thông Báo (Notifications) Deep-Link',
                highlights: [
                    'Click vào thông báo sẽ tự động chuyển trang và tự mở sẵn Modal dữ liệu tương ứng.'
                ]
            }
        ]
    },
    {
        id: 'release-2026-01',
        date: '04/01/2026',
        title: 'Cập Nhật CRM Chăm Sóc Lead, Trợ Lý AI Gợi Ý Trả Lời & Check List SO',
        tag: 'Phiên bản 2.3.0',
        tagColor: 'cyan',
        modules: [
            {
                name: 'Chăm Sóc Lead & Bán Hàng',
                highlights: [
                    'Thêm Tab "Chăm sóc Lead" trong modal Khách hàng, tổng hợp bình luận từ tất cả đơn hàng.',
                    'Nút "Gợi ý AI" tự động soạn câu trả lời chăm sóc dựa trên sản phẩm và lịch sử tương tác.',
                    'Checklist công việc theo từng giai đoạn trong chi tiết đơn hàng bán.'
                ],
                deepLink: {
                    label: 'Mở Bán Hàng CRM',
                    path: '/sales'
                }
            },
            {
                name: 'Mã Khách Hàng Tự Động',
                highlights: [
                    'Mã khách hàng tự động sinh theo chuẩn KH-YYMM-XXXX.'
                ]
            }
        ]
    }
];

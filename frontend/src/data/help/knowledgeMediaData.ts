import { KnowledgeVideoItem } from './types';

export const KNOWLEDGE_MEDIA_LIST: KnowledgeVideoItem[] = [
    {
        id: 'video-easyinvoice',
        title: 'Hướng dẫn Phát hành Hóa đơn Điện tử EasyInvoice từ Đơn hàng SO',
        category: 'SALES',
        categoryName: 'Bán Hàng & Kế Toán',
        description: 'Video hướng dẫn chi tiết quy trình 5 bước: Kiểm tra mã số thuế, tạo hóa đơn nháp, kiểm tra bản xem trước PDF và đồng bộ trạng thái phát hành về ERP4U.',
        youtubeId: '3mYFm-q5a_k', // YouTube ID demo / embed
        videoUrl: 'https://www.youtube.com/embed/3mYFm-q5a_k',
        duration: '04:25',
        thumbnailUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        level: 'Cơ bản',
        badge: 'Phổ biến nhất 🔥',
        keySteps: [
            'Kiểm tra thông tin pháp nhân (Tên cty, MST, địa chỉ) tại tab Hợp đồng & Hóa đơn',
            'Nhấn nút "Tạo Hóa Đơn Nháp" để gọi API đồng bộ sang EasyInvoice',
            'Xem trước bản PDF nháp và gửi link cho khách hàng xác nhận',
            'Ký số bằng USB Token trên cổng EasyInvoice',
            'Cập nhật trạng thái "Đã phát hành" và gửi email cho khách từ ERP'
        ],
        deepLink: {
            label: 'Mở danh sách Đơn Hàng (SO)',
            path: '/orders'
        },
        topicId: 'sales-easyinvoice'
    },
    {
        id: 'video-mrp-nesting',
        title: 'Công cụ Xếp Sơ Đồ Cắt 2D Nesting - Tối ưu Định Mức Vải',
        category: 'PRODUCTION',
        categoryName: 'Sản Xuất & MRP',
        description: 'Thao tác trực quan trên Canvas xếp rập: Bố trí chi tiết thân áo, tay áo, cổ áo vào khổ vải; xoay lật góc 90°/180°, tính tỉ lệ lãng phí và xuất sơ đồ ảnh HD.',
        youtubeId: 'p7ZkQ8Q5n0M',
        videoUrl: 'https://www.youtube.com/embed/p7ZkQ8Q5n0M',
        duration: '06:10',
        thumbnailUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=80',
        level: 'Nâng cao',
        badge: 'Mới cập nhật 🚀',
        keySteps: [
            'Khai báo khổ vải hữu dụng (Ví dụ: Khổ 1m60)',
            'Tải danh sách chi tiết rập từ Lệnh sản xuất',
            'Sử dụng công cụ Tự động xếp (Auto Nesting) sơ bộ',
            'Kéo thả và xoay góc thủ công để đạt độ khít tối ưu',
            'Nhấn "Xuất Ảnh Sơ Đồ" để lưu file PNG đính kèm PO gia công cắt'
        ],
        deepLink: {
            label: 'Mở Lập Kế Hoạch (MRP)',
            path: '/planning'
        },
        topicId: 'mrp-nesting'
    },
    {
        id: 'video-designs-workflow',
        title: 'Quy trình Quản lý Thiết kế In ấn & Thêu từ Báo giá đến Sản xuất',
        category: 'DESIGN',
        categoryName: 'Thiết Kế & Sáng Tạo',
        description: 'Hướng dẫn Designer và Sales tải file vector (AI, CDR, PDF), quản lý phiên bản mockup, lấy ý kiến phản hồi và chia sẻ link duyệt mẫu trực tuyến cho khách hàng.',
        youtubeId: 'kJQP7kiw5Fk',
        videoUrl: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
        duration: '05:40',
        thumbnailUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&auto=format&fit=crop&q=80',
        level: 'Trung cấp',
        badge: 'Mới ra mắt ✨',
        keySteps: [
            'Tạo hồ sơ thiết kế mới và liên kết với Khách hàng / SO',
            'Upload file gốc (Vector) và ảnh preview Mockup',
            'Gắn thẻ công nghệ in ấn: In lụa, In nhiệt (Decal), In DTG, Thêu vi tính',
            'Tạo link portal duyệt mẫu gửi khách hàng',
            'Sau khi khách ký duyệt, chuyển trạng thái "Sẵn sàng sản xuất"'
        ],
        deepLink: {
            label: 'Vào Module Thiết Kế',
            path: '/designs'
        },
        topicId: 'designs-guide'
    },
    {
        id: 'video-sales-order-create',
        title: 'Tạo Báo Giá & Đơn Hàng Chuẩn Cho Khách Hàng Doanh Nghiệp',
        category: 'SALES',
        categoryName: 'Bán Hàng & CRM',
        description: 'Toàn bộ quy trình lên báo giá cho khách sỉ: Tìm kiếm khách hàng, chọn mẫu mã, tùy biến quy cách sản phẩm linh hoạt (không cần tạo SKU mới) và xuất PDF báo giá.',
        youtubeId: '9bZkp7q19f0',
        videoUrl: 'https://www.youtube.com/embed/9bZkp7q19f0',
        duration: '07:15',
        thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
        level: 'Cơ bản',
        badge: 'Cần thiết ⭐',
        keySteps: [
            'Tìm kiếm khách hàng bằng Tên hoặc Số điện thoại',
            'Thêm danh mục sản phẩm hoặc bộ combo',
            'Tùy biến tên hiển thị VAT và đơn giá bán thỏa thuận',
            'Đính kèm ảnh mẫu thực tế cho từng dòng đơn hàng',
            'Lưu đơn và gửi link Portal theo dõi tiến độ cho khách'
        ],
        deepLink: {
            label: 'Tạo Đơn Hàng Bán',
            path: '/sales'
        },
        topicId: 'sales-create'
    },
    {
        id: 'video-mrp-planning',
        title: 'Lập Kế Hoạch Sản Xuất (MRP) & Tự Động Sinh PO Đặt Hàng',
        category: 'PRODUCTION',
        categoryName: 'Sản Xuất & MRP',
        description: 'Cách gom nhiều đơn hàng để chạy phân tích MRP tập trung, bóc tách định mức BOM, kiểm tra tồn kho sẵn có và tự động sinh PO mua NPL & PO gia công ngoài.',
        youtubeId: 'dQw4w9WgXcQ',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: '08:30',
        thumbnailUrl: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&auto=format&fit=crop&q=80',
        level: 'Nâng cao',
        badge: 'Cốt lõi ERP 🔥',
        keySteps: [
            'Chọn các đơn hàng SO đã duyệt để đưa vào đợt kế hoạch',
            'Hệ thống tự động tính toán nhu cầu nguyên vật liệu theo BOM',
            'Kiểm tra trừ tồn kho tại nhà máy và tồn kho gửi tại xưởng gia công',
            'Rà soát bảng khuyến nghị Cần Mua NPL và Cần Gia Công',
            'Nhấn nút "Tạo PO Tập Trung" để chuyển dữ liệu sang bộ phận Mua hàng'
        ],
        deepLink: {
            label: 'Mở Kế Hoạch Sản Xuất',
            path: '/planning'
        },
        topicId: 'mrp-guide'
    },
    {
        id: 'video-finance-so-profit',
        title: 'Theo Dõi Lợi Nhuận Đơn Hàng (SO Profit) & Hạch Toán Chi Phí Tự Động',
        category: 'FINANCE',
        categoryName: 'Tài Chính & Kế Toán',
        description: 'Giải thích cơ chế hệ thống tự động ghi nhận chi phí xuất NPL (GOODS_ISSUE_NPL) và giá vốn thành phẩm vào báo cáo lãi/lỗ của từng đơn hàng cụ thể.',
        youtubeId: 'kJQP7kiw5Fk',
        videoUrl: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
        duration: '05:00',
        thumbnailUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80',
        level: 'Trung cấp',
        badge: 'Quan trọng 💡',
        keySteps: [
            'Xuất NPL từ kho cho lệnh sản xuất -> Hệ thống tự phân bổ chi phí vào SO',
            'Xuất kho giao thành phẩm cho khách -> Hệ thống tự tính COGS',
            'Kế toán mở tab "Lợi Nhuận SO" trong đơn hàng để xem doanh thu và chi phí thực',
            'Xem chi tiết bảng phân bổ chi phí NPL dùng chung cho nhiều đơn'
        ],
        deepLink: {
            label: 'Mở Quản Lý Tài Chính',
            path: '/finance'
        },
        topicId: 'finance-so-profit'
    },
    {
        id: 'video-inventory-conversion',
        title: 'Quản Lý Kho Đa Đơn Vị Tính & Quy Đổi Định Mức (Unit Conversion)',
        category: 'INVENTORY',
        categoryName: 'Kho Vận & Nhà Cung Cấp',
        description: 'Hướng dẫn thiết lập hệ số quy đổi đơn vị mua hàng (Cây vải, Bao gòn, Thùng) sang đơn vị cơ sở sản xuất (Mét, Kilogram, Cái) và theo dõi thẻ kho thời gian thực.',
        youtubeId: '3mYFm-q5a_k',
        videoUrl: 'https://www.youtube.com/embed/3mYFm-q5a_k',
        duration: '04:50',
        thumbnailUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
        level: 'Cơ bản',
        badge: 'Hướng dẫn kho 📦',
        keySteps: [
            'Khai báo Đơn vị cơ sở (Base Unit) là đơn vị nhỏ nhất trong định mức',
            'Khai báo Đơn vị mua hàng và Hệ số quy đổi (Conversion Factor)',
            'Khi tạo phiếu nhập kho (GRN), nhập số lượng theo Đơn vị mua hàng',
            'Hệ thống tự động quy đổi và tăng tồn kho chính xác theo Đơn vị cơ sở'
        ],
        deepLink: {
            label: 'Mở Danh Sách Nguyên Liệu',
            path: '/materials'
        },
        topicId: 'inventory-guide'
    },
    {
        id: 'video-hr-attendance',
        title: 'Chấm Công Định Vị, Xin Nghỉ Phép & Tra Cứu Phiếu Lương Cá Nhân',
        category: 'HR',
        categoryName: 'Nhân Sự & Vận Hành',
        description: 'Dành cho toàn bộ nhân viên: Hướng dẫn chấm công vào/ra ca trên điện thoại, tạo đơn xin nghỉ phép, theo dõi số ngày phép còn lại và xem bảng lương bảo mật.',
        youtubeId: 'p7ZkQ8Q5n0M',
        videoUrl: 'https://www.youtube.com/embed/p7ZkQ8Q5n0M',
        duration: '03:45',
        thumbnailUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&auto=format&fit=crop&q=80',
        level: 'Cơ bản',
        badge: 'Toàn bộ nhân viên 👥',
        keySteps: [
            'Mở phân hệ Nhân sự (HR) trên máy tính hoặc điện thoại',
            'Bấm "Chấm Công Vào Ca" (Hệ thống xác thực tọa độ GPS hoặc IP văn phòng)',
            'Gửi đơn xin nghỉ phép kèm lý do và người bàn giao công việc',
            'Xem lịch sử chấm công và chi tiết phiếu lương cuối tháng'
        ],
        deepLink: {
            label: 'Vào Phân Hệ Nhân Sự',
            path: '/hr'
        },
        topicId: 'hr-overview'
    }
];

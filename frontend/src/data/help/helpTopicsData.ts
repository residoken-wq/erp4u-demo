import { HelpTopic } from './types';

export const HELP_TOPICS: HelpTopic[] = [
    // ----------------------------------------------------
    // GIỚI THIỆU CHUNG
    // ----------------------------------------------------
    {
        id: 'intro',
        title: 'Tổng Quan Hệ Thống & Luồng Vận Hành Khép Kín (Overall Workflow)',
        category: 'ALL',
        categoryName: 'Tổng Quan',
        tags: ['Bắt đầu', 'SOP', 'Tổng quan', 'Luồng dữ liệu'],
        summary: 'Giới thiệu kiến trúc vận hành xuyên suốt của ERP4U từ giai đoạn tiếp nhận Lead, tạo Báo giá, phân tích MRP, Mua hàng, Sản xuất đến Giao hàng và Kế toán.',
        estimatedReadTime: '4 phút',
        updatedAt: '14/09/2026',
        isFeatured: true,
        steps: [
            {
                title: '1. Kinh Doanh (Sales CRM)',
                description: 'Tiếp nhận yêu cầu từ thị trường -> Tạo Báo giá (Quote) -> Khách hàng chốt đơn -> Chuyển thành Đơn hàng bán (Sales Order - SO).',
                tip: 'Có thể tùy biến đơn giá và upload ảnh mẫu trực tiếp mà không cần sinh SKU mới.'
            },
            {
                title: '2. Kế Hoạch Sản Xuất (Planning & MRP)',
                description: 'Tổng hợp các SO đã chốt -> Chạy phân tích MRP -> Bóc tách Định mức (BOM), đối chiếu Tồn kho thực tế -> Xác định nhu cầu Nguyên phụ liệu (NPL) & Gia công ngoài.',
                tip: 'Hệ thống tự động tính cả tồn kho gửi tại xưởng gia công ngoài.'
            },
            {
                title: '3. Mua Hàng & Gia Công (Purchasing)',
                description: 'Tạo Đơn mua hàng (PO NPL) từ yêu cầu của bộ phận Kế hoạch -> Gửi cho Nhà cung cấp; Tạo PO Gia công giao xưởng.',
                warning: 'Cần kiểm tra kỹ giá thỏa thuận và thời hạn giao hàng cam kết.'
            },
            {
                title: '4. Kho Vận (Inventory)',
                description: 'Nhập kho NPL (GRN) theo đơn vị mua hàng (hệ thống tự quy đổi) -> Soạn hàng & Xuất kho NPL cho Xưởng sản xuất hoặc xuất Thành phẩm giao khách.',
                tip: 'Hệ thống hỗ trợ kiểm tra tồn kho Live tại xưởng đối tác.'
            },
            {
                title: '5. Sản Xuất & Gia Công (Production & Print)',
                description: 'Nhận NPL -> Thực hiện công đoạn (Cắt, In lụa/In nhiệt, Thêu, May, Ủi, Đóng gói) -> Kiểm tra chất lượng QC -> Nhập kho Thành phẩm.',
                tip: 'Sử dụng công cụ 2D Nesting để tối ưu sơ đồ cắt rập vải.'
            },
            {
                title: '6. Giao Hàng (Logistics)',
                description: 'Đóng gói thành phẩm -> In phiếu giao hàng (Delivery Note) -> Bàn giao cho đối tác vận chuyển hoặc giao trực tiếp cho khách.',
            },
            {
                title: '7. Tài Chính & Kế Toán (Finance)',
                description: 'Xuất hóa đơn điện tử EasyInvoice -> Tự động hạch toán chi phí xuất kho vào Lợi nhuận đơn hàng (SO Profit) -> Theo dõi công nợ -> Thu tiền (Payment).',
                tip: 'Hệ thống tự ghi nhận credit dư tiền nếu khách chuyển khoản thừa.'
            }
        ]
    },

    // ----------------------------------------------------
    // PHÂN HỆ THIẾT KẾ (MỚI)
    // ----------------------------------------------------
    {
        id: 'designs-guide',
        title: 'Quản Lý Thiết Kế In Ấn & Thêu (Design Management Workflow)',
        category: 'DESIGN',
        categoryName: 'Thiết Kế & Sáng Tạo',
        tags: ['Thiết kế', 'In ấn', 'Thêu', 'Mockup', 'Duyệt mẫu', 'Mới'],
        summary: 'Quy trình toàn diện từ khi tiếp nhận file mẫu, phân loại công nghệ in thêu, upload file vector gốc, chia sẻ link portal cho khách duyệt đến kết nối Lệnh sản xuất.',
        estimatedReadTime: '5 phút',
        updatedAt: '14/09/2026',
        isNew: true,
        isFeatured: true,
        youtubeId: 'kJQP7kiw5Fk',
        videoUrl: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
        deepLink: {
            label: 'Mở Quản Lý Thiết Kế',
            path: '/designs'
        },
        steps: [
            {
                title: 'Bước 1: Khởi tạo Hồ sơ Thiết kế',
                description: 'Tại menu Sản xuất (MRP) -> Thiết kế In ấn & Thêu (/designs), nhấn nút "Thêm Thiết Kế". Nhập mã thiết kế, tên mẫu, và liên kết với Khách hàng hoặc Đơn hàng SO tương ứng.',
                tip: 'Nên đặt tên gợi nhớ theo định dạng: [Tên KH] - [Tên Sản Phẩm] - [Vị trí in/thêu].'
            },
            {
                title: 'Bước 2: Phân loại Công nghệ Gia công',
                description: 'Chọn công nghệ áp dụng: In lụa (Screen Print), In chuyển nhiệt (Decal), In kỹ thuật số (DTG) hoặc Thêu vi tính. Nhập kích thước vùng in thực tế (VD: 25cm x 30cm) và số lượng màu.',
            },
            {
                title: 'Bước 3: Tải lên File Gốc & Mockup Preview',
                description: 'Upload file vector gốc độ nét cao (hỗ trợ .AI, .CDR, .EPS, .PDF, .SVG) để chuyển xưởng in. Đồng thời tải lên file ảnh Mockup 3D trực quan (.PNG, .JPG) mô phỏng vị trí in trên áo/sản phẩm.',
                warning: 'File vector cần convert font chữ thành outline để tránh lỗi mất font khi mở máy xưởng.'
            },
            {
                title: 'Bước 4: Gửi Link Duyệt Mẫu cho Khách Hàng',
                description: 'Nhấn nút "Tạo Link Portal". Hệ thống sinh link duyệt trực tuyến an toàn. Khách hàng có thể mở link trên điện thoại, phóng to kiểm tra market, gõ phản hồi hoặc ký duyệt số.',
                tip: 'Trạng thái sẽ tự động đổi sang "APPROVED" ngay khi khách nhấn Duyệt.'
            },
            {
                title: 'Bước 5: Chuyển Sang Sản Xuất',
                description: 'Khi mẫu đã duyệt, hồ sơ thiết kế được khóa lại. Bộ phận Kế hoạch (Planning) và Báo cáo Gia công In (/print-production) có thể trích xuất trực tiếp file gốc và thông số để vận hành.',
            }
        ]
    },

    // ----------------------------------------------------
    // PHÂN HỆ SẢN XUẤT: 2D NESTING (MỚI)
    // ----------------------------------------------------
    {
        id: 'mrp-nesting',
        title: 'Công Cụ Xếp Sơ Đồ Cắt 2D Nesting (Fabric Pattern Packing)',
        category: 'PRODUCTION',
        categoryName: 'Sản Xuất & MRP',
        tags: ['Nesting', 'Xếp sơ đồ', 'Cắt vải', 'Định mức', 'Mới'],
        summary: 'Hướng dẫn sử dụng công cụ Canvas 2D tương tác để bố trí các chi tiết rập lên khổ vải, tối ưu hóa định mức tiêu hao nguyên vật liệu và xuất ảnh sơ đồ kỹ thuật cho xưởng cắt.',
        estimatedReadTime: '6 phút',
        updatedAt: '14/09/2026',
        isNew: true,
        isFeatured: true,
        youtubeId: 'p7ZkQ8Q5n0M',
        videoUrl: 'https://www.youtube.com/embed/p7ZkQ8Q5n0M',
        deepLink: {
            label: 'Xem trong Lập Kế Hoạch',
            path: '/planning'
        },
        steps: [
            {
                title: 'Bước 1: Khởi động công cụ Nesting',
                description: 'Từ màn hình Lập Kế Hoạch Sản Xuất (Planning), tại bảng phân tích chi tiết bán thành phẩm, nhấn nút "Xếp Sơ Đồ 2D" ở thanh công cụ phía trên.',
            },
            {
                title: 'Bước 2: Thiết lập Thông số Khổ vải',
                description: 'Nhập chiều rộng khổ vải thực tế (ví dụ: 160 cm, trừ biên an toàn 2 cm còn 158 cm). Nhập khoảng cách an toàn giữa các chi tiết (Gap spacing: thường là 0.5 - 1 cm).',
                tip: 'Trừ biên an toàn đúng giúp tránh tình trạng mép vải xơ làm hỏng chi tiết thành phẩm.'
            },
            {
                title: 'Bước 3: Tự động xếp tối ưu (Auto Nesting)',
                description: 'Bấm nút "Chạy Xếp Tự Động". Thuật toán hình học sẽ tính toán và sắp xếp sơ bộ các mảnh chi tiết rập vào diện tích vải nhỏ nhất.',
            },
            {
                title: 'Bước 4: Tinh chỉnh thủ công trực quan trên Canvas',
                description: 'Nhấp chọn từng chi tiết trên Canvas: Kéo chuột để di chuyển đến vị trí mong muốn; dùng nút Xoay 90° hoặc 180° để lồng ghép các đường cong rập khít vào nhau.',
                warning: 'Đối với vải có tuyết hoặc họa tiết một chiều, không được xoay chi tiết ngược hướng canh sợi.'
            },
            {
                title: 'Bước 5: Kiểm tra Hiệu suất & Xuất file',
                description: 'Quan sát thanh thống kê: % Diện tích hữu dụng (Efficiency) và Độ dài sơ đồ (Length m). Sau khi đạt định mức tốt nhất, nhấn "Xuất Ảnh Sơ Đồ" để lưu file PNG độ nét cao đính kèm PO cắt.',
            }
        ]
    },

    // ----------------------------------------------------
    // BÁO CÁO GIA CÔNG IN & QC (MỚI)
    // ----------------------------------------------------
    {
        id: 'print-production-guide',
        title: 'Báo Cáo Gia Công In Ấn (Print Report Dashboard)',
        category: 'PRODUCTION',
        categoryName: 'Sản Xuất & MRP',
        tags: ['Gia công in', 'Báo cáo in', 'Bàn in', 'Máy in', 'Mới'],
        summary: 'Theo dõi năng suất xưởng in, kiểm soát tiến độ từng mẻ in theo bàn in/máy in và kiểm soát tỷ lệ lỗi mực, hỏng vải thời gian thực.',
        estimatedReadTime: '4 phút',
        updatedAt: '14/09/2026',
        isNew: true,
        deepLink: {
            label: 'Mở Báo Cáo Gia Công In',
            path: '/print-production'
        },
        steps: [
            {
                title: 'Bước 1: Truy cập Dashboard Gia Công In',
                description: 'Vào menu Sản xuất (MRP) -> Báo cáo Gia công In (/print-production). Giao diện hiển thị tổng quan số lệnh in đang chạy, số bàn in hoạt động và sản lượng trong ngày.',
            },
            {
                title: 'Bước 2: Cập nhật Tiến độ Mẻ in',
                description: 'Nhân viên xưởng in chọn mã Lệnh in, nhập số lượng bán thành phẩm đã in hoàn tất trong ca, tên thợ in chính và thời gian bắt đầu/kết thúc.',
            },
            {
                title: 'Bước 3: Ghi nhận Tỷ lệ Lỗi & Hao hụt',
                description: 'Nếu có lỗi phát sinh (lem màu, lệch bản in, dơ vải), nhập số lượng lỗi và nguyên nhân. Hệ thống tự tính tỷ lệ đạt (Yield Rate) và gửi cảnh báo nếu vượt ngưỡng hao hụt định mức.',
            }
        ]
    },
    {
        id: 'qc-guide',
        title: 'Phân Hệ Kiểm Tra Chất Lượng (Quality Control - QC)',
        category: 'PRODUCTION',
        categoryName: 'Sản Xuất & MRP',
        tags: ['QC', 'Kiểm tra', 'Chất lượng', 'Lỗi', 'Đạt chuẩn', 'Mới'],
        summary: 'Quy trình kiểm định chất lượng 3 lớp: Kiểm tra NPL đầu vào (IQC), Kiểm tra công đoạn sản xuất (PQC) và Kiểm tra đóng gói xuất xưởng (OQC).',
        estimatedReadTime: '5 phút',
        updatedAt: '14/09/2026',
        isNew: true,
        deepLink: {
            label: 'Mở Phân Hệ QC',
            path: '/qc'
        },
        steps: [
            {
                title: 'Bước 1: Tạo Phiếu Kiểm Định QC',
                description: 'Tại menu Sản xuất -> Kiểm Tra Chất Lượng (/qc), bấm "Tạo Phiếu Kiểm Tra". Chọn loại kiểm định: Đầu vào NPL, Sau in/thêu, Sau may hoặc Thành phẩm xuất xưởng.',
            },
            {
                title: 'Bước 2: Lấy mẫu & Nhập kết quả',
                description: 'Áp dụng quy chuẩn lấy mẫu AQL hoặc kiểm 100%. Nhập: Số lượng lấy mẫu, Số lượng đạt (Pass), Số lượng lỗi (Defect).',
            },
            {
                title: 'Bước 3: Phân loại Lỗi & Chụp ảnh minh chứng',
                description: 'Chọn danh mục lỗi (Lỗi đường may, Lỗi màu sắc, Lỗi quy cách kích thước). Upload ảnh chụp vị trí lỗi để đối chất với xưởng gia công.',
            },
            {
                title: 'Bước 4: Kết luận & Phê duyệt',
                description: 'Đánh giá kết luận: Chấp nhận toàn bộ (Accept), Chấp nhận có điều kiện, hoặc Từ chối trả hàng (Reject). Lô hàng chỉ được phép nhập kho thành phẩm khi đạt kết luận QC.',
            }
        ]
    },

    // ----------------------------------------------------
    // PHÂN HỆ BÁN HÀNG & HÓA ĐƠN
    // ----------------------------------------------------
    {
        id: 'sales-easyinvoice',
        title: 'Xuất Hóa Đơn Điện Tử VAT Tự Động (Tích Hợp EasyInvoice)',
        category: 'SALES',
        categoryName: 'Bán Hàng & Kế Toán',
        tags: ['EasyInvoice', 'Hóa đơn đỏ', 'VAT', 'Thuế', 'Tự động'],
        summary: 'Quy trình 5 bước đồng bộ đơn hàng ERP4U sang cổng phần mềm EasyInvoice, tự động tính thuế suất 8%/10%, xem trước bản nháp và phát hành ký số.',
        estimatedReadTime: '5 phút',
        updatedAt: '14/09/2026',
        isFeatured: true,
        youtubeId: '3mYFm-q5a_k',
        videoUrl: 'https://www.youtube.com/embed/3mYFm-q5a_k',
        deepLink: {
            label: 'Xem Danh Sách Đơn Hàng',
            path: '/orders'
        },
        steps: [
            {
                title: 'Bước 1: Kiểm tra thông tin pháp nhân đơn vị mua',
                description: 'Tại SO Detail (Tab Hợp đồng & Hóa đơn), kiểm tra các trường "Tên đơn vị (Xuất HĐ)", "MST", "Địa chỉ". Hệ thống tự động ưu tiên lấy tên công ty pháp nhân thay vì tên người liên hệ.',
                tip: 'Nút kiểm tra MST nhanh sẽ tra cứu dữ liệu từ cổng thông tin Tổng cục Thuế để xác thực doanh nghiệp còn hoạt động.'
            },
            {
                title: 'Bước 2: Tạo Hóa đơn nháp (Draft)',
                description: 'Nhấn nút "Tạo Hóa Đơn Nháp". Hệ thống gọi API truyền toàn bộ dòng sản phẩm, đơn giá thỏa thuận và thuế suất sang EasyInvoice dưới dạng hóa đơn chờ phát hành.',
            },
            {
                title: 'Bước 3: Tải/Xem trước Hóa đơn PDF',
                description: 'Sau khi tạo nháp thành công, hệ thống hiển thị nút "Xem Hóa Đơn". Bạn có thể tải file PDF nháp gửi khách hàng kiểm tra tên hàng, số lượng và tổng tiền trước khi ký số.',
            },
            {
                title: 'Bước 4: Ký số và Phát hành chính thức',
                description: 'Kế toán đăng nhập vào Portal EasyInvoice (bằng USB Token hoặc HSM) để thực hiện thao tác Ký số và cấp Số hóa đơn chính thức.',
                warning: 'Đảm bảo USB Token chữ ký số còn hạn sử dụng và đã cắm vào máy tính kế toán.'
            },
            {
                title: 'Bước 5: Cập nhật Trạng thái trên ERP',
                description: 'Trạng thái hóa đơn (Đã phát hành / Đã gửi khách) tự động cập nhật về ERP4U. Có thể bấm "Gửi Email" để gửi hóa đơn điện tử chính thức kèm mã tra cứu cho khách hàng.',
            }
        ]
    },
    {
        id: 'sales-process',
        title: 'Quy Trình Phối Kết Hợp Bán Hàng Sỉ (Wholesale Workflow)',
        category: 'SALES',
        categoryName: 'Bán Hàng & CRM',
        tags: ['Quy trình bán hàng', 'Wholesale', 'Pre-Sales', 'SOP'],
        summary: 'Quy trình tương tác chặt chẽ 3 bên: Sales Team tiếp nhận Lead, Purchasing Team kiểm tra nguồn cung NPL, và Production Team kiểm tra công suất xưởng.',
        estimatedReadTime: '6 phút',
        updatedAt: '14/09/2026',
        steps: [
            {
                title: 'Giai đoạn 1: Chăm sóc Lead & Tư vấn giải pháp',
                description: 'Sales Team tiếp nhận nhu cầu từ khách hàng sỉ, trao đổi quy cách sản phẩm, phối hợp với Kho để kiểm tra số lượng tồn sẵn có và gửi Báo giá khả thi.',
            },
            {
                title: 'Giai đoạn 2: Chốt Đơn hàng & Lập Kế hoạch',
                description: 'Sau khi khách duyệt mẫu và ký hợp đồng: Sales tạo Đơn hàng (SO) -> Purchasing nhận BOM tạo PO mua NPL -> Production tiếp nhận KHSX lên lịch gia công chi tiết.',
            },
            {
                title: 'Giai đoạn 3: Giao hàng & Chăm sóc sau bán',
                description: 'Production đóng gói thành phẩm -> Sales phối hợp bàn giao, lập biên bản thanh lý hợp đồng, ghi nhận đánh giá của khách hàng và định kỳ chăm sóc tái đặt hàng.',
            }
        ]
    },
    {
        id: 'sales-create',
        title: 'Tạo Đơn Hàng Mới & Tùy Biến Sản Phẩm (Custom Variants)',
        category: 'SALES',
        categoryName: 'Bán Hàng & CRM',
        tags: ['Tạo đơn', 'Báo giá', 'SO', 'Variants', 'Ảnh mẫu'],
        summary: 'Cách tạo Báo giá/SO mới, tìm kiếm khách hàng nhanh và mẹo bán sản phẩm tùy biến quy cách riêng cho từng khách mà không cần tạo mã SKU mới trong kho.',
        estimatedReadTime: '4 phút',
        updatedAt: '14/09/2026',
        deepLink: {
            label: 'Tạo Báo Giá Mới',
            path: '/sales'
        },
        steps: [
            {
                title: 'Bước 1: Truy cập giao diện tạo đơn',
                description: 'Vào menu Bán hàng (CRM) -> Sales Orders. Nhấn nút "Thêm Mới" ở góc trên bên phải.',
            },
            {
                title: 'Bước 2: Điền thông tin Khách hàng',
                description: 'Tìm kiếm khách hàng bằng Tên hoặc Số điện thoại. Nếu là khách mới, nhấn icon (+) để tạo nhanh khách hàng kèm MST và địa chỉ xuất hóa đơn.',
            },
            {
                title: 'Bước 3: Thêm sản phẩm & Tùy biến linh hoạt',
                description: 'Gõ SKU hoặc tên sản phẩm. Bạn có thể sửa trực tiếp Đơn giá bán thỏa thuận, sửa ô "Mô tả VAT" để hiển thị đúng nội dung yêu cầu của khách, và bấm icon máy ảnh để upload ảnh mẫu riêng.',
                tip: 'Tính năng này giúp báo giá cho các đơn hàng may/in theo yêu cầu cực kỳ nhanh gọn mà không làm rác danh mục SKU kho.'
            },
            {
                title: 'Bước 4: Cấu hình Thuế & Thanh toán',
                description: 'Chọn mức thuế GTGT (8% hoặc 10%) và phương thức thanh toán. Hệ thống tự động tính Tiền hàng, Tiền thuế và Tổng tiền bằng chữ.',
            },
            {
                title: 'Bước 5: Lưu & Gửi link cho khách',
                description: 'Nhấn "Lưu". Bạn có thể sao chép link Customer Portal để gửi qua Zalo/Email cho khách xem báo giá trực tuyến.',
            }
        ]
    },
    {
        id: 'internal-sales',
        title: 'Quy Trình Bán Hàng Nội Bộ (Internal Sales Order)',
        category: 'SALES',
        categoryName: 'Bán Hàng & CRM',
        tags: ['Nội bộ', 'Xuất dùng', 'Biếu tặng', 'Nhân viên'],
        summary: 'Áp dụng khi xuất hàng mẫu marketing, xuất điều chuyển kho chi nhánh, xuất biếu tặng hoặc bán ưu đãi cho nhân viên công ty.',
        estimatedReadTime: '4 phút',
        updatedAt: '14/09/2026',
        steps: [
            {
                title: 'Bước 1: Tạo khách hàng đại diện phòng ban',
                description: 'Tạo mã khách hàng đại diện cho mục đích sử dụng (Ví dụ: CÔNG TY ERP4U - PHÒNG MARKETING). Phân loại nhóm khách hàng là "Internal".',
            },
            {
                title: 'Bước 2: Tạo SO chọn bảng giá phù hợp',
                description: 'Nếu là hàng xuất dùng/biếu tặng: Đặt Đơn giá = 0 (hoặc chọn Chiết khấu 100%). Nếu bán cho nhân viên: Chọn bảng giá nội bộ (Internal Price List) bằng giá vốn + chi phí quản lý.',
            },
            {
                title: 'Bước 3: Duyệt và Xuất kho',
                description: 'Quy trình duyệt và xuất kho thực hiện bình thường để đảm bảo trừ tồn kho chính xác. Kế toán hạch toán vào Chi phí thay vì Doanh thu thuần.',
            }
        ]
    },
    {
        id: 'sales-pos',
        title: 'Bán Lẻ POS & Quản Lý Cửa Hàng (Point of Sale)',
        category: 'SALES',
        categoryName: 'Bán Hàng & CRM',
        tags: ['POS', 'Bán lẻ', 'Thu ngân', 'Mã vạch', 'In bill'],
        summary: 'Giao diện thu ngân cảm ứng, tìm kiếm nhanh qua Barcode/mã vạch, tự động áp dụng chính sách khuyến mãi và in hóa đơn nhiệt 80mm.',
        estimatedReadTime: '4 phút',
        updatedAt: '14/09/2026',
        isNew: true,
        deepLink: {
            label: 'Mở Màn Hình POS',
            path: '/pos'
        },
        steps: [
            {
                title: 'Bước 1: Khởi động ca bán hàng POS',
                description: 'Mở menu Bán Hàng -> Bán Lẻ (POS) (/pos). Thu ngân kiểm tra số dư đầu ca tiền mặt trong két.',
            },
            {
                title: 'Bước 2: Quét mã vạch hoặc chọn sản phẩm',
                description: 'Dùng máy quét Barcode quét mã sản phẩm hoặc tìm nhanh theo tên trên màn hình cảm ứng.',
            },
            {
                title: 'Bước 3: Áp dụng khuyến mãi & Thanh toán',
                description: 'Hệ thống tự nhận diện các chương trình giảm giá đang chạy. Chọn hình thức: Tiền mặt, Chuyển khoản VietQR động hoặc Thẻ.',
            },
            {
                title: 'Bước 4: In hóa đơn & Trừ kho tự động',
                description: 'Hệ thống tự động kích hoạt máy in bill nhiệt 80mm và lập tức giảm tồn kho khả dụng tại cửa hàng.',
            }
        ]
    },

    // ----------------------------------------------------
    // PHÂN HỆ TÀI CHÍNH & KẾ TOÁN
    // ----------------------------------------------------
    {
        id: 'finance-so-profit',
        title: 'Tính Toán Lợi Nhuận Đơn Hàng (SO Profit) & Chi Phí Thực Tế',
        category: 'FINANCE',
        categoryName: 'Tài Chính & Kế Toán',
        tags: ['Lợi nhuận', 'SO Profit', 'Chi phí', 'COGS', 'Hạch toán'],
        summary: 'Cơ chế tự động phân bổ chi phí nguyên vật liệu xuất kho và giá vốn hàng bán trực tiếp vào từng đơn hàng bán để đo lường tỷ suất lợi nhuận thực tế.',
        estimatedReadTime: '5 phút',
        updatedAt: '14/09/2026',
        isFeatured: true,
        youtubeId: 'kJQP7kiw5Fk',
        videoUrl: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
        deepLink: {
            label: 'Mở Báo Cáo Tài Chính',
            path: '/finance'
        },
        steps: [
            {
                title: '1. Xuất NPL cho Kế hoạch Sản xuất (GOODS_ISSUE_NPL)',
                description: 'Khi KHSX xuất kho nguyên phụ liệu, hệ thống tính tổng giá trị NPL theo cost_price và tự động chia tỷ lệ để phân bổ chi phí này cho các Đơn hàng (SO) nằm trong đợt sản xuất.',
            },
            {
                title: '2. Xuất kho Bán hàng / Giao hàng (GOODS_ISSUE_PRODUCT)',
                description: 'Khi xuất kho giao sản phẩm cho khách, hệ thống tính Giá vốn hàng bán (COGS) dựa trên giá thành sản xuất và phân bổ 100% vào SO tương ứng.',
            },
            {
                title: '3. Xem Báo Cáo Lợi Nhuận SO thời gian thực',
                description: 'Tại chi tiết đơn hàng hoặc phân hệ Tài chính, xem biểu đồ Doanh thu trừ Tổng chi phí (NPL + Gia công + Vận chuyển) để nắm chính xác % Biên lợi nhuận (Profit Margin).',
            }
        ]
    },
    {
        id: 'finance-guide',
        title: 'Quản Lý Thu Chi, Hạch Toán & Sổ Quỹ Tiền Mặt',
        category: 'FINANCE',
        categoryName: 'Tài Chính & Kế Toán',
        tags: ['Thu chi', 'Sổ quỹ', 'Hạch toán', 'Báo cáo tài chính'],
        summary: 'Theo dõi dòng tiền vào/ra, hạch toán hóa đơn chứng từ kế toán thuế và xem báo cáo tài chính tổng hợp theo tháng/năm.',
        estimatedReadTime: '5 phút',
        updatedAt: '14/09/2026',
        deepLink: {
            label: 'Vào Quản Lý Thu Chi',
            path: '/finance'
        },
        steps: [
            {
                title: 'Quản lý Phiếu Thu (Income)',
                description: 'Tự động sinh khi khách thanh toán SO, hoặc tạo thủ công cho các khoản thu khác (thanh lý tài sản, thu hồi nợ...).',
            },
            {
                title: 'Quản lý Phiếu Chi (Expense)',
                description: 'Tự động sinh khi thanh toán PO mua hàng/gia công, hoặc tạo phiếu chi nội bộ (tiền điện, tiền thuê xưởng, tiếp khách...).',
            },
            {
                title: 'Quy trình Hạch toán Kế toán',
                description: 'Kế toán kiểm tra giao dịch -> Nhấn "Hạch toán" -> Nhập Số hóa đơn/chứng từ đính kèm -> Giao dịch chuyển sang trạng thái "Đã HT".',
            },
            {
                title: 'Báo Cáo Tài Chính Tổng Hợp',
                description: 'Tab Báo Cáo Tài Chính tổng hợp mọi giao dịch ĐÃ HẠCH TOÁN, tự động tính Doanh thu thuần, Tổng chi phí và Lợi nhuận ròng theo từng kỳ.',
            }
        ]
    },
    {
        id: 'finance-supplier-payment',
        title: 'Quản Lý Công Nợ & Thanh Toán Gộp PO Đối Tác (Bulk Payment)',
        category: 'FINANCE',
        categoryName: 'Tài Chính & Kế Toán',
        tags: ['Công nợ', 'Thanh toán gộp', 'Nhà cung cấp', 'PO'],
        summary: 'Cách gom nhiều đơn đặt hàng (PO NPL hoặc PO Gia công) của cùng một nhà cung cấp để thanh toán một lần và theo dõi số dư công nợ tự động.',
        estimatedReadTime: '4 phút',
        updatedAt: '14/09/2026',
        steps: [
            {
                title: 'Bước 1: Theo dõi công nợ Real-time',
                description: 'Vào danh mục Nhà Cung Cấp / Nhà Gia Công, chuyển sang tab Công Nợ để xem số tiền đang nợ từng đối tác.',
            },
            {
                title: 'Bước 2: Thanh toán gộp nhiều đơn',
                description: 'Bấm nút "Thanh Toán". Chọn danh sách các PO cần chi trả và nhập số tiền thanh toán cho từng PO.',
            },
            {
                title: 'Bước 3: Tự động sinh Phiếu Chi gộp',
                description: 'Hệ thống tự tạo 1 Phiếu Chi liên kết với các PO này và cập nhật số tiền đã trả cho mỗi PO tương ứng.',
            }
        ]
    },

    // ----------------------------------------------------
    // PHÂN HỆ KHO VẬN
    // ----------------------------------------------------
    {
        id: 'inventory-guide',
        title: 'Quản Lý Kho & Quy Đổi Đơn Vị Tính (Unit Conversion)',
        category: 'INVENTORY',
        categoryName: 'Kho Vận & Nhà Cung Cấp',
        tags: ['Kho', 'Đơn vị tính', 'Quy đổi', 'Base Unit', 'Factor'],
        summary: 'Nguyên lý quản lý kho đa đơn vị tính: Nhập kho theo quy cách mua hàng (Cây, Cuộn, Thùng) và tự động quy đổi về đơn vị cơ sở (Mét, Cái, Gram) để phục vụ sản xuất.',
        estimatedReadTime: '5 phút',
        updatedAt: '14/09/2026',
        youtubeId: '3mYFm-q5a_k',
        videoUrl: 'https://www.youtube.com/embed/3mYFm-q5a_k',
        deepLink: {
            label: 'Mở Danh Mục Nguyên Liệu',
            path: '/materials'
        },
        steps: [
            {
                title: '1. Đơn vị Cơ sở (Base Unit)',
                description: 'Là đơn vị nhỏ nhất dùng để tính toán tồn kho và cấu thành Định mức BOM (Ví dụ: Mét, Gram, Cái).',
            },
            {
                title: '2. Đơn vị Mua (Purchase Unit) & Hệ số Quy đổi (Factor)',
                description: 'Là đơn vị khi đặt hàng từ nhà cung cấp (Ví dụ: Cây vải, Bao gòn). Hệ số quy đổi là tỷ lệ giữa 2 đơn vị (Ví dụ: 1 Cây vải = 50 Mét -> Factor = 50).',
            },
            {
                title: '3. Công thức nhập xuất kho chuẩn hóa',
                description: 'Số lượng Tồn kho thực tế (Base) = Số lượng Nhập (Mua) x Hệ số quy đổi. Đơn giá cơ sở = Đơn giá mua / Hệ số quy đổi.',
            }
        ]
    },
    {
        id: 'supplier-stock',
        title: 'Quản Lý Tồn Kho NPL Tại Xưởng Gia Công Ngoài',
        category: 'INVENTORY',
        categoryName: 'Kho Vận & Nhà Cung Cấp',
        tags: ['Kho gia công', 'Tồn kho xưởng ngoài', 'NPL', 'Gửi hàng'],
        summary: 'Kiểm soát số lượng vải và nguyên phụ liệu đang gửi tại các xưởng may/in gia công ngoài, tự động trừ tồn kho theo định mức khi xưởng giao thành phẩm.',
        estimatedReadTime: '4 phút',
        updatedAt: '14/09/2026',
        steps: [
            {
                title: '1. Xuất NPL sang xưởng gia công',
                description: 'Tạo phiếu xuất kho NPL kèm nhãn chỉ định Xưởng gia công tiếp nhận. Số dư live của xưởng lập tức tăng tương ứng.',
            },
            {
                title: '2. Nhập thành phẩm & Trừ kho tự động',
                description: 'Khi xưởng giao thành phẩm, hệ thống căn cứ theo định mức BOM để tự động trừ số lượng NPL tương ứng mà xưởng đang nắm giữ.',
            },
            {
                title: '3. Bù trừ hao hụt & Kiểm kê',
                description: 'Nếu thực tế xưởng tiêu hao nhiều hơn định mức, lập Phiếu Điều Chỉnh Kho hoặc Phiếu Bù NPL để đồng bộ với số liệu kiểm kê tại xưởng.',
            }
        ]
    },

    // ----------------------------------------------------
    // PHÂN HỆ SẢN XUẤT: MRP
    // ----------------------------------------------------
    {
        id: 'mrp-guide',
        title: 'SOP: Lập Kế Hoạch Sản Xuất & Chạy Phân Tích MRP',
        category: 'PRODUCTION',
        categoryName: 'Sản Xuất & MRP',
        tags: ['MRP', 'Kế hoạch', 'BOM', 'Cần mua', 'Gia công ngoài'],
        summary: 'Quy trình gom các Đơn hàng (SO) cần sản xuất, tự động bóc tách BOM, kiểm tra tồn kho sẵn có và tự sinh PO Mua NPL & PO Gia Công.',
        estimatedReadTime: '6 phút',
        updatedAt: '14/09/2026',
        youtubeId: 'dQw4w9WgXcQ',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        deepLink: {
            label: 'Mở Lập Kế Hoạch (MRP)',
            path: '/planning'
        },
        steps: [
            {
                title: 'Bước 1: Chọn các Đơn hàng cần sản xuất',
                description: 'Tại màn hình Lập Kế Hoạch, chọn các SO ở trạng thái đã chốt để đưa vào đợt phân tích MRP tập trung.',
            },
            {
                title: 'Bước 2: Chạy tính toán tự động',
                description: 'Hệ thống bóc tách định mức BOM của từng sản phẩm, đối chiếu Tồn kho thực tế (bao gồm cả tồn tại nhà máy và tồn tại xưởng đối tác).',
            },
            {
                title: 'Bước 3: Rà soát Bảng khuyến nghị Cần Mua & Cần Gia Công',
                description: 'Hệ thống tính chính xác số lượng NPL Cần Mua (đã trừ tồn kho an toàn) và các công đoạn cần thuê ngoài.',
            },
            {
                title: 'Bước 4: Tự động sinh PO tập trung',
                description: 'Nhấn nút "Tạo PO Tập Trung". Hệ thống tự động sinh các Đơn mua hàng PO NPL và PO Gia Công để bộ phận Mua hàng xử lý tiếp.',
            }
        ]
    },
    {
        id: 'mrp-tracking',
        title: 'Theo Dõi Tiến Độ Kế Hoạch Sản Xuất & Lịch Sử Phiên Bản',
        category: 'PRODUCTION',
        categoryName: 'Sản Xuất & MRP',
        tags: ['Tiến độ', 'Pipeline', 'Lịch sử', 'BOD FollowUp'],
        summary: 'Quản lý trạng thái từng công đoạn sản xuất (Pipeline), lưu trữ Snapshot các phiên bản tính toán và đồng bộ dữ liệu sang BOD FollowUp của Đơn hàng.',
        estimatedReadTime: '5 phút',
        updatedAt: '14/09/2026',
        steps: [
            {
                title: '1. Theo dõi Pipeline công đoạn',
                description: 'Cập nhật trạng thái từng công đoạn (Chờ NPL -> Cắt -> In/Thêu -> May -> Đóng gói) trực tiếp trên thanh tiến độ.',
            },
            {
                title: '2. Lịch sử phiên bản (Version History)',
                description: 'Mỗi lần lưu kết quả hoặc tính lại, hệ thống tự động lưu 1 bản Snapshot. Người dùng có thể xem lại hoặc so sánh sự thay đổi định mức.',
            },
            {
                title: '3. Đồng bộ BOD FollowUp',
                description: 'Bấm nút "Sync BOD" để cập nhật nhanh tiến độ NPL và Sản xuất vào màn hình giám sát BOD của Đơn hàng mà không ghi đè ghi chú cũ.',
            }
        ]
    },

    // ----------------------------------------------------
    // PHÂN HỆ NHÂN SỰ (HR)
    // ----------------------------------------------------
    {
        id: 'hr-overview',
        title: 'Tổng Quan Phân Hệ Nhân Sự, Chấm Công & Tiền Lương (HR)',
        category: 'HR',
        categoryName: 'Nhân Sự & Vận Hành',
        tags: ['HR', 'Chấm công', 'Nghỉ phép', 'Phiếu lương', 'Hồ sơ'],
        summary: 'Toàn bộ quy trình nhân sự: Chấm công định vị GPS/IP, gửi đơn xin nghỉ phép trực tuyến, theo dõi hạn ngạch ngày phép và tra cứu phiếu lương bảo mật.',
        estimatedReadTime: '4 phút',
        updatedAt: '14/09/2026',
        youtubeId: 'p7ZkQ8Q5n0M',
        videoUrl: 'https://www.youtube.com/embed/p7ZkQ8Q5n0M',
        deepLink: {
            label: 'Mở Phân Hệ Nhân Sự',
            path: '/hr'
        },
        steps: [
            {
                title: '1. Chấm công hàng ngày (Attendance)',
                description: 'Nhân viên đăng nhập trên máy tính hoặc điện thoại, nhấn "Chấm công vào ca" / "Chấm công tan ca" kèm xác thực vị trí.',
            },
            {
                title: '2. Quản lý nghỉ phép (Leave Request)',
                description: 'Tạo đơn xin nghỉ (phép năm, ốm đau, việc riêng). Quản lý phòng ban nhận thông báo và duyệt trực tuyến trong 1 chạm.',
            },
            {
                title: '3. Tra cứu phiếu lương cá nhân (Payslip)',
                description: 'Vào tab Phiếu Lương để xem chi tiết lương cơ bản, phụ cấp, thưởng KPI, các khoản khấu trừ bảo hiểm và thực nhận.',
            }
        ]
    }
];

export const ROLE_FILTERS = [
    { key: 'ALL', label: 'Tất Cả Phân Hệ', icon: 'AppstoreOutlined' },
    { key: 'SALES', label: 'Bán Hàng & CRM', icon: 'ShopOutlined' },
    { key: 'PRODUCTION', label: 'Sản Xuất & MRP', icon: 'ExperimentOutlined' },
    { key: 'DESIGN', label: 'Thiết Kế & In Thêu', icon: 'PrinterOutlined' },
    { key: 'INVENTORY', label: 'Kho Vận & NCC', icon: 'ContainerOutlined' },
    { key: 'FINANCE', label: 'Tài Chính & Thu Chi', icon: 'DollarOutlined' },
    { key: 'HR', label: 'Nhân Sự & Vận Hành', icon: 'TeamOutlined' }
];

export const POPULAR_SEARCH_KEYWORDS = [
    'Hóa đơn EasyInvoice',
    'Xếp sơ đồ 2D Nesting',
    'Duyệt mẫu thiết kế',
    'Tạo đơn hàng mới',
    'Lợi nhuận SO Profit',
    'Chạy tính toán MRP',
    'Chấm công & Nghỉ phép',
    'Bán lẻ POS'
];

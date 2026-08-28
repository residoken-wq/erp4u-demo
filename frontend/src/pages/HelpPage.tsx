import React, { useState } from 'react';
import { Layout, Menu, Typography, Card, Steps, Divider, Tag, Alert, Row, Col, Button, Breadcrumb, Tree, Descriptions } from 'antd';
import {
    BookOutlined,
    ShopOutlined,
    UserOutlined,
    SolutionOutlined,
    FileDoneOutlined,
    DollarOutlined,
    CarOutlined,
    CheckCircleOutlined,
    QuestionCircleOutlined,
    RocketOutlined,
    PlusOutlined,
    SearchOutlined,
    EditOutlined,
    UploadOutlined,
    SaveOutlined,
    HistoryOutlined,
    CopyOutlined,
    BellOutlined,
    ProjectOutlined,
    AppstoreAddOutlined,
    ExperimentOutlined,
    BranchesOutlined,
    FileAddOutlined,
    PrinterOutlined,
    MailOutlined,
    DatabaseOutlined,
    TagsOutlined,
    GiftOutlined,
    ContainerOutlined,
    CalculatorOutlined,
    ShoppingCartOutlined,
    WalletOutlined,
    HeartOutlined,
    TeamOutlined,
    CalendarOutlined,
    ClockCircleOutlined,
    IdcardOutlined,
    ToolOutlined,
    TruckOutlined,
    ApartmentOutlined,
    OrderedListOutlined,
    ThunderboltOutlined,
    InboxOutlined,
    SwapOutlined,
    FileSearchOutlined
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;

const HelpPage: React.FC = () => {
    const [selectedKey, setSelectedKey] = useState('sales-process');

    const renderContent = () => {
        switch (selectedKey) {
            case 'intro':
                return (
                    <div>
                        <Title level={2}>👋 Chào mừng đến với ERP4U Knowledge Base</Title>
                        <Paragraph>
                            Đây là cổng thông tin hướng dẫn sử dụng hệ thống ERP4U. Tại đây bạn có thể tìm thấy các quy trình,
                            hướng dẫn thao tác và mẹo sử dụng để tối ưu hóa công việc của mình.
                        </Paragraph>
                        <Alert
                            message="Mẹo nhanh"
                            description="Sử dụng thanh điều hướng bên trái để truy cập tài liệu chi tiết cho từng phân hệ."
                            type="info"
                            showIcon
                        />
                        <Divider />
                        <Row gutter={16}>
                            <Col span={8}>
                                <Card size="small" className="feature-card">
                                    <RocketOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                                    <Title level={4}>Bắt đầu nhanh</Title>
                                    <Text type="secondary">Làm quen với giao diện và các tính năng cơ bản.</Text>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small" className="feature-card">
                                    <ShopOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                                    <Title level={4}>Quy trình Bán hàng</Title>
                                    <Text type="secondary">Từ Báo giá đến Chốt đơn và Giao hàng.</Text>
                                </Card>
                            </Col>
                        </Row>

                        <Divider style={{ margin: '40px 0' }} />

                        <Tag color="cyan" style={{ marginBottom: 16 }}>Tổng quan hệ thống</Tag>
                        <Title level={2}>🔄 Quy trình Vận hành Tổng thể (Overall Workflow)</Title>
                        <Paragraph>
                            Hệ thống ERP4U vận hành theo luồng dữ liệu khép kín, đảm bảo tính liên kết chặt chẽ giữa các phòng ban.
                            Dưới đây là hành trình của một đơn hàng từ khi phát sinh nhu cầu đến khi hoàn tất thanh toán.
                        </Paragraph>

                        <Steps
                            direction="vertical"
                            current={-1}
                            items={[
                                {
                                    title: <Text strong>1. Kinh Doanh (Sales)</Text>,
                                    description: 'Tiếp nhận yêu cầu -> Tạo Báo giá (Quote) -> Chốt Đơn hàng (SO).',
                                    icon: <SolutionOutlined />,
                                    status: 'process'
                                },
                                {
                                    title: <Text strong>2. Kế Hoạch (Planning)</Text>,
                                    description: 'Tổng hợp các SO đã chốt -> Chạy phân tích MRP -> Xác định nhu cầu Nguyên phụ liệu (NPL) & Gia công.',
                                    icon: <ProjectOutlined />,
                                    status: 'wait'
                                },
                                {
                                    title: <Text strong>3. Mua Hàng (Purchasing)</Text>,
                                    description: 'Tạo Đơn mua hàng (PO) từ yêu cầu của bộ phận Kế hoạch -> Gửi cho Nhà cung cấp.',
                                    icon: <ShopOutlined />,
                                    status: 'wait'
                                },
                                {
                                    title: <Text strong>4. Kho Vận (Inventory)</Text>,
                                    description: 'Nhập kho NPL (GRN) -> Soạn hàng & Xuất kho cho Sản xuất hoặc Giao hàng.',
                                    icon: <ContainerOutlined />,
                                    status: 'wait'
                                },
                                {
                                    title: <Text strong>5. Sản Xuất (Production)</Text>,
                                    description: 'Nhận NPL -> Thực hiện gia công (Cắt/May/Ủi) -> Nhập kho Thành phẩm.',
                                    icon: <ExperimentOutlined />,
                                    status: 'wait'
                                },
                                {
                                    title: <Text strong>6. Giao Hàng (Logistics)</Text>,
                                    description: 'Đóng gói thành phẩm -> Giao cho khách hàng (Delivery Note).',
                                    icon: <CarOutlined />,
                                    status: 'wait'
                                },
                                {
                                    title: <Text strong>7. Tài Chính (Finance)</Text>,
                                    description: 'Xuất hóa đơn GTGT -> Theo dõi công nợ -> Thu tiền (Payment).',
                                    icon: <DollarOutlined />,
                                    status: 'wait'
                                }
                            ]}
                        />

                        <Divider />
                        <Title level={4}>Vai trò của từng bộ phận</Title>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card size="small" title="Kinh Doanh" bordered={false} style={{ background: '#e6f7ff' }}>
                                    Người khởi tạo quy trình. Chịu trách nhiệm về doanh số và thông tin khách hàng.
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" title="Kế Hoạch & Mua Hàng" bordered={false} style={{ background: '#f6ffed' }}>
                                    "Bộ não" của sản xuất. Đảm bảo có đủ nguyên liệu đúng lúc, đúng chỗ.
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" title="Kho & Sản Xuất" bordered={false} style={{ background: '#fff7e6' }}>
                                    Bộ phận thực thi. Chuyển hóa nguyên liệu thành sản phẩm cuối cùng.
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" title="Kế Toán" bordered={false} style={{ background: '#fff0f6' }}>
                                    Người gác đền. Kiểm soát dòng tiền và hạch toán chính xác.
                                </Card>
                            </Col>
                        </Row>
                    </div>
                );
            case 'internal-sales':
                return (
                    <div>
                        <Tag color="geekblue" style={{ marginBottom: 16 }}>Nghiệp vụ đặc biệt</Tag>
                        <Title level={2}>🏢 Quy trình Bán hàng Nội bộ (Internal SO)</Title>
                        <Paragraph>
                            Đơn hàng nội bộ (Internal Sales Order) được sử dụng khi xuất hàng cho các mục đích không phát sinh doanh thu thương mại thông thường, ví dụ:
                            xuất chuyển kho chi nhánh, xuất cho nhân viên mua ưu đãi, hoặc xuất làm mẫu marketing.
                        </Paragraph>

                        <Divider orientation="left">Quy trình thực hiện</Divider>
                        <Steps
                            current={-1}
                            direction="vertical"
                            items={[
                                {
                                    title: 'Bước 1: Tạo Khách hàng "Nội bộ"',
                                    description: (
                                        <div>
                                            Tạo một mã khách hàng đại diện cho phòng ban hoặc mục đích sử dụng.
                                            <ul>
                                                <li><b>Tên KH:</b> CÔNG TY ABC - PHÒNG MARKETING</li>
                                                <li><b>Phân loại:</b> Chọn nhóm khách hàng là "Internal" (nếu có) để dễ lọc báo cáo.</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <UserOutlined />
                                },
                                {
                                    title: 'Bước 2: Tạo Đơn hàng (SO)',
                                    description: 'Tạo SO như bình thường, chọn Khách hàng nội bộ vừa tạo.',
                                    icon: <FileDoneOutlined />
                                },
                                {
                                    title: 'Bước 3: Áp dụng Chính sách giá',
                                    description: (
                                        <div>
                                            <Paragraph>Tùy theo mục đích mà chọn giá bán phù hợp:</Paragraph>
                                            <ul>
                                                <li><b>Xuất dùng/Biếu tặng:</b> Đơn giá = 0 (Hoặc dùng chức năng Discount 100%).</li>
                                                <li><b>Bán cho nhân viên:</b> Sử dụng <b>"Internal Price List"</b> (Thường bằng Giá vốn + Chi phí quản lý).</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <DollarOutlined />
                                },
                                {
                                    title: 'Bước 4: Duyệt & Xuất kho',
                                    description: 'Quy trình duyệt và xuất kho thực hiện tương tự đơn hàng thương mại để đảm bảo trừ tồn kho chính xác.',
                                    icon: <CheckCircleOutlined />
                                }
                            ]}
                        />

                        <Alert
                            message="Lưu ý về Hạch toán"
                            description="Đối với đơn hàng nội bộ giá 0 đồng, Kế toán cần hạch toán vào Chi phí (Marketing, Phúc lợi...) thay vì Doanh thu thuần."
                            type="warning"
                            showIcon
                            style={{ marginTop: 24 }}
                        />
                    </div>
                );
            case 'sales-easyinvoice':
                return (
                    <div>
                        <Tag color="blue" style={{ marginBottom: 16 }}>Modules: Sales / Accounting</Tag>
                        <Title level={2}>🧾 Quy trình Xuất Hóa Đơn VAT (Tích hợp EasyInvoice)</Title>
                        <Paragraph>
                            Hệ thống ERP4U đã được tích hợp chặt chẽ với phần mềm hóa đơn điện tử <b>EasyInvoice</b>, giúp bộ phận Kế toán và Sales xuất hóa đơn một cách nhanh chóng, đồng bộ mà không cần phải nhập lại dữ liệu thủ công.
                        </Paragraph>

                        <Card title="Các bước tạo Hóa đơn điện tử" style={{ marginBottom: 20 }}>
                            <Steps
                                direction="vertical"
                                items={[
                                    {
                                        title: 'Bước 1: Kiểm tra thông tin pháp nhân (Đơn vị mua)',
                                        description: 'Tại SO Detail (Tab Hợp đồng & Hóa đơn), kiểm tra các trường "Tên đơn vị (Xuất HĐ)", "MST", "Địa chỉ". Hệ thống sẽ ưu tiên lấy tên công ty (legal_name) thay vì tên người liên hệ.',
                                        icon: <UserOutlined />
                                    },
                                    {
                                        title: 'Bước 2: Tạo Hóa đơn nháp (Draft)',
                                        description: 'Nhấn nút "Tạo Hóa Đơn Nháp". Hệ thống sẽ gọi API EasyInvoice để truyền toàn bộ dữ liệu đơn hàng (Sản phẩm, Đơn giá, Thuế VAT 8% hoặc 10%) sang hệ thống của EasyInvoice dưới dạng hóa đơn chờ phát hành (chưa có số hóa đơn).',
                                        icon: <FileAddOutlined />
                                    },
                                    {
                                        title: 'Bước 3: Tải/Xem trước Hóa đơn',
                                        description: 'Sau khi tạo nháp thành công, hệ thống sẽ trả về Link Xem Trước. Bạn có thể nhấn "Tải File PDF" hoặc "Xem Hóa Đơn" để gửi file nháp này cho Khách hàng kiểm tra trước khi phát hành chính thức.',
                                        icon: <PrinterOutlined />
                                    },
                                    {
                                        title: 'Bước 4: Phát hành Hóa đơn (Trên EasyInvoice)',
                                        description: 'Khi khách hàng đã chốt bản nháp, kế toán đăng nhập vào Portal của EasyInvoice (bằng USB Token) để thực hiện thao tác Ký số và Phát hành Hóa đơn chính thức.',
                                        icon: <CheckCircleOutlined />
                                    },
                                    {
                                        title: 'Bước 5: Cập nhật Trạng thái trên ERP',
                                        description: 'Trạng thái hóa đơn (Đã phát hành / Hủy) sẽ được cập nhật đồng bộ về ERP4U. Người dùng có thể nhấn "Gửi Email" để gửi hóa đơn chính thức từ ERP cho khách.',
                                        icon: <MailOutlined />
                                    }
                                ]}
                            />
                        </Card>

                        <Alert
                            message="Lưu ý quan trọng"
                            description={
                                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                    <li><b>Pattern & Serial:</b> Trong màn Cấu hình Hệ thống, Mẫu số (Pattern) phải là 1, và Ký hiệu (Serial) phải đúng (VD: 1C26TAA).</li>
                                    <li><b>Chuyển khoản:</b> Hình thức thanh toán luôn mặc định là "2 - Chuyển khoản".</li>
                                    <li><b>Thuế suất:</b> Cần cấu hình Thuế VAT đúng ở đơn hàng trước khi bấm Tạo Hóa Đơn.</li>
                                </ul>
                            }
                            type="info"
                            showIcon
                        />
                    </div>
                );
            case 'sales-process':
                return (
                    <div>
                        <Tag color="blue" style={{ marginBottom: 16 }}>Modules: Sales</Tag>
                        <Title level={2}>🤝 Quy trình phối kết hợp Bán hàng (Wholesale Sales Workflow)</Title>
                        <Paragraph>
                            Quy trình phối hợp chặt chẽ giữa <b>Sales Team</b>, <b>Purchasing Team</b> (Mua hàng) và <b>Production Team</b> (Sản xuất/Kho) để phục vụ khách hàng sỉ.
                        </Paragraph>

                        {/* PHASE 1: LEAD & CONSULTING */}
                        <Card title="Giai đoạn 1: Chăm sóc & Tư vấn (Pre-Sales)" style={{ marginBottom: 20, borderColor: '#91d5ff' }}>
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Steps direction="vertical" size="small" current={-1} items={[
                                        {
                                            title: <Text strong>1. Chăm sóc Lead & Tư vấn giải pháp</Text>,
                                            description: 'Sales Team tiếp nhận Lead từ thị trường, tư vấn giải pháp, dịch vụ vượt trội và sản phẩm phù hợp.',
                                            icon: <UserOutlined style={{ color: '#1890ff' }} />
                                        },
                                        {
                                            title: <Text strong>2. Kiểm tra tồn kho (Kho - Production Team)</Text>,
                                            description: 'Sales Team phối hợp với Kho (Production) để kiểm tra số lượng tồn kho và lên kế hoạch giao nhận sơ bộ.',
                                            icon: <ShopOutlined style={{ color: '#52c41a' }} />
                                        },
                                        {
                                            title: <Text strong>3. Báo giá khả thi</Text>,
                                            description: 'Dựa trên năng lực cung ứng và tồn kho, Sales Team gửi báo giá khả thi cho khách hàng.',
                                            icon: <DollarOutlined style={{ color: '#faad14' }} />
                                        }
                                    ]} />
                                </Col>
                            </Row>
                        </Card>

                        {/* PHASE 2: ORDER & PLANNING */}
                        <Card title="Giai đoạn 2: Đơn hàng & Kế hoạch (Order Processing)" style={{ marginBottom: 20, borderColor: '#ffd666' }}>
                            <Row gutter={[16, 16]}>
                                <Col span={10}>
                                    <Card size="small" title="Sales Team" bordered={false} style={{ background: '#e6f7ff' }}>
                                        <div style={{ fontWeight: 600, marginBottom: 5 }}>2. Đơn hàng (Sale Order)</div>
                                        <ul>
                                            <li>Chốt sản phẩm mẫu & Chi tiết đơn hàng.</li>
                                            <li>Xác nhận thông tin giao hàng.</li>
                                            <li>Ký kết Hợp đồng & Nhận thanh toán.</li>
                                        </ul>
                                    </Card>
                                </Col>
                                <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ fontSize: 20 }}>➔</div>
                                </Col>
                                <Col span={12}>
                                    <Card size="small" title="Phối hợp Liên phòng ban" bordered={false} style={{ background: '#fffbe6' }}>
                                        <div style={{ marginBottom: 10 }}>
                                            <Tag color="orange">Purchasing Team</Tag>
                                            <br />
                                            <span>Nhận BOM ➔ Tạo <b>2. PO NPL</b> (Nguyên phụ liệu) dựa trên thông tin giao hàng & hợp đồng.</span>
                                        </div>
                                        <div>
                                            <Tag color="green">Production Team</Tag>
                                            <br />
                                            <span>Tiếp nhận <b>2. KHSX</b> (Kế hoạch SX) ➔ Lên PO NGC, Kiểm soát chất lượng SP & Kế hoạch giao hàng chi tiết.</span>
                                        </div>
                                    </Card>
                                </Col>
                            </Row>
                        </Card>

                        {/* PHASE 3: DELIVERY */}
                        <Card title="Giai đoạn 3: Giao hàng & Sau bán hàng" style={{ marginBottom: 20, borderColor: '#95de64' }}>
                            <Steps direction="vertical" size="small" current={-1} items={[
                                {
                                    title: <Text strong>3. Giao hàng & Thanh lý HĐ</Text>,
                                    description: (
                                        <div>
                                            <ul>
                                                <li><b>Production Team:</b> Thực hiện Đóng gói & Vận chuyển (Giao hàng).</li>
                                                <li><b>Sales Team:</b> Phối hợp bàn giao, làm thủ tục thanh lý hợp đồng và đo lường mức độ hài lòng của khách.</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <CarOutlined style={{ color: '#13c2c2' }} />
                                },
                                {
                                    title: <Text strong>4. Chăm sóc sau bán hàng</Text>,
                                    description: 'Sales Team tiếp tục duy trì mối quan hệ và hỗ trợ khách hàng sau khi đơn hàng hoàn tất.',
                                    icon: <HeartOutlined style={{ color: '#eb2f96' }} />
                                }
                            ]} />
                        </Card>
                    </div>
                );
            case 'sales-create':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Hướng dẫn thao tác</Tag>
                        <Title level={2}>📝 Tạo Đơn Hàng Mới</Title>
                        <Paragraph>
                            Chức năng này dùng để tạo Báo giá (Quote) hoặc Đơn hàng bán (Sales Order) mới.
                            Mọi đơn hàng đều bắt đầu từ bước này.
                        </Paragraph>

                        <Steps
                            direction="vertical"
                            current={-1}
                            items={[
                                {
                                    title: 'Bước 1: Truy cập giao diện',
                                    description: <span>Vào menu <b>Bán hàng (CRM)</b> ➔ <b>Sales Orders</b>. Nhấn nút <b>"Thêm Mới" <PlusOutlined /></b> ở góc phải.</span>,
                                },
                                {
                                    title: 'Bước 2: Điền thông tin Khách hàng',
                                    description: (
                                        <ul>
                                            <li>Tìm kiếm khách hàng bằng Tên hoặc SĐT tại ô <SearchOutlined />.</li>
                                            <li>Nếu chưa có, nhấn icon <b>(+) <PlusOutlined /></b> để tạo nhanh khách hàng mới.</li>
                                            <li>Hệ thống sẽ tự động điền địa chỉ giao hàng và thông tin VAT mặc định.</li>
                                        </ul>
                                    )
                                },
                                {
                                    title: 'Bước 3: Thêm sản phẩm',
                                    description: (
                                        <ul>
                                            <li>Gõ tên sản phẩm hoặc SKU vào ô tìm kiếm dòng hàng.</li>
                                            <li><b>Đơn giá:</b> Có thể chỉnh sửa trực tiếp <EditOutlined /> (Hệ thống hiển thị giá gốc tham chiếu).</li>
                                            <li><b>Mô tả VAT:</b> Nhấn vào ô text để sửa tên hiển thị trên hóa đơn đỏ.</li>
                                            <li><b>Hình ảnh:</b> Nhấn icon <UploadOutlined /> để upload ảnh mẫu thực tế nếu sản phẩm có tùy biến.</li>
                                        </ul>
                                    )
                                },
                                {
                                    title: 'Bước 4: Cấu hình Thanh toán & VAT',
                                    description: 'Nhập % Thuế GTGT (8% hoặc 10%) và chọn phương thức thanh toán. Hệ thống tự động tính Tổng tiền.',
                                },
                                {
                                    title: 'Bước 5: Lưu & Gửi',
                                    description: <span>Nhấn <b>"Lưu" <SaveOutlined /></b> để tạo đơn. Sau đó copy Link Portal gửi cho khách.</span>,
                                }
                            ]}
                        />

                        <Divider orientation="left">💡 Mẹo: Tùy biến sản phẩm (Variants)</Divider>
                        <Alert
                            message="Tạo sản phẩm 'Custom' cho từng khách hàng"
                            description={
                                <div>
                                    <Paragraph>
                                        Bạn có thể bán một sản phẩm với quy cách/ngoại quan khác biệt cho từng khách mà <b>không cần tạo mã SKU mới</b> trong kho.
                                    </Paragraph>
                                    <ul style={{ marginBottom: 0 }}>
                                        <li><b>Sửa tên hiển thị (VAT Content):</b> Thay đổi tên sản phẩm trên báo giá/hóa đơn để khách dễ hiểu (VD: <i>"Bàn học A"</i> ➔ <i>"Bàn học A (Màu hồng, Họa tiết mèo)"</i>).</li>
                                        <li><b>Upload ảnh thực tế:</b> Nhấn vào icon ảnh nhỏ <UploadOutlined /> ở đầu dòng để tải lên hình ảnh mẫu hoặc bản vẽ kỹ thuật riêng cho đơn hàng này. Hình ảnh này sẽ hiện trên Portal của khách.</li>
                                        <li><b>Giá bán flexible:</b> Nhập giá bán thỏa thuận trực tiếp tại cột "Đơn giá".</li>
                                    </ul>
                                </div>
                            }
                            type="info"
                            showIcon
                            icon={<RocketOutlined />}
                        />
                    </div>
                );
            case 'sales-contract-builder':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Hướng dẫn thao tác</Tag>
                        <Title level={2}>📝 Tính năng Soạn Thảo Hợp Đồng</Title>
                        <Paragraph>
                            Hệ thống cho phép bạn tạo tự động các hợp đồng chuẩn dựa trên dữ liệu báo giá / đơn hàng giúp tiết kiệm thời gian và sai sót.
                        </Paragraph>

                        <Steps
                            direction="vertical"
                            current={-1}
                            items={[
                                {
                                    title: 'Bước 1: Khởi tạo Hợp đồng',
                                    description: 'Từ trang Chi tiết Báo Giá/SO, nhấn chọn tab "Hợp Đồng" rồi nhấn nút "Tạo mới".',
                                    icon: <FileDoneOutlined />
                                },
                                {
                                    title: 'Bước 2: Chọn Mẫu Hợp đồng',
                                    description: 'Chọn mẫu hợp đồng trong danh sách (Quản trị viên có thể cấu hình trước trong mục Settings -> Mẫu Hợp Đồng).',
                                },
                                {
                                    title: 'Bước 3: Điền nội dung tự soạn',
                                    description: 'Dựa trên việc chọn mẫu, nếu Mẫu Hợp Đồng của bạn chứa tham số {{text_content_...}}, một nhóm "Nội Dung Tự Soạn" sẽ xuất hiện để bạn có thể soạn thảo thêm các điều khoản riêng dài cho Hợp đồng.',
                                },
                                {
                                    title: 'Bước 4: Xem trước & Xuất',
                                    description: 'Kiểm tra kỹ nội dung đã auto-fill (thông tin người bán, người mua). Nhấn "Lưu & Xem Trước" sau đó xuất và In.',
                                    icon: <SaveOutlined />
                                }
                            ]}
                        />

                        <Divider orientation="left">💡 Mẹo: Hệ thống tham số Auto-fill</Divider>
                        <Alert
                            message="Tự động điền dữ liệu"
                            description={
                                <ul style={{ marginBottom: 0 }}>
                                    <li><b>Bên bán (seller_xxx):</b> Tự động lấy cấu hình hệ thống (Settings -&gt; Thông tin DN) bao gồm MST, Người đại diện, Tài khoản ngân hàng. Tiết kiệm thời gian tự gõ.</li>
                                    <li><b>Khách hàng:</b> Lấy toàn bộ thông tin công ty, liên hệ từ hồ sơ khách hàng.</li>
                                    <li><b>Sản phẩm:</b> Tự động tính toán tổng tiền chữ và tiền số, in bảng chi tiết hàng hóa có trong đơn hàng này.</li>
                                </ul>
                            }
                            type="info"
                            showIcon
                        />
                    </div>
                );
            case 'finance-guide':
                return (
                    <div>
                        <Tag color="green" style={{ marginBottom: 16 }}>Modules: Finance</Tag>
                        <Title level={2}>💰 Quản lý Tài chính & Thu Chi</Title>
                        <Paragraph>
                            Phân hệ Tài chính giúp theo dõi dòng tiền, công nợ và sổ quỹ tiền mặt.
                            Bao gồm 4 Tab chính: <b>Thu, Chi, Báo Cáo Tài Chính</b> và <b>Danh Mục</b>.
                        </Paragraph>

                        <Divider orientation="left">I. Quản lý Thu / Chi</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card title="1. Tab Thu (Income)" size="small" bordered style={{ borderColor: '#b7eb8f' }}>
                                    <ul>
                                        <li>Quản lý danh sách các phiếu thu tiền.</li>
                                        <li><b>Tự động:</b> Khi khách hàng thanh toán cho đơn hàng (Sales Order).</li>
                                        <li><b>Thủ công:</b> Tạo phiếu thu khác (VD: Thu tiền thanh lý tài sản...).</li>
                                    </ul>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="2. Tab Chi (Expense)" size="small" bordered style={{ borderColor: '#ffa39e' }}>
                                    <ul>
                                        <li>Quản lý danh sách các phiếu chi tiền.</li>
                                        <li><b>Tự động:</b> Khi thanh toán cho nhà cung cấp (Purchase Order).</li>
                                        <li><b>Thủ công:</b> Tạo phiếu chi nội bộ (Tiền điện, nước, lương, tiếp khách...).</li>
                                    </ul>
                                </Card>
                            </Col>
                        </Row>

                        <Divider orientation="left">II. Hạch Toán & Báo Cáo</Divider>

                        <Card title={<span style={{ fontWeight: 'bold', color: '#1890ff' }}>📝 1. Quy trình Hạch toán (Accounting)</span>} style={{ marginBottom: 20 }}>
                            <Paragraph>
                                Để đảm bảo số liệu chính xác cho kế toán thuế và báo cáo lợi nhuận, các giao dịch cần được "Hạch toán".
                            </Paragraph>
                            <Steps
                                progressDot
                                current={-1}
                                items={[
                                    { title: 'Bước 1', description: 'Kế toán kiểm tra giao dịch tại Tab Thu hoặc Chi.' },
                                    { title: 'Bước 2', description: 'Nhấn nút "Hạch toán" trên dòng giao dịch.' },
                                    { title: 'Bước 3', description: 'Nhập "Số Hóa Đơn / Chứng Từ" và Ghi chú.' },
                                    { title: 'Hoàn tất', description: 'Giao dịch chuyển sang trạng thái "Đã HT" (Đã hạch toán).' },
                                ]}
                            />
                        </Card>

                        <Card title={<span style={{ fontWeight: 'bold', color: '#722ed1' }}>📊 2. Báo Cáo Tài Chính (Financial Report)</span>} style={{ marginBottom: 20 }}>
                            <Paragraph>
                                Tab "Báo Cáo Tài Chính" tổng hợp tất cả các giao dịch <b>ĐÃ ĐƯỢC HẠCH TOÁN</b>.
                            </Paragraph>
                            <ul>
                                <li><b>Bộ lọc linh hoạt:</b> Xem báo cáo theo <b>Tháng</b> hoặc <b>Năm</b>.</li>
                                <li><b>Chỉ số quan trọng:</b> Tự động tính toán <b>Tổng Thu</b>, <b>Tổng Chi</b> và <b>Lợi Nhuận (Profit)</b>.</li>
                                <li><b>Chi tiết:</b> Bảng kê chi tiết từng hóa đơn, chứng từ đã hạch toán.</li>
                            </ul>
                        </Card>
                    </div>
                );
            case 'finance-supplier-payment':
                return (
                    <div>
                        <Tag color="green" style={{ marginBottom: 16 }}>Modules: Finance</Tag>
                        <Title level={2}>🏢 Công Nợ & Thanh Toán PO Đối Tác</Title>
                        <Paragraph>
                            Hướng dẫn cách thanh toán nhiều PO (Đơn đặt hàng/Gia công) cho đối tác cùng một lúc và theo dõi công nợ.
                        </Paragraph>
                        
                        <Card title="1. Quản lý Công nợ" style={{ marginBottom: 16 }}>
                            <ul>
                                <li>Công nợ được tính <b>Real-time</b>: <code>Tổng giá trị các PO - Tổng số tiền đã trả</code>.</li>
                                <li>Vào <b>Đối tác / Nhà cung cấp</b>, chuyển sang tab <b>Công Nợ</b> để xem những bên đang còn nợ.</li>
                            </ul>
                        </Card>
                        
                        <Card title="2. Thanh toán Gộp (Bulk Payment)" style={{ marginBottom: 16 }}>
                            <ul>
                                <li>Nhấn nút <b>Thanh Toán</b> trên nhà cung cấp.</li>
                                <li>Chọn các PO muốn thanh toán. Nhập số tiền trả cho từng PO.</li>
                                <li>Hệ thống sẽ tự tạo <b>Phiếu Chi</b> gộp (BULK-PO) liên kết với các PO này và cập nhật số tiền đã trả cho mỗi PO.</li>
                            </ul>
                        </Card>
                    </div>
                );
            case 'finance-so-profit':
                return (
                    <div>
                        <Tag color="green" style={{ marginBottom: 16 }}>Modules: Finance</Tag>
                        <Title level={2}>📈 Lợi Nhuận Đơn Hàng (SO Profit)</Title>
                        <Paragraph>
                            Tính toán lợi nhuận cho từng Sales Order (Đơn hàng bán) sau khi hoàn tất quy trình giao hàng và xuất hóa đơn, trừ đi các khoản chi phí phát sinh.
                        </Paragraph>

                        <Divider orientation="left">Tự động hạch toán chi phí</Divider>
                        <Paragraph>
                            Hệ thống sẽ **tự động** sinh các giao dịch chi phí (EXPENSE) và phân bổ (allocate) trực tiếp vào báo cáo Lợi Nhuận SO trong các nghiệp vụ kho sau:
                        </Paragraph>
                        
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card title="1. Xuất NPL cho KHSX" size="small" bordered style={{ borderColor: '#ffd666' }}>
                                    <ul>
                                        <li>Khi Kế hoạch sản xuất (KHSX) xuất nguyên phụ liệu (NPL) từ kho để gia công.</li>
                                        <li>Hệ thống tính tổng giá trị NPL xuất kho theo <code>cost_price</code>.</li>
                                        <li>Tự động chia đều/tính theo tỷ lệ số lượng sản phẩm để phân bổ chi phí này cho các Đơn Hàng (SO) nằm trong KHSX.</li>
                                        <li>Nhãn tham chiếu: <b>GOODS_ISSUE_NPL</b>.</li>
                                    </ul>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="2. Xuất kho Bán hàng / Giao hàng" size="small" bordered style={{ borderColor: '#95de64' }}>
                                    <ul>
                                        <li>Khi thực hiện xuất kho giao sản phẩm cho khách hàng.</li>
                                        <li>Hệ thống tính Giá vốn hàng bán (COGS) dựa trên <code>cost_price</code> của thành phẩm xuất đi.</li>
                                        <li>Chi phí được phân bổ 100% vào mã Đơn hàng (SO) tương ứng.</li>
                                        <li>Nhãn tham chiếu: <b>GOODS_ISSUE_PRODUCT</b>.</li>
                                    </ul>
                                </Card>
                            </Col>
                        </Row>

                        <Alert
                            message="Lưu ý"
                            description="Vì hệ thống tự động ghi nhận chi phí thực tế (real expense) ngay khi có thao tác xuất kho, báo cáo SO Profit sẽ hiển thị chính xác lợi nhuận kể cả khi đơn hàng sử dụng NPL hoặc Sản phẩm có sẵn từ trong kho (không phát sinh PO mua hàng mới)."
                            type="info"
                            showIcon
                            style={{ marginTop: 16 }}
                        />
                    </div>
                );
            case 'finance-credits':
                return (
                    <div>
                        <Tag color="green" style={{ marginBottom: 16 }}>Modules: Finance</Tag>
                        <Title level={2}>💳 Quản lý Customer Credit (Tiền dư)</Title>
                        <Paragraph>
                            Cách xử lý khi khách hàng chuyển khoản dư tiền so với giá trị đơn hàng.
                        </Paragraph>
                        <Card>
                            <Steps direction="vertical">
                                <Step title="Ghi nhận trả dư" description="Khi khách thanh toán đơn hàng (Sales Order), nếu số tiền nhập vào lớn hơn số tiền còn lại, hệ thống sẽ hỏi bạn muốn 'Hoàn tiền' hay 'Tạo Credit'." />
                                <Step title="Lưu Credit" description="Chọn 'Tạo Credit', hệ thống sẽ lưu số dư vào Tài Khoản Credit của khách hàng đó." />
                                <Step title="Sử dụng Credit" description="Trong các lần thanh toán đơn hàng sau, có thể cấn trừ số dư Credit này vào đơn hàng." />
                            </Steps>
                        </Card>
                    </div>
                );
            case 'sales-approval':
                return (
                    <div>
                        <Tag color="gold" style={{ marginBottom: 16 }}>Quy trình kiểm soát chất lượng</Tag>
                        <Title level={2}>✅ Quy trình Duyệt Mẫu & Giao Hàng</Title>
                        <Paragraph>
                            Quy trình từ lúc chốt mẫu cho đến khi giao hàng hoàn tất.
                        </Paragraph>

                        <Steps
                            direction="vertical"
                            current={1}
                            items={[
                                {
                                    title: 'Bước 1: Gửi mẫu & Chờ phản hồi',
                                    description: 'Đơn hàng ở trạng thái "Chờ Duyệt Mẫu" (SO_PENDING). Sale gửi mẫu cho khách.',
                                },
                                {
                                    title: 'Bước 2: Khách hàng chốt mẫu',
                                    description: 'Khách xác nhận mẫu đạt yêu cầu.',
                                    icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                                },
                                {
                                    title: 'Bước 3: Xác nhận & Sản Xuất',
                                    description: 'Sale nhấn nút "Duyệt Mẫu" để chuyển sang trạng thái "Đang Sản Xuất" (IN_PRODUCTION).',
                                },
                                {
                                    title: 'Bước 4: Giao hàng (Shipping)',
                                    description: (
                                        <div>
                                            <Paragraph>Sản phẩm hoàn thiện sẽ được xuất kho giao cho khách:</Paragraph>
                                            <ul>
                                                <li><b>Giao 1 Phần (Partial Delivery):</b> Khi chỉ giao trước một số lượng nhỏ.</li>
                                                <li><b>Hoàn tất:</b> Khi đã giao đủ và thu đủ tiền.</li>
                                            </ul>
                                        </div>
                                    ),
                                    status: 'process',
                                },
                                {
                                    title: 'Bước 5: Thông báo Giao hàng (Email)',
                                    description: (
                                        <div>
                                            <Paragraph>Gửi email thông báo tự động cho khách hàng:</Paragraph>
                                            <ul>
                                                <li>Trong tab <b>Giao Hàng (Deliveries)</b>, nhấn nút <b>"Gửi Email"</b> <span style={{ fontSize: 10 }}>✉️</span>.</li>
                                                <li>Hệ thống gửi email chứa thông tin tài xế/đơn vị vận chuyển và link theo dõi.</li>
                                                <li>Trạng thái đơn hàng trên Portal chuyển thành <b>"Đang giao"</b> hoặc <b>"Đã giao"</b>.</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <RocketOutlined style={{ color: '#eb2f96' }} />
                                }
                            ]}
                        />

                        <Divider />
                        <Title level={3}>✅ Trợ lý Kiểm tra (Checklist)</Title>
                        <Paragraph>
                            Để đảm bảo không bỏ sót bước nào trong quy trình, mỗi đơn hàng sẽ có một <b>Checklist</b> tự động (Tab Checklist).
                        </Paragraph>
                        <Alert
                            message="Quy trình tự động"
                            description={
                                <ul>
                                    <li><b>Tự động tạo:</b> Checklist được tạo ngay khi mở đơn hàng.</li>
                                    <li><b>Tự động cập nhật:</b> Khi bạn đổi trạng thái đơn (VD: Từ Báo giá &rarr; Sản xuất), các việc cần làm mới sẽ tự động hiện ra.</li>
                                </ul>
                            }
                            type="info"
                            showIcon
                        />

                        <Divider />
                        <Title level={3}>📷 Tab 7: Mẫu SX Được Duyệt (Sample Images)</Title>
                        <Paragraph>
                            Tab mới cho phép quản lý hình ảnh mẫu sản xuất đã được khách hàng duyệt.
                        </Paragraph>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card title="Tính năng chính" size="small" bordered style={{ borderColor: '#91caff' }}>
                                    <ul>
                                        <li><b>Nhập URL Google Drive:</b> Tối đa 10 hình ảnh mẫu.</li>
                                        <li><b>Xem trước (Slideshow):</b> Carousel hiển thị các hình ảnh.</li>
                                        <li><b>Nút Duyệt mẫu SX:</b> Chuyển từ footer lên tab này.</li>
                                        <li><b>Ribbon Badge:</b> Hiện "✓ Đã duyệt" khi mẫu được approve.</li>
                                    </ul>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="Portal Khách Hàng" size="small" bordered style={{ borderColor: '#b7eb8f' }}>
                                    <ul>
                                        <li><b>Slideshow công khai:</b> Khách hàng xem được hình mẫu đã duyệt ngay trên Portal.</li>
                                        <li><b>Click phóng to:</b> Xem chi tiết từng hình ảnh.</li>
                                        <li><b>Minh bạch:</b> Khách biết chính xác mẫu sản xuất đã thống nhất.</li>
                                    </ul>
                                </Card>
                            </Col>
                        </Row>
                        <Alert
                            message="Hỗ trợ Google Drive"
                            description="Hệ thống tự động chuyển đổi link chia sẻ Google Drive (https://drive.google.com/file/d/xxx/view) thành link trực tiếp để hiển thị hình ảnh."
                            type="success"
                            showIcon
                            style={{ marginTop: 16 }}
                        />
                    </div>
                );
            case 'sales-portal':
                return (
                    <div>
                        <Tag color="purple" style={{ marginBottom: 16 }}>Tính năng nâng cao</Tag>
                        <Title level={2}>🌐 Customer Portal (Cổng Khách Hàng)</Title>
                        <Paragraph>
                            Customer Portal là trang web dành riêng cho khách hàng để xem chi tiết báo giá và tương tác với doanh nghiệp mà không cần đăng nhập.
                        </Paragraph>

                        <Divider orientation="left">Cách truy cập</Divider>
                        <Paragraph>
                            Mỗi đơn hàng có một đường dẫn (Link) duy nhất và bảo mật.
                            Bạn có thể lấy link này bằng cách nhấn nút <b>"Copy Link"</b> hoặc <b>"Xem Portal"</b> trên chi tiết đơn hàng.
                        </Paragraph>

                        <Divider orientation="left">Các tính năng chính</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Card title="1. Xem Báo Giá Online" bordered={false} style={{ background: '#f0f5ff' }}>
                                    <Paragraph>
                                        Hiển thị bảng báo giá chuyên nghiệp với đầy đủ hình ảnh, mô tả kỹ thuật và giá tiền.
                                        Tương thích tốt trên cả điện thoại và máy tính.
                                    </Paragraph>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card title="2. Tương Tác Hai Chiều" bordered={false} style={{ background: '#f6ffed' }}>
                                    <Paragraph>
                                        Khách hàng có thể để lại bình luận/câu hỏi ngay trên từng báo giá.
                                        Nút <b>"Đồng ý"</b> hoặc <b>"Từ chối"</b> giúp chốt đơn nhanh chóng.
                                    </Paragraph>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card title="3. Thanh Toán QR" bordered={false} style={{ background: '#fff7e6' }}>
                                    <Paragraph>
                                        Tích hợp mã QR VietQR động. Khách hàng chỉ cần mở app ngân hàng quét mã để chuyển khoản chính xác số tiền.
                                    </Paragraph>
                                </Card>
                            </Col>
                        </Row>

                        <Title level={4} style={{ marginTop: 30 }}>Lưu ý quan trọng</Title>
                        <Alert
                            message="Bảo mật liên kết"
                            description="Link Portal chứa thông tin cá nhân của khách hàng. Chỉ chia sẻ link này cho đúng người mua hàng."
                            type="warning"
                            showIcon
                        />
                    </div>
                );
            case 'price-list':
                return (
                    <div>
                        <Tag color="magenta" style={{ marginBottom: 16 }}>Kiểm soát & Chiến lược</Tag>
                        <Title level={2}>💲 Chính sách giá & Kiểm soát lợi nhuận</Title>
                        <Paragraph>
                            Module PriceList giúp doanh nghiệp thiết lập các quy tắc về giá bán để đảm bảo biên lợi nhuận (Margin) và cung cấp chính sách giá sỉ (Tiered Pricing) nhất quán cho nhân viên kinh doanh.
                        </Paragraph>

                        <Divider orientation="left">I. Cấu trúc bảng giá</Divider>
                        <Row gutter={[24, 24]}>
                            <Col span={12}>
                                <Card title="1. Thông tin chung (Header)" size="small" bordered>
                                    <ul>
                                        <li><b>Tên bảng giá:</b> Ví dụ "Bảng giá Đại lý cấp 1", "Giá bán lẻ 2024".</li>
                                        <li><b>Hiệu lực:</b> Thiết lập ngày bắt đầu và kết thúc (Valid From - To).</li>
                                        <li><b>Nhóm khách hàng:</b> Áp dụng bảng giá cụ thể cho từng nhóm đối tượng.</li>
                                    </ul>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="2. Quy tắc chi tiết (Rules)" size="small" bordered>
                                    <ul>
                                        <li><b>Theo SKU:</b> Mỗi dòng hàng có quy tắc riêng.</li>
                                        <li><b>Giá sàn (Min Price):</b> Mức giá thấp nhất nhân viên được phép bán.</li>
                                        <li><b>Giới hạn Margin:</b> Cảnh báo nếu biên lợi nhuận thấp hơn mức quy định (VD: dưới 15%).</li>
                                    </ul>
                                </Card>
                            </Col>
                        </Row>

                        <Divider orientation="left">II. Các tính năng chính</Divider>

                        <Card title={<span style={{ fontWeight: 'bold', color: '#cf1322' }}>🛑 1. Kiểm soát giá sàn (Floor Price Control)</span>} style={{ marginBottom: 20 }}>
                            <Paragraph>
                                Hệ thống sẽ tự động chặn hoặc cảnh báo khi nhân viên kinh doanh nhập đơn giá thấp hơn mức quy định.
                            </Paragraph>
                            <Alert
                                message="Cơ chế hoạt động"
                                description={
                                    <ul style={{ marginBottom: 0 }}>
                                        <li>Nếu <b>Giá bán &lt; Min Price</b>: Hệ thống báo lỗi và không cho lưu đơn hàng.</li>
                                        <li>Nếu <b>Lợi nhuận gộp (Margin) &lt; Min Margin %</b>: Cần xin phê duyệt từ quản lý (Tính năng nâng cao).</li>
                                    </ul>
                                }
                                type="error"
                            />
                        </Card>

                        <Card title={<span style={{ fontWeight: 'bold', color: '#52c41a' }}>📊 2. Bảng giá theo số lượng (Tiered Pricing)</span>} style={{ marginBottom: 20 }}>
                            <Paragraph>
                                Hỗ trợ nhân viên báo giá nhanh dựa trên mốc số lượng đặt hàng chuẩn.
                            </Paragraph>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #f0f0f0' }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa' }}>
                                            <th style={{ padding: 10, border: '1px solid #f0f0f0' }}>SKU</th>
                                            <th style={{ padding: 10, border: '1px solid #f0f0f0', color: '#666' }}>Giá SL 30</th>
                                            <th style={{ padding: 10, border: '1px solid #f0f0f0', color: '#1890ff' }}>Giá SL 50</th>
                                            <th style={{ padding: 10, border: '1px solid #f0f0f0', color: '#52c41a' }}>Giá SL 100+</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: 10, border: '1px solid #f0f0f0', fontWeight: 'bold' }}>IPHONE-15-PRO</td>
                                            <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>28.500.000</td>
                                            <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>28.200.000</td>
                                            <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>27.900.000</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: 10, fontSize: 13, color: '#888', fontStyle: 'italic' }}>
                                * Hệ thống gợi ý giá này khi tạo báo giá, nhân viên có thể điều chỉnh nhưng không được thấp hơn giá sàn.
                            </div>
                        </Card>

                        <Divider />
                        <Title level={4}>Hướng dẫn thiết lập</Title>
                        <Steps
                            current={-1}
                            items={[
                                { title: 'Bước 1', description: 'Vào menu Sales ➔ Price List.' },
                                { title: 'Bước 2', description: 'Tạo bảng giá mới (Header).' },
                                { title: 'Bước 3', description: 'Import file Excel danh sách quy tắc hoặc nhập tay từng SKU.' },
                                { title: 'Bước 4', description: 'Kích hoạt "Active" để áp dụng ngay lập tức.' },
                            ]}
                        />
                    </div>
                );
            case 'sales-revisions':
                return (
                    <div>
                        <Tag color="orange" style={{ marginBottom: 16 }}>Tính năng mới</Tag>
                        <Title level={2}>🕒 Quản lý Phiên bản Báo giá (Revisions)</Title>
                        <Paragraph>
                            Tính năng này giúp nhân viên kinh doanh lưu lại lịch sử các lần thay đổi báo giá gửi cho khách hàng.
                            Bạn có thể tạo nhiều phiên bản (Version) cho cùng một mã báo giá mà không cần tạo đơn mới.
                        </Paragraph>

                        <Divider orientation="left">Quy trình thực hiện</Divider>
                        <Steps
                            current={-1}
                            direction="vertical"
                            items={[
                                {
                                    title: 'Bước 1: Tạo Báo Giá (Draft)',
                                    description: 'Tạo báo giá như bình thường. Trạng thái là "QUOTATION".',
                                    icon: <SolutionOutlined />,
                                },
                                {
                                    title: 'Bước 2: Tạo Phiên bản mới (Snapshot)',
                                    description: (
                                        <div>
                                            <Paragraph>
                                                Khi cần chỉnh sửa (VD: Khách muốn đổi số lượng hoặc thêm sản phẩm):
                                            </Paragraph>
                                            <ul>
                                                <li>Nhấn nút <b>"Tạo Version Mới" <CopyOutlined /></b> trên giao diện chi tiết đơn hàng.</li>
                                                <li>Hệ thống sẽ lưu lại toàn bộ dữ liệu hiện tại vào "Lịch sử".</li>
                                                <li>Số phiên bản (Version) sẽ tự động tăng lên (v1 ➔ v2).</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <CopyOutlined />,
                                },
                                {
                                    title: 'Bước 3: Xem lại lịch sử',
                                    description: 'Nhấn nút "Lịch sử" <HistoryOutlined /> để xem lại thông tin cũ. Bạn có thể xem chi tiết từng phiên bản để đối chiếu.',
                                    icon: <HistoryOutlined />,
                                }
                            ]}
                        />

                        <Alert
                            message="Lưu ý quan trọng"
                            description="Chỉ có thể tạo Revision khi đơn hàng đang ở trạng thái Báo Giá (Quotation). Khi đã chuyển thành Đơn hàng (SO) huỷ hoặc hoàn tất, tính năng này sẽ bị khóa để đảm bảo tính toàn vẹn dữ liệu."
                            type="warning"
                            showIcon
                            style={{ marginTop: 24 }}
                        />
                    </div>
                );
            case 'booking-stock':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Tính năng mới</Tag>
                        <Title level={2}>🔒 Quy trình Giữ Kho (Booking Stock)</Title>
                        <Paragraph>
                            Tính năng Giữ kho giúp Sales "xí phần" trước các sản phẩm đang có sẵn trong kho để đảm bảo không bị Sales khác bán mất, đồng thời giúp Planning Manager có cái nhìn chính xác về tồn kho thực tế khi lập kế hoạch sản xuất.
                        </Paragraph>

                        <Divider orientation="left">I. Ý nghĩa các chỉ số tồn kho</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Card size="small" bordered style={{ borderColor: '#d9d9d9' }}>
                                    <Title level={5} style={{ margin: 0 }}>📦 Tồn kho thật</Title>
                                    <Paragraph style={{ marginTop: 8 }}>Số lượng thực tế đang nằm trên kệ trong kho.</Paragraph>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small" bordered style={{ borderColor: '#fa8c16' }}>
                                    <Title level={5} style={{ color: '#d46b08', margin: 0 }}>🔒 Đã Booking</Title>
                                    <Paragraph style={{ marginTop: 8 }}>Số lượng đang được giữ chỗ chờ giao hàng.</Paragraph>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small" bordered style={{ borderColor: '#52c41a' }}>
                                    <Title level={5} style={{ color: '#389e0d', margin: 0 }}>✅ Khả dụng</Title>
                                    <Paragraph style={{ marginTop: 8 }}>Tồn kho thật - Đã Booking. Đây là số lượng Sales <b>được phép bán tiếp</b>.</Paragraph>
                                </Card>
                            </Col>
                        </Row>

                        <Divider orientation="left">II. Luồng phối hợp Sales & Planning</Divider>
                        <Steps
                            current={-1}
                            direction="vertical"
                            items={[
                                {
                                    title: 'Bước 1: Sales tạo đơn và "Giữ kho"',
                                    description: (
                                        <div>
                                            <Paragraph>Sau khi tạo đơn hàng thành công, Sales nhấn nút <b>"Giữ kho" <ShoppingCartOutlined /></b> trên chi tiết đơn hàng.</Paragraph>
                                            <ul>
                                                <li>Hệ thống sẽ kiểm tra Tồn kho khả dụng. Nếu đủ, trạng thái chuyển thành <Tag color="orange">Giữ chỗ (TEMPORARY)</Tag>.</li>
                                                <li>Lúc này, tồn kho khả dụng của sản phẩm đó sẽ giảm xuống.</li>
                                                <li><b>Lưu ý:</b> Trạng thái TEMPORARY chỉ có hiệu lực trong <b>5 ngày</b>. Nếu sau 5 ngày không được Planning duyệt, hệ thống tự động hủy giữ kho.</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <ShoppingCartOutlined />,
                                },
                                {
                                    title: 'Bước 2: Planning Manager duyệt Kế Hoạch',
                                    description: (
                                        <div>
                                            <Paragraph>Khi lập kế hoạch sản xuất (Gom đơn), Planning Manager sẽ thấy các đơn hàng có yêu cầu giữ kho.</Paragraph>
                                            <ul>
                                                <li>Nhấn nút <b>"Duyệt Book"</b> trên danh sách Kế hoạch.</li>
                                                <li>Trạng thái giữ chỗ của toàn bộ sản phẩm trong kế hoạch đó chuyển sang <Tag color="green">Đã duyệt (CONFIRMED)</Tag>.</li>
                                                <li>Lúc này, lượng hàng tồn kho được khóa vĩnh viễn cho đơn hàng đó.</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <CheckCircleOutlined />,
                                },
                                {
                                    title: 'Bước 3: Kho thực hiện Giao hàng',
                                    description: (
                                        <div>
                                            <Paragraph>Trong giao diện tạo Phiếu Xuất Kho (Deliveries):</Paragraph>
                                            <ul>
                                                <li>Hệ thống <b>chỉ cho phép</b> xuất kho những sản phẩm có trạng thái là <Tag color="green">Sẵn sàng (CONFIRMED)</Tag>.</li>
                                                <li>Khi xuất kho thành công, hệ thống sẽ trừ cả <b>Tồn kho thật</b> và <b>Đã Booking</b>, trả lại trạng thái cân bằng.</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <TruckOutlined />,
                                }
                            ]}
                        />
                    </div>
                );
            case 'sales-pos':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Bán lẻ & Cửa hàng</Tag>
                        <Title level={2}>🏪 Bán Lẻ Tại Quầy (POS)</Title>
                        <Paragraph>
                            Giao diện POS (Point of Sale) được thiết kế tối giản để nhân viên bán hàng thao tác nhanh chóng, chính xác ngay tại quầy thu ngân.
                        </Paragraph>

                        <Row gutter={16}>
                            <Col span={16}>
                                <Card title="Quy trình Bán hàng POS" bordered={false} style={{ background: '#f9f9f9' }}>
                                    <Steps
                                        current={-1}
                                        items={[
                                            { title: 'Chọn Hàng', description: 'Quét mã vạch hoặc tìm tên.', icon: <SearchOutlined /> },
                                            { title: 'Giỏ Hàng', description: 'Điều chỉnh số lượng.', icon: <ShoppingCartOutlined /> },
                                            { title: 'Khách Hàng', description: 'Chọn thành viên (nếu có).', icon: <UserOutlined /> },
                                            { title: 'Thanh Toán', description: 'Xuất phiếu thu ngay lập tức.', icon: <WalletOutlined /> },
                                        ]}
                                    />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Alert
                                    message="Kiểm soát Tồn kho"
                                    description="Hệ thống tự động chặn không cho thêm vào giỏ hàng đối với các sản phẩm có Tồn kho < 0 để tránh bán âm."
                                    type="error"
                                    showIcon
                                />
                            </Col>
                        </Row>

                        <Divider orientation="left">Các tính năng chính</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Card size="small" title="1. Tra cứu thông minh">
                                    Hỗ trợ tìm kiếm theo <b>Tên, SKU</b> hoặc <b>Barcode</b>. Hiển thị ngay hình ảnh sản phẩm và giá bán để nhân viên dễ tư vấn.
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small" title="2. Quản lý Khách lẻ">
                                    Mặc định là "Khách lẻ". Bạn có thể chọn khách hàng thành viên để tích điểm hoặc áp dụng chính sách giá riêng.
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small" title="3. Xử lý nhanh">
                                    Thanh toán 1 chạm. Đơn hàng sau khi hoàn tất sẽ tự động chuyển trạng thái <b>COMPLETED</b> và trừ tồn kho ngay lập tức.
                                </Card>
                            </Col>
                        </Row>
                    </div>
                );
            case 'customers':
                return (
                    <div>
                        <Tag color="geekblue" style={{ marginBottom: 16 }}>CRM & Công Nợ</Tag>
                        <Title level={2}>👥 Quản lý Khách hàng</Title>
                        <Paragraph>
                            Phân hệ Khách hàng giúp lưu trữ tập trung thông tin đối tác, lịch sử mua hàng và theo dõi công nợ chi tiết.
                        </Paragraph>

                        <Divider orientation="left">Thông tin chi tiết</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card title="1. Hồ sơ khách hàng" size="small" bordered>
                                    <ul>
                                        <li><b>Thông tin cơ bản:</b> Tên công ty, MST, Địa chỉ, SĐT.</li>
                                        <li><b>Người liên hệ:</b> Danh sách nhiều người liên hệ (Kế toán, Mua hàng...) để tiện gửi mail/gọi điện.</li>
                                        <li><b>Ghi chú nội bộ:</b> Lưu lại các đặc thù của khách (VD: "Khách khó tính", "Chỉ giao giờ hành chính").</li>
                                    </ul>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="2. Theo dõi Công nợ" size="small" bordered>
                                    <ul>
                                        <li><b>Hạn mức nợ (Credit Limit):</b> Cảnh báo khi khách mua vượt mức tín dụng cho phép.</li>
                                        <li><b>Số ngày được nợ (Payment Terms):</b> Quy định thời hạn thanh toán (VD: Net 30).</li>
                                        <li><b>Lịch sử:</b> Xem lại toàn bộ đơn hàng và phiếu thu của khách đó.</li>
                                    </ul>
                                </Card>
                            </Col>
                        </Row>

                        <div style={{ marginTop: 20 }}>
                            <Alert
                                message="Mẹo quản lý"
                                description="Bạn nên nhập đầy đủ thông tin 'Người liên hệ' (Email/Zalo) để hệ thống có thể tự động gửi thông báo hoặc Báo giá sau này."
                                type="info"
                                showIcon
                            />
                        </div>
                    </div>
                );
            case 'reminders':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Chăm sóc khách hàng</Tag>
                        <Title level={2}>⏰ Nhắc việc & Trao đổi nội bộ</Title>
                        <Paragraph>
                            Tính năng giúp bạn không bỏ lỡ các đầu việc quan trọng với khách hàng (Gọi điện, Gửi mẫu, Đòi nợ...).
                        </Paragraph>

                        <Steps
                            direction="vertical"
                            current={-1}
                            items={[
                                {
                                    title: 'Bước 1: Tạo nhắc nhở',
                                    description: 'Tại màn hình chi tiết Khách hàng hoặc Đơn hàng, nhấn vào tab "Hoạt động / Activity". Chọn "Thêm nhắc nhở".',
                                    icon: <PlusOutlined />
                                },
                                {
                                    title: 'Bước 2: Thiết lập thời gian',
                                    description: 'Chọn ngày giờ cụ thể và nội dung công việc (VD: "Gọi lại chốt đơn lúc 14h").',
                                    icon: <HistoryOutlined />
                                },
                                {
                                    title: 'Bước 3: Nhận thông báo',
                                    description: 'Đến giờ hẹn, hệ thống sẽ hiện thông báo (Notification) trên thanh menu để nhắc bạn.',
                                    icon: <BellOutlined />
                                },
                                {
                                    title: 'Bước 4: Đánh dấu hoàn thành',
                                    description: 'Sau khi thực hiện xong, hãy tích vào ô "Hoàn thành" để đóng nhắc nhở.',
                                    icon: <CheckCircleOutlined />
                                }
                            ]}
                        />
                    </div>
                );
            case 'mrp-overview':
                return (
                    <div>
                        <Tag color="volcano" style={{ marginBottom: 16 }}>Sản Xuất & Kho</Tag>
                        <Title level={2}>🏭 Quản lý Nhu Cầu Nguyên Liệu (MRP)</Title>
                        <Paragraph>
                            Phân hệ Planning giúp tính toán tự động nhu cầu nguyên vật liệu (Material) và gia công (Outsourcing) dựa trên các đơn hàng bán (Sales Orders).
                        </Paragraph>

                        <Divider orientation="left">I. Quy trình vận hành MRP</Divider>
                        <Steps
                            current={-1}
                            direction="vertical"
                            items={[
                                {
                                    title: 'Bước 1: Gom đơn hàng (Planning)',
                                    description: 'Tại màn hình Sales Order, chọn các đơn hàng "Đã duyệt mẫu" để lập thành một Kế hoạch Sản xuất (Purchase Plan).',
                                    icon: <ProjectOutlined />
                                },
                                {
                                    title: 'Bước 2: Phân tích MRP (Analysis)',
                                    description: (
                                        <div>
                                            <ul>
                                                <li><b>Nguyên liệu (BOM):</b> Hệ thống bóc tách BOM để tính tổng lượng vải/phụ liệu cần thiết.</li>
                                                <li><b>Gia công (Routing):</b> Dựa trên quy trình (Cắt &rarr; May &rarr; Ủi) để tính chi phí và số lượng cần thuê ngoài.</li>
                                                <li><b>Cân đối kho:</b> <i>Cần mua = Tổng nhu cầu - (Tồn kho thực tế - Đang giữ chỗ)</i>.</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <ExperimentOutlined />
                                },
                                {
                                    title: 'Bước 3: Tạo Đơn Mua Hàng (PO)',
                                    description: (
                                        <ul>
                                            <li>Dựa trên kết quả phân tích, nhấn "Tạo PO" để hệ thống tự động sinh ra các đơn hàng nháp.</li>
                                            <li><b>Lưu ý:</b> PO được tách tự động theo Nhà cung cấp (Supplier).</li>
                                        </ul>
                                    ),
                                    icon: <AppstoreAddOutlined />
                                }
                            ]}
                        />

                        <Divider orientation="left">II. Tính năng Gộp Đơn (Pooled Order)</Divider>
                        <Alert
                            message="Tại sao cần gộp đơn?"
                            description="Thay vì gửi 10 đơn lẻ lắt nhắt cho cùng 1 nhà cung cấp, bạn có thể gộp chúng lại thành 1 đơn lớn để dễ theo dõi và vận chuyển."
                            type="info"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />

                        <Card title="Hướng dẫn tạo PO Gộp" size="small" bordered>
                            <Steps
                                progressDot
                                current={-1}
                                items={[
                                    {
                                        title: 'Bước 1: Chốt đơn lẻ',
                                        description: 'Đảm bảo các PO con (NPL hoặc Gia công) đã ở trạng thái "Đã đặt hàng" (ORDERED).'
                                    },
                                    {
                                        title: 'Bước 2: Vào Tab Tổng Hợp',
                                        description: 'Truy cập menu Purchasing &rarr; Tab "Tổng Hợp Nhu Cầu NPL" (hoặc GC).'
                                    },
                                    {
                                        title: 'Bước 3: Chọn & Gộp',
                                        description: 'Tích chọn nhiều PO cùng loại &rarr; Nhấn nút "+ Tạo PO Gộp" &rarr; Chọn Nhà cung cấp tổng.'
                                    },
                                    {
                                        title: 'Bước 4: Theo dõi',
                                        description: 'PO Gộp mới sẽ xuất hiện ở Tab "PO Gộp" với danh sách các PO con bên trong.'
                                    }
                                ]}
                            />
                        </Card>

                        <Divider orientation="left">III. Thuật ngữ quan trọng</Divider>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Card size="small" title="BOM (Bill of Materials)">
                                    Định mức nguyên vật liệu. Quy định 1 sản phẩm cần bao nhiêu vải, chỉ, nút...
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small" title="Wastage (Hao hụt)">
                                    % nguyên liệu dư thừa dự kiến trong quá trình sản xuất (VD: cắt vải vụn).
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small" title="Routing (Quy trình)">
                                    Thứ tự các bước gia công (Cắt &rarr; In &rarr; May). Mỗi bước có thể làm tại xưởng hoặc gửi ngoài.
                                </Card>
                            </Col>
                        </Row>
                    </div>
                );
            case 'product-guide':
                return (
                    <div>
                        <Tag color="geekblue" style={{ marginBottom: 16 }}>Kho & Sản Phẩm</Tag>
                        <Title level={2}>🧬 Cấu trúc Sản phẩm & Biến thể</Title>
                        <Paragraph>
                            ERP4U sử dụng mô hình sản phẩm cha-con (Master-Variant) để quản lý hàng hóa có nhiều thuộc tính (Màu sắc, kích thước...).
                        </Paragraph>

                        <Row gutter={24}>
                            <Col span={12}>
                                <Card title="Mô hình phân cấp (Hierarchy)" size="small">
                                    <Tree
                                        showLine
                                        showIcon
                                        defaultExpandAll
                                        treeData={[
                                            {
                                                title: <Text strong>Áo Thun Basic (Master Product)</Text>,
                                                key: '0-0',
                                                icon: <DatabaseOutlined />,
                                                children: [
                                                    {
                                                        title: 'Thuộc tính: Màu sắc (Color)',
                                                        key: '0-0-0',
                                                        icon: <TagsOutlined />,
                                                        children: [
                                                            { title: 'Đỏ (Red)', key: '0-0-0-0' },
                                                            { title: 'Xanh (Blue)', key: '0-0-0-1' },
                                                        ],
                                                    },
                                                    {
                                                        title: 'Thuộc tính: Size',
                                                        key: '0-0-1',
                                                        icon: <TagsOutlined />,
                                                        children: [
                                                            { title: 'Size M', key: '0-0-1-0' },
                                                            { title: 'Size L', key: '0-0-1-1' },
                                                        ],
                                                    },
                                                    {
                                                        title: 'Thuộc tính: Logo',
                                                        key: '0-0-2',
                                                        icon: <TagsOutlined />,
                                                        children: [
                                                            { title: 'NIKE', key: '0-0-2-0' },
                                                            { title: 'ADIDAS', key: '0-0-2-1' },
                                                        ],
                                                    },
                                                    {
                                                        title: <Text type="success" strong>Biến thể (Variants - SKU)</Text>,
                                                        key: '0-0-3',
                                                        icon: <BranchesOutlined />,
                                                        children: [
                                                            { title: 'Áo Thun - Đỏ - Size M (AT-RED-M)', key: '0-0-3-0', isLeaf: true },
                                                            { title: 'Áo Thun - Đỏ - Size L (AT-RED-L)', key: '0-0-3-1', isLeaf: true },
                                                            { title: 'Áo Thun - Xanh - Size M (AT-BLUE-M)', key: '0-0-3-2', isLeaf: true },
                                                        ],
                                                    },
                                                ],
                                            },
                                        ]}
                                    />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Alert
                                    message="Giải thích thuật ngữ"
                                    description={
                                        <ul>
                                            <li><b>Master Product:</b> Sản phẩm đại diện, chứa thông tin chung (Tên, Mô tả, Quy trình). Không dùng để bán/tồn kho trực tiếp.</li>
                                            <li><b>Attributes:</b> Các thuộc tính biến đổi (Màu, Size, Chất liệu).</li>
                                            <li><b>Variant (SKU):</b> Sản phẩm thực tế được sinh ra từ việc tổ hợp các thuộc tính. Đây là đối tượng để quản lý Tồn kho và Giá bán.</li>
                                        </ul>
                                    }
                                    type="info"
                                    showIcon
                                />
                            </Col>
                        </Row>
                    </div>
                );
            case 'combo-guide':
                return (
                    <div>
                        <Tag color="purple" style={{ marginBottom: 16 }}>Chiến lược bán hàng</Tag>
                        <Title level={2}>🎁 Cấu trúc & Quy trình Combo</Title>
                        <Paragraph>
                            Combo (Gói sản phẩm) là một mã hàng ảo, được cấu thành từ nhiều sản phẩm đơn lẻ khác nhau.
                            Khi bán Combo, kho sẽ trừ tồn của các sản phẩm thành phần.
                        </Paragraph>

                        <Divider orientation="left">Sơ đồ cấu tạo</Divider>
                        <div style={{ textAlign: 'center', padding: 20, background: '#f5f5f5', borderRadius: 8 }}>
                            <Row align="middle" justify="center" gutter={16}>
                                <Col>
                                    <Card size="small" style={{ width: 180, borderColor: '#722ed1' }}>
                                        <GiftOutlined style={{ fontSize: 24, color: '#722ed1', marginBottom: 8 }} />
                                        <div><b>Combo Tết 2024</b></div>
                                        <div style={{ fontSize: 12, color: '#888' }}>(SKU: CBT24)</div>
                                    </Card>
                                </Col>
                                <Col>
                                    <BranchesOutlined style={{ fontSize: 24, color: '#999', transform: 'rotate(90deg)' }} />
                                </Col>
                                <Col>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <Card size="small" style={{ width: 200 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Bánh Quy (x2)</span>
                                                <Tag color="blue">SKU: BQ01</Tag>
                                            </div>
                                        </Card>
                                        <Card size="small" style={{ width: 200 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Rượu Vang (x1)</span>
                                                <Tag color="blue">SKU: RV01</Tag>
                                            </div>
                                        </Card>
                                    </div>
                                </Col>
                            </Row>
                        </div>

                        <Divider orientation="left">Lưu ý khi vận hành</Divider>
                        <Steps
                            current={-1}
                            items={[
                                { title: 'Tạo Combo', description: 'Vào menu Sản phẩm -> Tạo mới -> Chọn loại "Combo".' },
                                { title: 'Chọn thành phần', description: 'Add các SKU đơn lẻ và số lượng tương ứng.' },
                                { title: 'Giá vốn (COGS)', description: 'Tự động tính bằng Tổng giá vốn các thành phần.' },
                                { title: 'Tồn kho', description: 'Combo không có tồn kho riêng. Số lượng khả dụng = Min(Tồn kho thành phần / Định mức).' },
                            ]}
                        />
                    </div>
                );
            case 'inventory-guide':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Quản lý Kho</Tag>
                        <Title level={2}>📦 Quản lý Kho & Quy đổi Đơn vị (Unit Conversion)</Title>
                        <Paragraph>
                            ERP4U hỗ trợ quản lý đa đơn vị tính cho Nguyên vật liệu (NPL), giúp doanh nghiệp dễ dàng nhập kho theo quy cách mua hàng và xuất kho theo quy cách sản xuất.
                        </Paragraph>

                        <Divider orientation="left">I. Khái niệm cơ bản</Divider>
                        <Row gutter={16} style={{ marginBottom: 20 }}>
                            <Col span={8}>
                                <Card title="Đơn vị Cơ sở (Base Unit)" size="small" bordered>
                                    <Text type="secondary">Là đơn vị nhỏ nhất dùng để tính toán tồn kho và BOM.</Text>
                                    <div style={{ marginTop: 8 }}><b>Ví dụ:</b> Mét (m), Gram (g), Cái (pcs).</div>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card title="Đơn vị Mua (Purchase Unit)" size="small" bordered>
                                    <Text type="secondary">Là đơn vị khi đặt hàng từ nhà cung cấp.</Text>
                                    <div style={{ marginTop: 8 }}><b>Ví dụ:</b> Cây (Roll), Bao (Bag), Thùng.</div>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card title="Hệ số Quy đổi (Factor)" size="small" bordered>
                                    <Text type="secondary">Tỷ lệ chuyển đổi giữa đơn vị mua và đơn vị cơ sở.</Text>
                                    <div style={{ marginTop: 8 }}><b>Ví dụ:</b> 1 Cây = 50 Mét <br />(Factor = 50).</div>
                                </Card>
                            </Col>
                        </Row>

                        <Divider orientation="left">II. Công thức quy đổi (Formula)</Divider>
                        <Alert
                            message="Nguyên tắc tính toán"
                            description={
                                <div>
                                    <Paragraph>
                                        Hệ thống luôn quy đổi mọi giao dịch về <b>Đơn vị Cơ sở</b> để ghi nhận vào kho.
                                    </Paragraph>
                                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                                        <li style={{ marginBottom: 10 }}>
                                            <CalculatorOutlined style={{ color: '#eb2f96', marginRight: 8 }} />
                                            <b>Số lượng Tồn kho (Base)</b> = <Text code>Số lượng Nhập (Mua)</Text> × <Text code>Hệ số quy đổi</Text>
                                        </li>
                                        <li>
                                            <DollarOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                                            <b>Giá vốn (Base Cost)</b> = <Text code>Giá mua (Đơn vị mua)</Text> ÷ <Text code>Hệ số quy đổi</Text>
                                        </li>
                                    </ul>
                                </div>
                            }
                            type="success"
                            showIcon
                            icon={<ExperimentOutlined />}
                        />

                        <Divider orientation="left">III. Ví dụ minh họa</Divider>
                        <Card style={{ background: '#fafafa' }}>
                            <Descriptions title="Nhập kho Vải Thun (Mã: V01)" bordered column={1}>
                                <Descriptions.Item label="Thiết lập Ban đầu">
                                    Đơn vị cơ sở: <b>Mét (m)</b> <br />
                                    Đơn vị mua: <b>Cây (Roll)</b> <br />
                                    Hệ số (Conversion Factor): <b>40</b> (Tức là 1 Cây = 40 Mét)
                                </Descriptions.Item>
                                <Descriptions.Item label="Giao dịch Nhập hàng">
                                    Nhập: <b>10 Cây</b> <br />
                                    Đơn giá mua: <b>100.000đ / Cây</b>
                                </Descriptions.Item>
                                <Descriptions.Item label="Kết quả trong Kho">
                                    Tồn kho tăng thêm: 10 * 40 = <b>400 Mét</b> <br />
                                    Giá vốn bình quân: 100.000 / 40 = <b>2.500đ / Mét</b>
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                    </div>
                );
            case 'supplier-stock':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Quản lý Kho / Gia Công</Tag>
                        <Title level={2}>🏭 Quy trình Quản lý Tồn kho NPL tại Nhà Gia Công</Title>
                        <Paragraph>
                            Khi thuê gia công ngoài, hệ thống ERP4U cho phép theo dõi sát sao lượng nguyên phụ liệu (NPL) bạn đã giao cho xưởng, lượng NPL xưởng đã tiêu hao để sản xuất thành phẩm, và số dư (Live Balance) còn lại ngay tại xưởng gia công. Quy trình này hoàn toàn tự động dựa trên phiếu xuất/nhập kho.
                        </Paragraph>

                        <Divider orientation="left">I. Quy trình tự động hóa Tồn Kho NCC</Divider>
                        <Steps
                            direction="vertical"
                            current={-1}
                            items={[
                                {
                                    title: <Text strong>Bước 1: Giao NPL cho xưởng (Cộng tồn NCC)</Text>,
                                    description: (
                                        <ul>
                                            <li>Vào module <b>Kho Vận</b> &rarr; Tab <b>Phiếu Xuất NPL (Gia Công)</b>.</li>
                                            <li>Xác nhận xuất kho cho các yêu cầu gia công (Trạng thái chuyển sang Đã duyệt).</li>
                                            <li>Khi NPL được xác nhận <b>"Đã giao NCC"</b>, hệ thống tự động: <Text type="danger">Trừ tồn kho Nhà máy</Text> và <Text type="success">Cộng vào Tồn kho NCC</Text>.</li>
                                        </ul>
                                    ),
                                    icon: <CarOutlined style={{ color: '#1890ff' }} />
                                },
                                {
                                    title: <Text strong>Bước 2: Nhập kho Thành phẩm (Trừ tồn NCC)</Text>,
                                    description: (
                                        <ul>
                                            <li>Khi xưởng gia công xong và giao thành phẩm (TP) về, bạn làm <b>Phiếu Nhập Kho Thành Phẩm</b>.</li>
                                            <li>Hệ thống sẽ dựa vào cấu trúc sản phẩm (BOM) để tự động tính toán lượng NPL đã tiêu hao.</li>
                                            <li>Kết quả: <Text type="success">Cộng Tồn kho TP tại Nhà máy</Text> và <Text type="danger">Trừ tự động NPL tại kho NCC</Text> theo đúng định mức.</li>
                                        </ul>
                                    ),
                                    icon: <InboxOutlined style={{ color: '#52c41a' }} />
                                }
                            ]}
                        />

                        <Divider orientation="left">II. Tính năng theo dõi</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card title="1. Dashboard Lập Kế Hoạch (MRP)" size="small" bordered style={{ borderColor: '#fa8c16' }}>
                                    <ul>
                                        <li>Tại màn hình <b>Lập Kế Hoạch (Planning)</b>, hệ thống sẽ gộp chung <b>Tồn Kho Nhà Máy</b> và <b>Tồn Kho NCC</b> khi tính toán lượng hàng sẵn có.</li>
                                        <li>Cột <b>"Tồn Kho NCC"</b> (màu hồng) hiển thị rõ ràng số lượng NPL còn đang gửi ở xưởng gia công để Planner quyết định <b>"Cần Mua"</b> thêm chính xác nhất, tránh lãng phí.</li>
                                    </ul>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="2. Xem Chi tiết Tồn kho từng NCC" size="small" bordered style={{ borderColor: '#13c2c2' }}>
                                    <ul>
                                        <li>Vào danh sách <b>Nhà Gia Công / Cung Cấp</b>, nhấn vào Chi tiết nhà gia công.</li>
                                        <li>Mở tab <b>Tồn kho NPL</b>.</li>
                                        <li><b>Số dư Live:</b> Theo dõi chính xác hiện tại xưởng đang giữ những NPL nào, số lượng bao nhiêu.</li>
                                        <li><b>Lịch sử giao dịch:</b> Xem chi tiết Nhật ký (Ledger) từng lần Nhận NPL, từng lần bị trừ NPL do nhập thành phẩm (Có hỗ trợ bộ lọc theo khoảng thời gian).</li>
                                    </ul>
                                </Card>
                            </Col>
                        </Row>

                        <Alert
                            message="Khớp số liệu Tồn kho"
                            description="Vì việc trừ tồn kho NCC dựa trên Định mức (BOM), nếu thực tế xưởng tiêu hao nhiều hơn/ít hơn BOM, bạn có thể thực hiện Phiếu Điều chỉnh Kho hoặc Phiếu Bù NPL để cân bằng lại số liệu trên hệ thống cho khớp với thực tế kiểm kê tại xưởng."
                            type="warning"
                            showIcon
                            style={{ marginTop: 24 }}
                        />
                    </div>
                );
            case 'changelog':
                return (
                    <div>
                        <Tag color="green" style={{ marginBottom: 16 }}>Cập nhật mới</Tag>
                        <Title level={2}>🚀 Tính năng mới (từ 14/04/2026)</Title>

                        <Card title="14/04/2026 - Nâng cấp Contract Builder & Module Lập Kế Hoạch (MRP)" style={{ marginBottom: 16 }}>
                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Soạn Thảo Hợp Đồng (Contract Builder)">
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                        <li><b>Biến tự soạn (text_content):</b> Hỗ trợ 5 trường TextBox dài tự động hiển thị trong form nếu Mẫu Hợp Đồng có sử dụng hệ biến này.</li>
                                        <li><b>Thông tin Bên Bán (seller_xxx):</b> Bổ sung 10 tham số auto-fill lấy trực tiếp từ phần Settings - Thông tin doanh nghiệp (bao gồm cả Mã số thuế, Người đại diện, Thông tin Ngân hàng).</li>
                                        <li><b>Settings Variables:</b> Chia nhóm màu sắc (Bên mua, Bên bán, Tự định nghĩa...) giúp user nhúng biến vào mẫu dễ dàng hơn.</li>
                                    </ul>
                                </Descriptions.Item>
                                <Descriptions.Item label="Phân hệ Sản xuất & MRP">
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                        <li><b>Lập kế hoạch & Gom đơn:</b> Tự động tập hợp các Đơn hàng (SO) cần sản xuất để chạy phân tích nhu cầu NPL (MRP) tập trung.</li>
                                        <li><b>Tính toán tự động:</b> Hệ thống tự bóc tách Định mức (BOM), đối chiếu với Tồn kho thực tế để đưa ra khuyến nghị Cần Mua NPL và Cần Thuê Gia Công ngoài.</li>
                                        <li><b>Auto-Generate PO:</b> Tự động sinh Hợp đồng Mua NPL (PO NPL) và PO Gia Công sau khi người dùng tinh chỉnh xong số liệu phân tích.</li>
                                        <li><b>Quản lý chất lượng (QC):</b> Bổ sung module QC giúp kiểm soát chất lượng tại từng công đoạn sản xuất.</li>
                                    </ul>
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card title="28/02/2026 - Nâng cấp Quản lý Dự án & Thông báo" style={{ marginBottom: 16 }}>
                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Quản lý Dự án & Tasks">
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                        <li><b>Tasks:</b> Bổ sung chức năng chọn Project và Milestone khi tạo/sửa Task.</li>
                                        <li><b>Tạo trực tiếp:</b> Thêm tính năng tạo tasks trực tiếp từ Tab Tasks trong chi tiết Project.</li>
                                        <li><b>Gantt Chart:</b> Bổ sung chế độ xem Gantt Chart timeline trực quan cho Milestone và Tasks trong Tab Overview của Project.</li>
                                    </ul>
                                </Descriptions.Item>
                                <Descriptions.Item label="Thông báo (Notifications) Deep-Link">
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                        <li>Khi click vào một thông báo, hệ thống sẽ <b>tự động điều hướng</b> đến trang liên quan.</li>
                                        <li><b>Tự động mở Modal:</b> Không chỉ chuyển trang, hệ thống sẽ tự động tìm data, mở sẵn modal chi tiết hoặc edit (VD: mở ngay modal chỉnh sửa Task được gửi trong thông báo) giúp tiết kiệm thời gian thao tác.</li>
                                    </ul>
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card title="04/01/2026 - Cập nhật Module CRM & Dashboard" style={{ marginBottom: 16 }}>
                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Chăm sóc Lead (CRM)">
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                        <li>Thêm Tab <b>"Chăm sóc Lead"</b> trong modal Khách hàng</li>
                                        <li>Tổng hợp bình luận từ các đơn hàng + bình luận trực tiếp</li>
                                        <li>Nút <b>"Gợi ý AI"</b> gợi ý trả lời dựa trên lịch sử chat và sản phẩm</li>
                                        <li>Modal <b>Lead Care</b> độc lập - truy cập nhanh từ Dashboard</li>
                                    </ul>
                                </Descriptions.Item>
                                <Descriptions.Item label="Dashboard">
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                        <li><b>"Công việc của tôi"</b> - Hiển thị tasks được phân công</li>
                                        <li><b>"Leads cần chăm sóc"</b> - Danh sách lead chưa chuyển đổi</li>
                                        <li>UI mới với gradient cards, badges count</li>
                                    </ul>
                                </Descriptions.Item>
                                <Descriptions.Item label="Activity Logs">
                                    Sửa cột <b>"Chi tiết thay đổi"</b> - hiển thị old → new rõ ràng
                                </Descriptions.Item>
                                <Descriptions.Item label="Check List trong SO">
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                        <li>Tab <b>"Check List"</b> trong chi tiết đơn hàng</li>
                                        <li>Danh sách công việc cần làm theo từng giai đoạn</li>
                                        <li>Tự động thêm task khi chuyển trạng thái đơn hàng</li>
                                        <li>Đánh dấu hoàn thành với người thực hiện và thời gian</li>
                                    </ul>
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card title="04/01/2026 - Cập nhật Module Khách hàng" style={{ marginBottom: 16 }}>
                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Tự sinh mã khách hàng">
                                    Mã KH tự động tạo theo format: <Tag color="blue">KH-YYMM-XXXX</Tag>
                                    <br />Ví dụ: KH-2601-0001, KH-2601-0002...
                                </Descriptions.Item>
                                <Descriptions.Item label="Lịch sử mua hàng">
                                    Mặc định hiển thị <b>TẤT CẢ</b> đơn hàng (không lọc theo năm)
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card title="31/12/2025 - Cập nhật Module Sales" style={{ marginBottom: 16 }}>
                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Giao hàng từng phần (Partial Delivery)">
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                        <li>Hỗ trợ giao nhiều đợt cho 1 đơn hàng</li>
                                        <li>Theo dõi số lượng đã giao / còn lại</li>
                                        <li>Tự động cập nhật trạng thái: PARTIAL_DELIVERED → DELIVERED</li>
                                    </ul>
                                </Descriptions.Item>
                                <Descriptions.Item label="Tìm kiếm Tài chính">
                                    Tìm kiếm nhanh theo mã đơn hàng, mô tả, tên khách hàng
                                </Descriptions.Item>
                                <Descriptions.Item label="Portal Layout">
                                    Điều chỉnh cột "Sản Phẩm" và "Mô Tả VAT" cho cân đối hơn
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Alert
                            message="Mẹo"
                            description="Các tính năng mới sẽ được cập nhật liên tục. Theo dõi trang này để nắm bắt các thay đổi mới nhất!"
                            type="info"
                            showIcon
                        />
                    </div>
                );
            case 'sales-payment':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Phân hệ Bán Hàng</Tag>
                        <Title level={2}>💸 Thanh toán & Tất toán Đơn hàng</Title>
                        <Paragraph>
                            Hệ thống hỗ trợ quản lý thanh toán linh hoạt, cho phép ghi nhận thanh toán từng phần, đặt cọc và xử lý các trường hợp thanh toán thừa (Overpayment).
                        </Paragraph>

                        <Divider orientation="left">I. Quy trình Thanh toán</Divider>
                        <Steps
                            current={-1}
                            items={[
                                { title: 'Mở đơn hàng', description: 'Truy cập chi tiết đơn hàng (SO) cần thanh toán.' },
                                { title: 'Tab Giao Hàng & Thanh Toán', description: 'Chọn tab thứ 3 "Giao Hàng & Thanh Toán".' },
                                { title: 'Thêm thanh toán', description: 'Click nút "Thêm thanh toán" để mở form.' },
                                { title: 'Nhập thông tin', description: 'Nhập số tiền, loại thanh toán, và đính kèm chứng từ (nếu có).' },
                            ]}
                        />

                        <Divider orientation="left">II. Xử lý Thanh toán Thừa & Tất toán</Divider>
                        <Alert
                            message="Tính năng Mới"
                            description="Hệ thống hiện cho phép nhập số tiền thanh toán LỚN HƠN số tiền còn lại của đơn hàng."
                            type="info"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />

                        <Row gutter={16}>
                            <Col span={12}>
                                <Card title="Trường hợp 1: Tạo Credit (Số dư)" size="small">
                                    <Text>Khi khách hàng chuyển khoản dư hoặc muốn để lại tiền thừa cho đơn sau:</Text>
                                    <ul style={{ marginTop: 10 }}>
                                        <li>Hệ thống ghi nhận đơn hàng đã thanh toán đủ.</li>
                                        <li>Phần tiền thừa được tạo thành một giao dịch <b>CREDIT</b>.</li>
                                        <li>Số dư này có thể được dùng để cấn trừ cho các đơn hàng sau.</li>
                                    </ul>
                                    <Tag color="blue">Khuyên dùng</Tag>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="Trường hợp 2: Hoàn tiền mặt" size="small">
                                    <Text>Khi cửa hàng trả lại tiền thừa ngay lập tức cho khách:</Text>
                                    <ul style={{ marginTop: 10 }}>
                                        <li>Hệ thống ghi nhận đơn hàng đã thanh toán đủ.</li>
                                        <li>Tự động tạo một phiếu chi <b>(EXPENSE)</b> với lý do hoàn tiền.</li>
                                        <li>Giúp cân bằng sổ quỹ tiền mặt/ngân hàng.</li>
                                    </ul>
                                    <Tag color="orange">Dùng cho khách lẻ</Tag>
                                </Card>
                            </Col>
                        </Row>

                        <Divider orientation="left">III. Các loại giao dịch</Divider>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #f0f0f0' }}>
                            <thead style={{ background: '#fafafa' }}>
                                <tr>
                                    <th style={{ padding: 8, border: '1px solid #f0f0f0' }}>Loại</th>
                                    <th style={{ padding: 8, border: '1px solid #f0f0f0' }}>Mô tả</th>
                                    <th style={{ padding: 8, border: '1px solid #f0f0f0' }}>Ý nghĩa</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}><Tag>DEPOSIT</Tag></td>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}>Đặt cọc</td>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}>Khoản thanh toán trước khi giao hàng</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}><Tag color="blue">PAYMENT</Tag></td>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}>Thanh toán</td>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}>Thanh toán thông thường theo đợt</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}><Tag color="green">FINAL</Tag></td>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}>Tất toán</td>
                                    <td style={{ padding: 8, border: '1px solid #f0f0f0' }}>Khoản thanh toán cuối cùng để đóng đơn</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            case 'hr-overview':
                return (
                    <div>
                        <Title level={2}>👥 Phân hệ Nhân sự (HR)</Title>
                        <Paragraph>
                            Phân hệ quản lý toàn bộ thông tin nhân viên, chấm công, nghỉ phép, lương và tài sản được cấp.
                        </Paragraph>
                        <Row gutter={16}>
                            <Col span={6}><Card size="small"><ClockCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} /><Title level={5}>Chấm công</Title><Text type="secondary">Check-in/out, Calendar view</Text></Card></Col>
                            <Col span={6}><Card size="small"><CalendarOutlined style={{ fontSize: 24, color: '#52c41a' }} /><Title level={5}>Nghỉ phép</Title><Text type="secondary">Đăng ký, Duyệt, Số dư</Text></Card></Col>
                            <Col span={6}><Card size="small"><DollarOutlined style={{ fontSize: 24, color: '#eb2f96' }} /><Title level={5}>Bảng lương</Title><Text type="secondary">Phiếu lương hàng tháng</Text></Card></Col>
                            <Col span={6}><Card size="small"><IdcardOutlined style={{ fontSize: 24, color: '#722ed1' }} /><Title level={5}>Hồ sơ</Title><Text type="secondary">Thông tin cá nhân</Text></Card></Col>
                        </Row>
                        <Alert message="Lưu ý: Menu HR chỉ hiển thị cho user có quyền HR" type="info" style={{ marginTop: 16 }} />
                    </div>
                );
            case 'hr-attendance':
                return (
                    <div>
                        <Title level={2}>⏰ Chấm công & Calendar</Title>
                        <Paragraph>Hệ thống hỗ trợ 2 chế độ xem chấm công:</Paragraph>
                        <Row gutter={16}>
                            <Col span={12}><Card size="small" title="📋 Xem danh sách"><ul><li>Hiển thị dạng bảng</li><li>Dễ dàng lọc/sắp xếp</li><li>Thao tác sửa/xóa nhanh</li></ul></Card></Col>
                            <Col span={12}><Card size="small" title="📅 Xem Calendar"><ul><li>Tổng quan theo tháng</li><li>Tag màu theo trạng thái</li><li>Click để xem chi tiết</li></ul></Card></Col>
                        </Row>
                        <Divider />
                        <Title level={4}>Thao tác chấm công</Title>
                        <Steps direction="vertical" size="small" current={-1} items={[
                            { title: 'Chọn nhân viên', description: 'Từ danh sách bên trái' },
                            { title: 'Check IN', description: 'Nhấn nút CHECK IN khi bắt đầu làm việc' },
                            { title: 'Check OUT', description: 'Nhấn nút CHECK OUT khi kết thúc' },
                            { title: 'Tạo thủ công', description: 'Nếu cần bổ sung ngày đã qua' },
                        ]} />
                    </div>
                );
            case 'hr-leave':
                return (
                    <div>
                        <Title level={2}>🏖️ Nghỉ phép & Số dư</Title>
                        <Alert message="Tính năng mới: Quản lý số ngày phép năm" type="success" style={{ marginBottom: 16 }} />
                        <Title level={4}>Thiết lập ngày phép</Title>
                        <Steps direction="vertical" size="small" current={-1} items={[
                            { title: 'Chọn nhân viên', description: 'Từ dropdown "Xem số dư phép"' },
                            { title: 'Nhấn icon ⚙️', description: 'Mở form thiết lập ngày phép' },
                            { title: 'Nhập số liệu', description: 'Phép năm được cấp + Phép tồn năm trước' },
                            { title: 'Lưu', description: 'Hệ thống tự động tính số ngày còn lại' },
                        ]} />
                        <Divider />
                        <Title level={4}>Công thức tính</Title>
                        <Card size="small"><Text code>Còn lại = Phép năm + Tồn năm trước - Đã sử dụng (đơn APPROVED)</Text></Card>
                    </div>
                );
            case 'hr-payslip':
                return (
                    <div>
                        <Title level={2}>💰 Phiếu lương</Title>
                        <Paragraph>Xem phiếu lương hàng tháng với đầy đủ thông tin thu nhập và khấu trừ.</Paragraph>
                        <Title level={4}>Thông tin hiển thị</Title>
                        <Row gutter={16}>
                            <Col span={12}><Card size="small" title="Thu nhập" style={{ borderColor: '#52c41a' }}><ul><li>Lương cơ bản</li><li>PC Ăn trưa / Đi lại / Điện thoại</li><li>Thưởng</li></ul></Card></Col>
                            <Col span={12}><Card size="small" title="Khấu trừ" style={{ borderColor: '#ff4d4f' }}><ul><li>BHXH (8%)</li><li>BHYT (1.5%)</li><li>BHTN (1%)</li></ul></Card></Col>
                        </Row>
                        <Divider />
                        <Title level={4}>Trạng thái thanh toán</Title>
                        <p><Tag color="green">Đã TT</Tag> Phiếu lương đã được thanh toán - hiển thị ngày thanh toán</p>
                        <p><Tag color="orange">Chưa TT</Tag> Phiếu lương chưa được thanh toán</p>
                    </div>
                );
            case 'hr-profile':
                return (
                    <div>
                        <Title level={2}>👤 Hồ sơ cá nhân</Title>
                        <Paragraph>Mỗi user có thể xem thông tin HR cá nhân tại Menu "Hồ sơ".</Paragraph>
                        <Alert message="Điều kiện: Tài khoản phải được liên kết với Employee trong HR" type="warning" style={{ marginBottom: 16 }} />
                        <Title level={4}>Các tab trong Hồ sơ</Title>
                        <Row gutter={16}>
                            <Col span={6}><Card size="small"><ClockCircleOutlined /><p><b>Chấm công</b></p><Text type="secondary">Check-in/out hôm nay + lịch sử</Text></Card></Col>
                            <Col span={6}><Card size="small"><CalendarOutlined /><p><b>Nghỉ phép</b></p><Text type="secondary">Đăng ký + Số dư hiện tại</Text></Card></Col>
                            <Col span={6}><Card size="small"><DollarOutlined /><p><b>Bảng lương</b></p><Text type="secondary">Xem phiếu lương các tháng</Text></Card></Col>
                            <Col span={6}><Card size="small"><TagsOutlined /><p><b>Tài sản</b></p><Text type="secondary">Laptop, điện thoại được cấp</Text></Card></Col>
                        </Row>
                    </div>
                );
            case 'mrp-guide':
                return (
                    <div>
                        <Tag color="volcano" style={{ marginBottom: 16 }}>Quy trình vận hành tiêu chuẩn (SOP)</Tag>
                        <Title level={2}>🏭 Lập Kế Hoạch Sản Xuất & MRP</Title>
                        <Paragraph>
                            Tài liệu hướng dẫn quy trình lập kế hoạch sản xuất, tính toán nhu cầu nguyên phụ liệu (MRP),
                            và tạo đơn đặt hàng (PO) cho Nguyên phụ liệu (NPL) và Gia công (GC).
                        </Paragraph>

                        <Alert
                            message="Mục tiêu SOP"
                            description={
                                <ul style={{ marginBottom: 0 }}>
                                    <li>Cung ứng vật tư kịp thời, đúng số lượng và chất lượng.</li>
                                    <li>Tối ưu hóa tồn kho, tận dụng tối đa nguyên liệu có sẵn.</li>
                                    <li>Đồng bộ hóa thông tin giữa Kinh doanh, Kế hoạch và Mua hàng.</li>
                                </ul>
                            }
                            type="info"
                            showIcon
                            style={{ marginBottom: 24 }}
                        />

                        {/* Sơ đồ tổng quát */}
                        <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 0, borderRadius: 12 }}>
                            <Title level={4} style={{ color: '#fff', marginBottom: 16 }}>🔄 Luồng Quy Trình Tổng Quát</Title>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                {[
                                    { icon: <InboxOutlined />, label: '1. Gom Đơn' },
                                    { icon: <ProjectOutlined />, label: '2. Lập KH' },
                                    { icon: <CalculatorOutlined />, label: '3. Chạy MRP' },
                                    { icon: <EditOutlined />, label: '4. Tinh chỉnh' },
                                    { icon: <FileDoneOutlined />, label: '5. Tạo PO' },
                                    { icon: <ShopOutlined />, label: '6. Bàn giao' },
                                ].map((step, i) => (
                                    <React.Fragment key={i}>
                                        <div style={{ textAlign: 'center', minWidth: 90 }}>
                                            <div style={{ fontSize: 28, color: '#fff', marginBottom: 4 }}>{step.icon}</div>
                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{step.label}</Text>
                                        </div>
                                        {i < 5 && <div style={{ color: '#fff', fontSize: 20, opacity: 0.6 }}>➜</div>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </Card>

                        {/* BƯỚC 1 */}
                        <Card
                            title={<span><Tag color="blue">Bước 1</Tag> Tiếp nhận & Gom Đơn hàng</span>}
                            style={{ marginBottom: 20, borderLeft: '4px solid #1890ff' }}
                        >
                            <Paragraph type="secondary">Tập hợp các đơn hàng lẻ thành đợt sản xuất (Batch) để tối ưu chi phí.</Paragraph>
                            <Steps direction="vertical" size="small" current={-1} items={[
                                {
                                    title: <Text strong>Truy cập module Planning</Text>,
                                    description: 'Vào Planning > Tab "Gom Đơn Lập Kế Hoạch".',
                                    icon: <ProjectOutlined style={{ color: '#1890ff' }} />
                                },
                                {
                                    title: <Text strong>Lọc theo Ngày giao hàng</Text>,
                                    description: 'Nhóm các đơn cùng khung thời gian giao hàng.',
                                    icon: <SearchOutlined style={{ color: '#1890ff' }} />
                                },
                                {
                                    title: <Text strong>Kiểm tra Tồn kho Thành phẩm</Text>,
                                    description: (
                                        <div>
                                            <ul>
                                                <li>Nếu có nút <Tag color="green">Xuất Kho</Tag>: Xuất trực tiếp, không cần lập kế hoạch SX.</li>
                                                <li>Nếu thiếu hàng: Tick chọn đơn và tiếp tục bước kế tiếp.</li>
                                            </ul>
                                        </div>
                                    ),
                                    icon: <ContainerOutlined style={{ color: '#52c41a' }} />
                                },
                                {
                                    title: <Text strong>Tạo Kế hoạch</Text>,
                                    description: 'Nhấn "Lập Kế Hoạch", nhập Mã KH (VD: KH-T10-D1), Tên đợt, Thời gian dự kiến.',
                                    icon: <PlusOutlined style={{ color: '#722ed1' }} />
                                }
                            ]} />
                        </Card>

                        {/* BƯỚC 2 */}
                        <Card
                            title={<span><Tag color="orange">Bước 2</Tag> Phân Tích Nhu Cầu (MRP Analysis)</span>}
                            style={{ marginBottom: 20, borderLeft: '4px solid #fa8c16' }}
                        >
                            <Paragraph type="secondary">
                                Tính toán chính xác lượng NPL cần mua và hàng cần gia công dựa trên BOM (Định mức) & Tồn kho.
                            </Paragraph>
                            <Steps direction="vertical" size="small" current={-1} items={[
                                {
                                    title: <Text strong>Mở Danh Sách Kế Hoạch</Text>,
                                    description: 'Tab "Danh Sách Kế Hoạch" > Tìm kế hoạch vừa tạo.',
                                    icon: <OrderedListOutlined style={{ color: '#fa8c16' }} />
                                },
                                {
                                    title: <Text strong>Nhấn "Phân Tích" (Analyze)</Text>,
                                    description: 'Hệ thống tự động tính toán và hiển thị 3 phần:',
                                    icon: <ThunderboltOutlined style={{ color: '#fa8c16' }} />
                                }
                            ]} />
                            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                                <Col span={8}>
                                    <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff', textAlign: 'center' }}>
                                        <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                                        <div style={{ fontWeight: 600, marginTop: 6 }}>Nhu cầu NPL (MRP)</div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Vải, phụ liệu, nguyên liệu...</Text>
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffd591', textAlign: 'center' }}>
                                        <ToolOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
                                        <div style={{ fontWeight: 600, marginTop: 6 }}>Nhu cầu Gia Công</div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>In, Thêu, May gia công...</Text>
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f', textAlign: 'center' }}>
                                        <TruckOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                                        <div style={{ fontWeight: 600, marginTop: 6 }}>Chi phí Logistics</div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Vận chuyển, đóng gói...</Text>
                                    </Card>
                                </Col>
                            </Row>
                        </Card>

                        {/* BƯỚC 3 */}
                        <Card
                            title={<span><Tag color="red">Bước 3</Tag> <Text strong>Tinh Chỉnh & Cân Đối Vật Tư (QUAN TRỌNG)</Text></span>}
                            style={{ marginBottom: 20, borderLeft: '4px solid #f5222d' }}
                        >
                            <Alert
                                message="Bước quan trọng nhất"
                                description="Planner cần rà soát kỹ lưỡng kết quả MRP trước khi tạo PO. Đây là bước quyết định hiệu quả mua hàng."
                                type="warning"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card title={<span><DatabaseOutlined /> Tab 1: Nguyên Phụ Liệu (NPL)</span>} size="small" bordered style={{ borderColor: '#91d5ff' }}>
                                        <ul>
                                            <li><b>Tồn Kho:</b> Cột hiển thị số lượng thực tế.</li>
                                            <li><b>Dùng Kho (☑):</b> Mặc định tích. Bỏ tích nếu muốn giữ tồn cho đơn khác.</li>
                                            <li><b>Cần Mua (SL):</b> = Nhu cầu − Tồn kho. Có thể sửa tay (VD: Làm tròn theo quy cách đóng gói NCC).</li>
                                            <li><b>Chọn NCC:</b> Hệ thống gợi ý NCC ưu tiên. Có thể đổi NCC khác, giá tham khảo tự cập nhật.</li>
                                        </ul>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title={<span><ToolOutlined /> Tab 2: Gia Công</span>} size="small" bordered style={{ borderColor: '#ffd591' }}>
                                        <ul>
                                            <li>Rà soát các công đoạn thuê ngoài (In, Thêu, May...).</li>
                                            <li>Chọn <b>Nhà gia công</b> phù hợp.</li>
                                            <li>Kiểm tra <b>Đơn giá</b> và <b>Số lượng</b>.</li>
                                        </ul>
                                    </Card>
                                </Col>
                            </Row>
                            <div style={{ marginTop: 16, textAlign: 'center' }}>
                                <Button type="primary" icon={<SaveOutlined />} size="large" disabled>Lưu Kết Quả</Button>
                                <div style={{ marginTop: 8 }}><Text type="secondary">Nhấn "Lưu Kết Quả" sau khi điều chỉnh xong</Text></div>
                            </div>
                        </Card>

                        {/* BƯỚC 4 */}
                        <Card
                            title={<span><Tag color="green">Bước 4</Tag> Tạo Đơn Đặt Hàng (Generate PO)</span>}
                            style={{ marginBottom: 20, borderLeft: '4px solid #52c41a' }}
                        >
                            <Alert
                                message="Nguyên tắc: Chỉ tạo PO khi đã chốt phương án vật tư."
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Button type="primary" block size="large" icon={<DatabaseOutlined />} disabled
                                        style={{ height: 60, background: '#1890ff', borderColor: '#1890ff' }}>
                                        Tạo PO Nguyên Liệu (NPL)
                                    </Button>
                                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>Mua vải, phụ liệu, bao bì...</Text>
                                </Col>
                                <Col span={12}>
                                    <Button type="primary" block size="large" icon={<ToolOutlined />} disabled
                                        style={{ height: 60, background: '#fa8c16', borderColor: '#fa8c16' }}>
                                        Tạo Đơn Gia Công (GC)
                                    </Button>
                                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>In, Thêu, May thuê ngoài...</Text>
                                </Col>
                            </Row>
                            <Divider dashed />
                            <Paragraph><b>Cơ chế tạo PO:</b></Paragraph>
                            <ul>
                                <li>Hệ thống tự động <Tag color="blue">GOM THEO NCC</Tag> — các vật tư cùng nhà cung cấp → 1 PO.</li>
                                <li>Chỉ tạo PO cho các dòng có <b>Cần mua (SL) {'>'} 0</b>.</li>
                                <li>PO được tạo ở trạng thái <Tag>Nháp (Draft)</Tag>.</li>
                            </ul>
                        </Card>

                        {/* BƯỚC 5 */}
                        <Card
                            title={<span><Tag color="purple">Bước 5</Tag> Bàn Giao & Theo Dõi</span>}
                            style={{ marginBottom: 20, borderLeft: '4px solid #722ed1' }}
                        >
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card title="Team Mua Hàng" size="small" bordered={false} style={{ background: '#f0f5ff' }}>
                                        <Steps direction="vertical" size="small" current={-1} items={[
                                            { title: 'Review PO Nháp', description: 'Kiểm tra giá, điều khoản, ghi chú.' },
                                            { title: 'Gộp PO (Pooling)', description: 'Gom nhiều PO DRAFT (chưa đặt hàng) cùng NCC thành 1 đơn lớn.' },
                                            { title: 'Gửi PO', description: 'Sent → Confirmed → Ordered.' },
                                        ]} />
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Team MRP" size="small" bordered={false} style={{ background: '#f9f0ff' }}>
                                        <Steps direction="vertical" size="small" current={-1} items={[
                                            { title: 'Gantt Chart', description: 'Theo dõi tiến độ các kế hoạch.' },
                                            { title: 'Trạng thái', description: <div><Tag color="green">Xanh</Tag> Hoàn tất | <Tag color="gold">Vàng</Tag> Mới tạo | <Tag color="red">Đỏ</Tag> Trễ tiến độ</div> },
                                        ]} />
                                    </Card>
                                </Col>
                            </Row>
                        </Card>

                        {/* Troubleshooting */}
                        <Divider orientation="left">🔧 Xử lý Sự cố Thường gặp</Divider>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #f0f0f0' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        <th style={{ padding: 12, border: '1px solid #f0f0f0', textAlign: 'left' }}>Vấn đề</th>
                                        <th style={{ padding: 12, border: '1px solid #f0f0f0', textAlign: 'left' }}>Nguyên nhân</th>
                                        <th style={{ padding: 12, border: '1px solid #f0f0f0', textAlign: 'left' }}>Cách xử lý</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Không thấy đơn hàng trong "Gom Đơn"</td>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Đơn hàng chưa được duyệt</td>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Liên hệ Sales kiểm tra trạng thái (Phải là <Tag>APPROVED</Tag> hoặc <Tag>DEPOSITED</Tag>).</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Tồn kho hiển thị sai</td>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Dữ liệu chưa cập nhật</td>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Kiểm tra module Inventory. Nhấn "Làm mới" trên trang Planning.</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Giá tham khảo = 0</td>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Chưa có bảng giá NCC</td>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Cập nhật giá thủ công hoặc liên hệ Mua hàng cập nhật Bảng giá NCC.</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Lỗi khi tạo PO</td>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Thiếu NCC hoặc lỗi mạng</td>
                                        <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Kiểm tra trường "Nhà Cung Cấp" trên từng dòng. Đảm bảo không để trống.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'po-npl':
                return (
                    <div>
                        <Tag color="blue" style={{ marginBottom: 16 }}>Modules: Purchasing (NPL)</Tag>
                        <Title level={2}>📦 Quản Lý Đơn Mua Nguyên Phụ Liệu (PO NPL)</Title>
                        <Paragraph>
                            Hướng dẫn quản lý các Đơn đặt hàng Nguyên Phụ Liệu (PO NPL), từ khi được tạo từ MRP đến khi nhận hàng hoàn tất.
                        </Paragraph>

                        <Card title="Vòng đời Đơn Mua NPL" style={{ marginBottom: 24, borderColor: '#91d5ff' }}>
                            <Steps size="small" current={-1} items={[
                                { title: <span><Tag color="default">DRAFT</Tag></span>, description: 'PO mới tạo từ MRP' },
                                { title: <span><Tag color="processing">SENT</Tag></span>, description: 'Gửi cho NCC' },
                                { title: <span><Tag color="warning">CONFIRMED</Tag></span>, description: 'NCC xác nhận' },
                                { title: <span><Tag color="blue">ORDERED</Tag></span>, description: 'Đã đặt hàng' },
                                { title: <span><Tag color="cyan">DELIVERED</Tag></span>, description: 'Đã giao đủ' },
                                { title: <span><Tag color="success">COMPLETED</Tag></span>, description: 'Hoàn tất' },
                            ]} />
                        </Card>

                        <Card title="1. Xem & Chỉnh sửa PO" style={{ marginBottom: 20, borderLeft: '4px solid #1890ff' }}>
                            <Steps direction="vertical" size="small" current={-1} items={[
                                {
                                    title: <Text strong>Truy cập module Mua Hàng</Text>,
                                    description: 'Vào Purchasing > Tab "Tất cả" hoặc "NPL".',
                                    icon: <ShopOutlined style={{ color: '#1890ff' }} />
                                },
                                {
                                    title: <Text strong>Nhấn vào dòng PO</Text>,
                                    description: 'Drawer chi tiết hiện ra với thông tin NCC, các dòng hàng, giá và số lượng.',
                                    icon: <FileSearchOutlined style={{ color: '#1890ff' }} />
                                },
                                {
                                    title: <Text strong>Chỉnh sửa (nếu cần)</Text>,
                                    description: (
                                        <ul>
                                            <li><b>Số lượng:</b> Sửa trực tiếp trên bảng.</li>
                                            <li><b>Đơn giá:</b> Cập nhật theo thỏa thuận thực tế với NCC.</li>
                                            <li><b>Ghi chú:</b> Thêm note đặc biệt cho từng dòng hàng.</li>
                                        </ul>
                                    ),
                                    icon: <EditOutlined style={{ color: '#fa8c16' }} />
                                },
                                {
                                    title: <Text strong>Lưu thay đổi</Text>,
                                    description: 'Nhấn "Lưu" để cập nhật. Hệ thống tự tính lại tổng tiền.',
                                    icon: <SaveOutlined style={{ color: '#52c41a' }} />
                                },
                            ]} />
                        </Card>

                        <Card title="2. In Đơn Mua Hàng" style={{ marginBottom: 20, borderLeft: '4px solid #722ed1' }}>
                            <Paragraph>Hệ thống hỗ trợ nhiều mẫu in:</Paragraph>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
                                        <div style={{ fontWeight: 600 }}>📄 Mẫu Chuẩn</div>
                                        <Text type="secondary">Đơn mua hàng NPL tiêu chuẩn</Text>
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
                                        <div style={{ fontWeight: 600 }}>📄 Mẫu Gia Công</div>
                                        <Text type="secondary">Đơn đặt hàng gia công</Text>
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
                                        <div style={{ fontWeight: 600 }}>📄 Mẫu CARA/HQ</div>
                                        <Text type="secondary">Mẫu nội bộ công ty</Text>
                                    </Card>
                                </Col>
                            </Row>
                        </Card>

                        <Card title="3. Gộp PO (Pooling)" style={{ marginBottom: 20, borderLeft: '4px solid #13c2c2' }}>
                            <Alert
                                message="Khi nào cần gộp PO?"
                                description="Khi có nhiều PO nhỏ lẻ cho cùng 1 NCC (từ các kế hoạch khác nhau), hãy gộp thành 1 PO lớn để tiện giao nhận và thanh toán. Lưu ý: Chỉ các PO ở trạng thái Nháp (DRAFT) mới có thể được gộp."
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Steps direction="vertical" size="small" current={-1} items={[
                                { title: 'Bước 1', description: 'Vào tab "Yêu Cầu" (Requirements) hoặc "PO Gộp".' },
                                { title: 'Bước 2', description: 'Tick chọn các PO cùng loại (NPL hoặc Gia công) cần gộp.' },
                                { title: 'Bước 3', description: 'Chọn Nhà cung cấp cho PO gộp.' },
                                { title: 'Bước 4', description: 'Nhấn "Tạo PO Gộp". Các PO con sẽ được link vào PO gộp.' },
                            ]} />
                        </Card>
                    </div>
                );
            case 'bod-dashboard':
                return (
                    <div>
                        <Tag color="cyan" style={{ marginBottom: 16 }}>Phân tích & Báo cáo</Tag>
                        <Title level={2}>📈 BOD Dashboard - Bảng điều khiển Quản trị</Title>
                        <Paragraph>
                            BOD Dashboard (Board of Directors Dashboard) là bảng điều khiển dành cho Ban Giám Đốc và Quản lý cấp cao để theo dõi tổng quan hiệu suất kinh doanh, từ dòng tiền thực tế đến các cơ hội trong tương lai.
                        </Paragraph>

                        <Divider orientation="left">I. Các Chỉ Số Quan Trọng (KPIs)</Divider>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} sm={12}>
                                <Card size="small" bordered style={{ borderColor: '#10b981' }}>
                                    <Title level={5} style={{ color: '#059669', margin: 0 }}>💰 Doanh thu thực thu</Title>
                                    <Paragraph style={{ marginTop: 8 }}>Tổng số tiền <b>thực tế đã thu</b> từ khách hàng (từ tất cả các phiếu Thu liên quan đến Đơn hàng) trong kỳ.</Paragraph>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Card size="small" bordered style={{ borderColor: '#3b82f6' }}>
                                    <Title level={5} style={{ color: '#1d4ed8', margin: 0 }}>📈 Doanh số thực tế</Title>
                                    <Paragraph style={{ marginTop: 8 }}>Tổng giá trị các <b>Đơn hàng (SO)</b> đã được chốt và <b>có phát sinh thanh toán/đặt cọc</b> trong kỳ.</Paragraph>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Card size="small" bordered style={{ borderColor: '#a855f7' }}>
                                    <Title level={5} style={{ color: '#8b5cf6', margin: 0 }}>🔵 Doanh số dự kiến</Title>
                                    <Paragraph style={{ marginTop: 8 }}>Tổng giá trị của tất cả các <b>Báo giá (Quotation)</b> được tạo ra trong kỳ chưa được chốt thành SO.</Paragraph>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Card size="small" bordered style={{ borderColor: '#f59e0b' }}>
                                    <Title level={5} style={{ color: '#d97706', margin: 0 }}>🏆 Tỷ lệ chốt & Phễu Lead</Title>
                                    <Paragraph style={{ marginTop: 8 }}>Theo dõi <b>Tỷ lệ chuyển đổi (Win Rate)</b> và số lượng Lead mới, hiển thị trực quan sức khỏe của phễu bán hàng.</Paragraph>
                                </Card>
                            </Col>
                        </Row>

                        <Divider orientation="left">II. Biểu đồ Phễu chuyển đổi (Conversion Funnel)</Divider>
                        <Alert 
                            message="Theo dõi luồng khách hàng" 
                            description="Biểu đồ phễu đếm tổng số lượng khách hàng từng đi qua các giai đoạn: Lead Mới ➔ Đã Liên Hệ ➔ Duyệt Mẫu SX ➔ Đàm Phán / BG ➔ Thành Công (WON). Phễu luôn có hình dạng nhỏ dần, giúp phát hiện nút thắt (bottleneck) trong quy trình chốt sale." 
                            type="info" showIcon style={{ marginBottom: 16 }} 
                        />

                        <Divider orientation="left">III. Bảng điểm Sales & Dự báo (Scorecard & Forecast)</Divider>
                        <Paragraph>
                            - <b>Bảng điểm Sales:</b> Theo dõi sát sao tiến độ hoàn thành mục tiêu (Quota) của từng nhân sự kinh doanh dựa trên Doanh thu thực tế, số Lead mới mang về và thời gian chốt sale trung bình.
                            <br />
                            - <b>Dự báo Quý:</b> Kết hợp biểu đồ doanh thu thực tế các tháng trước và dự báo doanh số các tháng tới dựa trên trọng số cơ hội (Weighted Pipeline) của các Lead đang mở.
                        </Paragraph>
                    </div>
                );
            case 'po-gc':
                return (
                    <div>
                        <Tag color="orange" style={{ marginBottom: 16 }}>Modules: Purchasing (Gia Công)</Tag>
                        <Title level={2}>🔧 Quản Lý Đơn Gia Công (PO GC)</Title>
                        <Paragraph>
                            Hướng dẫn quản lý các Đơn đặt hàng Gia công (PO GC) — theo dõi từ đặt hàng, giao NPL cho xưởng,
                            đến nhận lại thành phẩm.
                        </Paragraph>

                        <Card
                            title={<span>📋 Chi tiết Đơn Gia Công</span>}
                            style={{ marginBottom: 24, borderLeft: '4px solid #fa8c16' }}
                        >
                            <Paragraph>Mỗi PO Gia công bao gồm 3 phần thông tin chính:</Paragraph>
                            <Row gutter={[16, 16]}>
                                <Col span={8}>
                                    <Card size="small" style={{ background: '#e6f7ff', textAlign: 'center', height: '100%' }}>
                                        <FileDoneOutlined style={{ fontSize: 28, color: '#1890ff' }} />
                                        <div style={{ fontWeight: 600, marginTop: 8 }}>Tab 1: Hạng Mục</div>
                                        <Text type="secondary">Danh sách công đoạn, SL, đơn giá</Text>
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card size="small" style={{ background: '#fff7e6', textAlign: 'center', height: '100%' }}>
                                        <TruckOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
                                        <div style={{ fontWeight: 600, marginTop: 8 }}>Tab 2: Giao NPL</div>
                                        <Text type="secondary">Quản lý giao nguyên liệu đến xưởng</Text>
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card size="small" style={{ background: '#f6ffed', textAlign: 'center', height: '100%' }}>
                                        <AppstoreAddOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                                        <div style={{ fontWeight: 600, marginTop: 8 }}>Tab 3: Đóng Gói</div>
                                        <Text type="secondary">Matrix chi tiết theo size/màu</Text>
                                    </Card>
                                </Col>
                            </Row>
                        </Card>

                        <Card
                            title={<span><TruckOutlined /> Quy Trình Giao NPL Cho Xưởng Gia Công</span>}
                            style={{ marginBottom: 20, borderLeft: '4px solid #fa8c16' }}
                        >
                            <Alert
                                message="Tại sao cần theo dõi NPL giao cho xưởng?"
                                description="Khi thuê gia công ngoài, doanh nghiệp phải giao NPL (vải, chỉ, nút...) cho xưởng. Cần ghi nhận chính xác số lượng giao để đối chiếu khi nhận lại thành phẩm."
                                type="warning"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Steps direction="vertical" size="small" current={-1} items={[
                                {
                                    title: <Text strong>Mở PO Gia công</Text>,
                                    description: 'Vào module Mua Hàng > Tab "Gia Công" > Nhấn vào PO cần theo dõi.',
                                    icon: <FileSearchOutlined style={{ color: '#1890ff' }} />
                                },
                                {
                                    title: <Text strong>Nhấn nút "Xe Tải" (Theo dõi NPL)</Text>,
                                    description: 'Hệ thống hiện bảng danh sách NPL cần giao cho xưởng (tự động tính từ BOM).',
                                    icon: <TruckOutlined style={{ color: '#fa8c16' }} />
                                },
                                {
                                    title: <Text strong>Cập nhật SL đã giao</Text>,
                                    description: 'Nhập số lượng thực tế đã giao cho từng loại nguyên liệu.',
                                    icon: <EditOutlined style={{ color: '#52c41a' }} />
                                },
                                {
                                    title: <Text strong>Lưu & Đối chiếu</Text>,
                                    description: 'Hệ thống lưu lịch sử giao nhận. Khi nhận lại thành phẩm, đối chiếu số lượng NPL đã giao.',
                                    icon: <SaveOutlined style={{ color: '#722ed1' }} />
                                },
                            ]} />
                        </Card>

                        <Card
                            title={<span><AppstoreAddOutlined /> Chi Tiết Đóng Gói (Packing List)</span>}
                            style={{ marginBottom: 20, borderLeft: '4px solid #52c41a' }}
                        >
                            <Paragraph>
                                Tab Đóng Gói dùng để ghi nhận chi tiết về sản phẩm gia công theo dạng <b>Ma trận (Matrix)</b>.
                            </Paragraph>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Card size="small" title="Chức năng" bordered={false} style={{ background: '#f6ffed' }}>
                                        <ul>
                                            <li>Khai báo các <b>dòng hàng</b> (VD: Áo Polo Trắng, Áo Polo Đen...)</li>
                                            <li>Nhập số lượng theo <b>Size</b> (S, M, L, XL...)</li>
                                            <li>Tự động tính <b>Tổng SL</b> mỗi dòng</li>
                                        </ul>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card size="small" title="Ứng dụng" bordered={false} style={{ background: '#fff7e6' }}>
                                        <ul>
                                            <li><b>Kiểm hàng nhận về:</b> Đối chiếu SL nhận vs SL đặt.</li>
                                            <li><b>In Packing List:</b> Kèm theo khi giao hàng cho khách.</li>
                                            <li><b>Báo cáo:</b> Thống kê SL gia công theo đơn hàng.</li>
                                        </ul>
                                    </Card>
                                </Col>
                            </Row>
                        </Card>

                        <Alert
                            message="Lưu ý khi nhận hàng gia công"
                            description={
                                <ul style={{ marginBottom: 0 }}>
                                    <li>Luôn đối chiếu số lượng nhận vs Packing List.</li>
                                    <li>Kiểm tra chất lượng sản phẩm trước khi nhập kho (QC).</li>
                                    <li>Ghi nhận phần thừa/thiếu NPL để quyết toán với xưởng gia công.</li>
                                </ul>
                            }
                            type="warning"
                            showIcon
                            style={{ marginTop: 16 }}
                        />
                    </div>
                );
            case 'mrp-nesting':
                return (
                    <div>
                        <Tag color="purple" style={{ marginBottom: 16 }}>Công cụ Sản Xuất</Tag>
                        <Title level={2}>✂️ Công cụ Xếp Sơ đồ (2D Nesting / Marker Making)</Title>
                        <Paragraph>
                            Công cụ <b>Xếp sơ đồ 2D</b> giúp tối ưu hóa việc sắp xếp các chi tiết (ví dụ: hình in, hình thêu, rập cắt) lên khổ vải (hoặc khổ in/thêu) sao cho tiết kiệm diện tích nhất. Hệ thống hỗ trợ cả thuật toán tự động (Bin Packing) và thao tác kéo thả thủ công mượt mà trên Canvas.
                        </Paragraph>
                        <Divider orientation="left">Tính năng chính</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card size="small" title={<><ThunderboltOutlined /> Tự động xếp thông minh</>} bordered={false} style={{ background: '#e6f7ff' }}>
                                    Hệ thống sử dụng thuật toán tự động (Bin Packing) để phân bổ các chi tiết vào khung vải khổng lồ mà không bị chồng lấp, giúp giảm hao phí vải tối đa. Hỗ trợ tự động xoay mảnh (Rotation).
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" title={<><AppstoreAddOutlined /> Kéo thả Thủ công (Drag & Drop)</>} bordered={false} style={{ background: '#f6ffed' }}>
                                    Giao diện Canvas linh hoạt cho phép người dùng click và kéo thả để di chuyển từng mảnh, xoay các góc độ thủ công một cách chính xác.
                                </Card>
                            </Col>
                        </Row>
                        <Divider orientation="left">Các bước thực hiện</Divider>
                        <Steps
                            current={-1}
                            direction="vertical"
                            items={[
                                {
                                    title: 'Bước 1: Khai báo Khổ Vải (Bin)',
                                    description: 'Nhập thông số Chiều dài và Chiều rộng của cuộn vải (hoặc bàn in) vào khung cấu hình. Ví dụ: Dài 400cm, Rộng 120cm.'
                                },
                                {
                                    title: 'Bước 2: Thêm các mảnh chi tiết',
                                    description: 'Nhập kích thước (rộng x cao), số lượng, và tên cho từng loại chi tiết cần in/thêu. Các mảnh này sẽ được đưa vào "Danh sách chờ".'
                                },
                                {
                                    title: 'Bước 3: Tự động xếp sơ đồ (Auto Nest)',
                                    description: 'Bấm nút "Tự động Xếp sơ đồ", phần mềm sẽ tính toán tọa độ tốt nhất cho từng mảnh để khít vào khổ vải.'
                                },
                                {
                                    title: 'Bước 4: Tinh chỉnh thủ công',
                                    description: 'Nhấp chọn (click) vào từng phần tử trên sơ đồ (Canvas) ở khu vực bên phải. Bạn có thể dùng chuột kéo thả nó sang một vị trí mới hoặc nắm các góc để xoay hình (Rotate).'
                                },
                                {
                                    title: 'Bước 5: Xuất ảnh Sơ đồ',
                                    description: 'Sau khi có được sơ đồ ưng ý nhất, hãy nhấn nút "Xuất Ảnh". Hình ảnh sơ đồ với độ phân giải cao sẽ được lưu về máy (PNG) để đính kèm vào Lệnh Sản Xuất (PO).'
                                }
                            ]}
                        />
                    </div>
                );
            case 'mrp-tracking':
                return (
                    <div>
                        <Tag color="purple" style={{ marginBottom: 16 }}>Phân hệ Sản Xuất</Tag>
                        <Title level={2}>📊 Theo Dõi Tiến Độ Kế Hoạch Sản Xuất</Title>
                        <Paragraph>
                            Tính năng quản lý và theo dõi tiến độ chi tiết của một Kế Hoạch Sản Xuất (KHSX), bao gồm: theo dõi trạng thái từng khâu (Pipeline), Quản lý Lịch sử (Version History) và Tự động hóa đồng bộ (Sync BOD).
                        </Paragraph>

                        <Divider orientation="left">I. Tiến Độ Sản Xuất (Pipeline)</Divider>
                        <Card style={{ marginBottom: 16 }}>
                            <Steps
                                direction="vertical"
                                current={-1}
                                items={[
                                    {
                                        title: <Text strong>Khởi tạo Lệnh Sản Xuất</Text>,
                                        description: 'Nhấn nút "Khởi tạo Lệnh Sản Xuất". Hệ thống sẽ lấy các công đoạn từ Product Routing hoặc tạo các công đoạn mặc định (Mua NPL → Nối vải → Chần gòn → Thêu → In → May → Đóng gói → Giao hàng).'
                                    },
                                    {
                                        title: <Text strong>Cập nhật Tiến Độ</Text>,
                                        description: 'Với mỗi công đoạn, bạn có thể nhấn "Bắt đầu" (chuyển sang In Progress) hoặc "Hoàn thành" (chuyển sang Completed) ngay trên thanh giao diện Tiến Độ.'
                                    },
                                    {
                                        title: <Text strong>Chỉnh sửa linh hoạt</Text>,
                                        description: 'Bạn có thể xóa (Remove) bất kỳ công đoạn nào không cần thiết bằng nút Xóa bên cạnh.'
                                    }
                                ]}
                            />
                        </Card>

                        <Divider orientation="left">II. Lịch Sử Phiên Bản (Version History)</Divider>
                        <Card style={{ marginBottom: 16 }}>
                            <ul>
                                <li>Mỗi khi nhấn <b>"Lưu Kết Quả"</b> hoặc <b>"Tính lại"</b> KHSX, hệ thống sẽ tự động lưu lại Snapshot toàn bộ dữ liệu MRP (bao gồm Định mức Nguyên liệu, Giá, v.v.).</li>
                                <li>Nhấn nút <b>"Lịch sử"</b> trên thanh trên cùng để mở Modal xem lại danh sách các phiên bản, thời gian sửa và người thực hiện thay đổi.</li>
                                <li>Nút <b>"Tính lại"</b> sẽ tự động tải BOM và Routing mới nhất của sản phẩm từ hệ thống để tính toán thay vì dùng dữ liệu cũ.</li>
                            </ul>
                        </Card>

                        <Divider orientation="left">III. Đồng bộ BOD FollowUp</Divider>
                        <Card style={{ marginBottom: 16 }}>
                            <ul>
                                <li>Nút <b>"Sync BOD"</b> dùng để đồng bộ nhanh tình trạng cung ứng / sản xuất vào màn hình <b>BOD FollowUp</b> của Đơn Hàng.</li>
                                <li>Nếu đã có PO Nguyên liệu nào được giao, hệ thống tự động tick chọn <b>Vải / Gòn</b> bên BOD FollowUp và ghi chú ngày cập nhật.</li>
                                <li>Nếu Lệnh Sản Xuất đang tiến hành, hệ thống tự động tick chọn phần <b>Sản xuất</b>.</li>
                                <li><b>Lưu ý:</b> Tính năng chỉ thêm thông tin (Merge) vào ghi chú cũ, không ghi đè nên bạn hoàn toàn yên tâm.</li>
                            </ul>
                        </Card>

                        <Divider orientation="left">IV. Tổng Hợp PO</Divider>
                        <Card style={{ marginBottom: 16 }}>
                            <ul>
                                <li>Tab <b>6. Tổng Hợp PO</b> hiển thị danh sách tập trung mọi Đơn đặt hàng (PO Nguyên Phụ Liệu) và PO Gia Công phát sinh từ Kế hoạch này.</li>
                                <li>Theo dõi tổng tiền và trạng thái giao hàng ở một nơi duy nhất.</li>
                            </ul>
                        </Card>
                    </div>
                );
            default:
                return <div>Select a topic</div>;
        }
    };

    return (
        <Layout style={{ height: '100%', background: '#fff' }}>
            <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
                <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <BookOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    <span style={{ fontSize: 18, fontWeight: 'bold' }}>ERP4U Docs</span>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[selectedKey]}
                    onClick={(e) => setSelectedKey(e.key)}
                    style={{ borderRight: 0 }}
                    items={[
                        { key: 'intro', icon: <RocketOutlined />, label: 'Giới thiệu chung' },
                        { key: 'changelog', icon: <GiftOutlined />, label: <span style={{ color: '#52c41a', fontWeight: 600 }}>Tính năng mới 🎉</span> },
                        { type: 'divider' },
                        {
                            key: 'sub1',
                            label: 'Phân hệ Bán Hàng',
                            icon: <ShopOutlined />,
                            children: [

                                { key: 'bod-dashboard', label: 'BOD Dashboard' },
                                { key: 'sales-process', label: 'Quy trình Bán hàng' },
                                { key: 'internal-sales', label: 'Bán hàng Nội bộ' }, // <--- NEW
                                { key: 'sales-create', label: 'Tạo đơn mới' },
                                { key: 'sales-contract-builder', label: 'Soạn Hợp Đồng' }, // <--- NEW Contract Builder
                                { key: 'sales-approval', label: 'Duyệt mẫu' },
                                { key: 'sales-revisions', label: 'Quản lý version (Báo giá)' }, // <--- NEW
                                { key: 'booking-stock', label: 'Booking Giữ Kho' }, // <--- NEW Booking
                                { key: 'sales-pos', label: 'Bán Lẻ (POS)' }, // <--- NEW POS
                                { key: 'sales-portal', label: 'Customer Portal' },
                                { key: 'sales-easyinvoice', label: 'Xuất Hóa Đơn EasyInvoice' }, // <--- NEW EasyInvoice
                                { key: 'sales-payment', label: 'Thanh toán & Tất toán' }, // <--- NEW PAYMENT
                                { key: 'price-list', label: 'Chính sách giá' },
                            ]
                        },
                        {
                            key: 'sub2',
                            label: 'Phân hệ Khách Hàng',
                            icon: <UserOutlined />,
                            children: [
                                { key: 'customers', label: 'Danh Sách & Công Nợ' },
                                { key: 'reminders', label: 'Nhắc Việc & Chăm Sóc' },
                            ]
                        },
                        {
                            key: 'sub3',
                            label: 'Phân hệ Tài Chính',
                            icon: <DollarOutlined />,
                            children: [
                                { key: 'finance-guide', label: 'Quản lý Thu/Chi' },
                                { key: 'finance-supplier-payment', label: 'Công Nợ & Thanh Toán PO' },
                                { key: 'finance-so-profit', label: 'Tính Lợi Nhuận Đơn Hàng' },
                                { key: 'finance-credits', label: 'Quản Lý Credit Khách Hàng' },
                            ]
                        },
                        {
                            key: 'sub4',
                            label: 'Phân hệ Sản Xuất',
                            icon: <ExperimentOutlined />,
                            children: [
                                { key: 'mrp-guide', label: 'SOP: Lập Kế Hoạch (MRP)' },
                                { key: 'mrp-tracking', label: 'Tiến độ & Theo dõi' },
                                { key: 'mrp-nesting', label: 'Công cụ Xếp Sơ đồ (2D Nesting)' },
                                { key: 'po-npl', label: 'PO Nguyên Phụ Liệu' },
                                { key: 'po-gc', label: 'PO Gia Công' },
                                { key: 'product-guide', label: 'Cấu trúc Sản phẩm' },
                                { key: 'combo-guide', label: 'Quản lý Combo' },
                            ]
                        },
                        {
                            key: 'sub5',
                            label: 'Phân hệ Kho Vận',
                            icon: <ContainerOutlined />,
                            children: [
                                { key: 'inventory-guide', label: 'Kho & Quy đổi Đơn vị' },
                                { key: 'supplier-stock', label: 'Tồn Kho NPL Nhà Gia Công' },
                            ]
                        },
                        {
                            key: 'sub6',
                            label: 'Phân hệ Nhân Sự (HR)',
                            icon: <TeamOutlined />,
                            children: [
                                { key: 'hr-overview', label: 'Tổng quan HR' },
                                { key: 'hr-attendance', label: 'Chấm công & Calendar' },
                                { key: 'hr-leave', label: 'Nghỉ phép & Số dư' },
                                { key: 'hr-payslip', label: 'Phiếu lương' },
                                { key: 'hr-profile', label: 'Hồ sơ cá nhân' },
                            ]
                        }
                    ]}
                />
            </Sider>
            <Layout style={{ padding: '0 24px 24px' }}>
                <Breadcrumb style={{ margin: '16px 0' }} items={[{ title: 'Knowledge Base' }, { title: selectedKey }]} />
                <Content
                    style={{
                        padding: 24,
                        margin: 0,
                        minHeight: 280,
                        background: '#fff',
                        borderRadius: 8,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    {renderContent()}
                </Content>
            </Layout>
        </Layout>
    );
};

export default HelpPage;

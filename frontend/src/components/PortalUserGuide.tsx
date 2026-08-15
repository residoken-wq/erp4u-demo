import React, { useState } from 'react';

const PortalUserGuide: React.FC = () => {
    const [expanded, setExpanded] = useState<number | null>(null);

    const toggle = (index: number) => {
        setExpanded(expanded === index ? null : index);
    };

    const guides = [
        {
            title: '1. Cách theo dõi đơn hàng',
            icon: '📍',
            content: (
                <div>
                    <p style={S.text}>Để theo dõi tiến độ đơn hàng của bạn:</p>
                    <ul style={S.list}>
                        <li>Kéo xuống phần <strong>Lịch Sử Đơn Hàng</strong>.</li>
                        <li>Tìm đơn hàng bạn muốn kiểm tra.</li>
                        <li>Nhấn vào nút <button style={S.fakeBtn}>👁 Theo dõi</button> ở góc dưới bên phải của đơn hàng đó.</li>
                        <li>Một tiến trình (Timeline) sẽ hiện ra cho biết đơn hàng đang ở bước nào (Tạo đơn, Sản xuất, Giao hàng...).</li>
                    </ul>
                </div>
            )
        },
        {
            title: '2. Cách đặt lại đơn hàng cũ',
            icon: '🔁',
            content: (
                <div>
                    <p style={S.text}>Nếu bạn muốn đặt lại một đơn hàng đã từng đặt:</p>
                    <ul style={S.list}>
                        <li>Trong phần <strong>Lịch Sử Đơn Hàng</strong>, nhấn vào nút <button style={{...S.fakeBtn, ...S.fakeBtnPrimary}}>🔁 Đặt lại</button>.</li>
                        <li>Một cửa sổ sẽ hiện lên chứa danh sách các sản phẩm của đơn hàng cũ.</li>
                        <li>Bạn có thể tăng/giảm số lượng cho từng sản phẩm.</li>
                        <li>Nếu muốn đặt số lượng <strong>ít hơn</strong> đơn cũ, hãy tick vào ô "Cho phép đặt số lượng ít hơn" và bắt buộc phải điền <strong>Ghi chú</strong> (Ví dụ: "chỉ cần 5 cái màu đỏ").</li>
                        <li>Cuối cùng nhấn <strong>Gửi Yêu Cầu Đặt Lại</strong>.</li>
                    </ul>
                </div>
            )
        },
        {
            title: '3. Cách đặt hàng theo chương trình khuyến mãi (Promotion)',
            icon: '🎁',
            content: (
                <div>
                    <p style={S.text}>Để nhận các ưu đãi đặc biệt dành riêng cho bạn:</p>
                    <ul style={S.list}>
                        <li>Kéo lên phần <strong>Ưu Đãi Dành Cho Bạn</strong> (hiển thị khi có khuyến mãi).</li>
                        <li>Nhấn vào nút <button style={{...S.fakeBtn, ...S.fakeBtnPrimary}}>🛒 Xem & Đặt hàng</button> tại chương trình khuyến mãi mong muốn.</li>
                        <li>Chọn số lượng cho các sản phẩm nằm trong chương trình khuyến mãi.</li>
                        <li>Hệ thống sẽ tự động tính toán số tiền được giảm giá ở phần <strong>Tạm tính</strong>.</li>
                        <li>Nhấn <strong>Tạo Báo Giá Từ Ưu Đãi</strong> để gửi yêu cầu cho Sales xử lý.</li>
                    </ul>
                </div>
            )
        }
    ];

    return (
        <section style={S.section}>
            <div style={S.card}>
                <div style={S.header}>
                    <div style={S.headerTitle}>
                        <span style={S.headerIcon}>📚</span>
                        <h2 style={S.title}>Hướng dẫn sử dụng nhanh</h2>
                    </div>
                    <p style={S.subtitle}>Cách thao tác các tính năng chính trên Cổng Đối Tác B2B</p>
                </div>

                <div style={S.accordion}>
                    {guides.map((guide, index) => {
                        const isExpanded = expanded === index;
                        return (
                            <div key={index} style={{
                                ...S.item,
                                borderColor: isExpanded ? '#23A7D3' : '#eee',
                                backgroundColor: isExpanded ? '#fbfdfd' : '#fff'
                            }}>
                                <button 
                                    style={S.itemButton} 
                                    onClick={() => toggle(index)}
                                >
                                    <div style={S.itemTitle}>
                                        <span style={S.itemIcon}>{guide.icon}</span>
                                        <span style={{
                                            fontWeight: isExpanded ? 700 : 600,
                                            color: isExpanded ? '#23A7D3' : '#333'
                                        }}>{guide.title}</span>
                                    </div>
                                    <span style={{
                                        ...S.chevron,
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                    }}>▼</span>
                                </button>
                                
                                {isExpanded && (
                                    <div style={S.itemContent}>
                                        {guide.content}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

const S: Record<string, React.CSSProperties> = {
    section: {
        marginBottom: 32,
    },
    card: {
        background: '#fff',
        borderRadius: 20,
        border: '1px solid #e8e8e8',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        overflow: 'hidden',
    },
    header: {
        padding: '20px 24px',
        borderBottom: '1px solid #eee',
        background: 'linear-gradient(to right, #fbfdfd, #fff)',
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 4,
    },
    headerIcon: {
        fontSize: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: 800,
        color: '#1a1a1a',
        margin: 0,
    },
    subtitle: {
        fontSize: 13,
        color: '#888',
        margin: 0,
        marginLeft: 36,
    },
    accordion: {
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    item: {
        border: '1px solid',
        borderRadius: 12,
        transition: 'all 0.2s ease',
    },
    itemButton: {
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    itemTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 15,
    },
    itemIcon: {
        fontSize: 18,
    },
    chevron: {
        fontSize: 12,
        color: '#aaa',
        transition: 'transform 0.3s ease',
    },
    itemContent: {
        padding: '0 16px 20px 44px',
        animation: 'fadeInDown 0.3s ease',
    },
    text: {
        fontSize: 14,
        color: '#555',
        marginBottom: 12,
        lineHeight: 1.5,
    },
    list: {
        margin: 0,
        paddingLeft: 20,
        color: '#555',
        fontSize: 14,
        lineHeight: 1.8,
    },
    fakeBtn: {
        display: 'inline-block',
        padding: '2px 8px',
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 12,
        fontSize: 11,
        color: '#555',
        margin: '0 4px',
        verticalAlign: 'middle',
    },
    fakeBtnPrimary: {
        background: 'linear-gradient(135deg, #23A7D3, #1e8fb5)',
        color: '#fff',
        border: 'none',
        fontWeight: 600,
    }
};

export default PortalUserGuide;

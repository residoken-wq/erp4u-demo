import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, InputNumber, Space, Form, Table, message, Row, Col, Switch } from 'antd';
import { DownloadOutlined, AppstoreAddOutlined, ClearOutlined } from '@ant-design/icons';
import { Stage, Layer, Rect as KonvaRect, Text as KonvaText, Image as KonvaImage, Transformer, Group } from 'react-konva';
import { packRectangles, Rect, Bin } from '../../utils/binPacking';

interface NestingMarkerToolProps {
    // We can pass pre-loaded designs/logos if needed
}

const NestingMarkerTool: React.FC<NestingMarkerToolProps> = () => {
    const [bin, setBin] = useState<Bin>({ w: 400, h: 120 }); // Example: 400cm length x 120cm width
    const [rects, setRects] = useState<Rect[]>([]);
    const [packedRects, setPackedRects] = useState<Rect[]>([]);
    const [unpackedRects, setUnpackedRects] = useState<Rect[]>([]);
    const [allowRotation, setAllowRotation] = useState(true);
    const [padding, setPadding] = useState(2); // 2cm padding between items
    
    // Scale factor to fit the canvas on screen
    const CANVAS_DISPLAY_WIDTH = 800;
    const scale = CANVAS_DISPLAY_WIDTH / bin.w;
    const CANVAS_DISPLAY_HEIGHT = bin.h * scale;

    const stageRef = useRef<any>(null);
    const [selectedId, selectShape] = useState<string | null>(null);
    const trRef = useRef<any>(null);

    // Form to add items
    const [form] = Form.useForm();

    const handleAddItem = (values: any) => {
        const newRects: Rect[] = [];
        for (let i = 0; i < values.quantity; i++) {
            newRects.push({
                id: `${Date.now()}-${i}`,
                w: values.width,
                h: values.height,
                data: { name: values.name, color: '#' + Math.floor(Math.random()*16777215).toString(16) }
            });
        }
        setRects([...rects, ...newRects]);
        message.success(`Đã thêm ${values.quantity} mảnh: ${values.name}`);
        form.resetFields();
    };

    const handleAutoPack = () => {
        if (rects.length === 0) {
            message.warning('Vui lòng thêm mảnh thiết kế để xếp');
            return;
        }
        const result = packRectangles(bin, rects, padding, allowRotation);
        setPackedRects(result.packed);
        setUnpackedRects(result.unpacked);
        if (result.unpacked.length > 0) {
            message.warning(`Có ${result.unpacked.length} mảnh không vừa khổ vải. Hãy thử vải dài hơn hoặc cho phép xoay.`);
        } else {
            message.success('Đã xếp xong tất cả các mảnh!');
        }
    };

    const handleClear = () => {
        setRects([]);
        setPackedRects([]);
        setUnpackedRects([]);
        selectShape(null);
    };

    const handleExport = () => {
        if (stageRef.current) {
            const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `sodo-vai-${Date.now()}.png`;
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const checkDeselect = (e: any) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            selectShape(null);
        }
    };

    useEffect(() => {
        if (selectedId && trRef.current) {
            // we need to attach transformer manually
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) {
                trRef.current.nodes([node]);
                trRef.current.getLayer().batchDraw();
            }
        }
    }, [selectedId]);

    return (
        <Row gutter={16}>
            <Col span={8}>
                <Card title="Cấu hình Vải (Bin)" size="small" style={{ marginBottom: 16 }}>
                    <Form layout="inline">
                        <Form.Item label="Chiều dài (cm)">
                            <InputNumber value={bin.w} onChange={(v) => setBin({ ...bin, w: v || 400 })} min={50} />
                        </Form.Item>
                        <Form.Item label="Chiều rộng (cm)">
                            <InputNumber value={bin.h} onChange={(v) => setBin({ ...bin, h: v || 120 })} min={50} />
                        </Form.Item>
                    </Form>
                </Card>

                <Card title="Thêm mảnh In/Thêu" size="small" style={{ marginBottom: 16 }}>
                    <Form form={form} layout="vertical" onFinish={handleAddItem}>
                        <Row gutter={8}>
                            <Col span={12}>
                                <Form.Item name="name" label="Tên thiết kế" rules={[{ required: true }]}>
                                    <input className="ant-input" placeholder="Túi 50x40" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="quantity" label="Số lượng" initialValue={1} rules={[{ required: true }]}>
                                    <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={8}>
                            <Col span={12}>
                                <Form.Item name="width" label="Rộng (cm)" rules={[{ required: true }]}>
                                    <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="height" label="Cao (cm)" rules={[{ required: true }]}>
                                    <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Button type="primary" htmlType="submit" icon={<AppstoreAddOutlined />} block>Thêm vào danh sách chờ</Button>
                    </Form>
                </Card>

                <Card title={`Danh sách chờ (${rects.length} mảnh)`} size="small">
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <Button onClick={handleAutoPack} type="primary" style={{ backgroundColor: '#52c41a' }}>Tự động Xếp sơ đồ</Button>
                        <Button onClick={handleExport} icon={<DownloadOutlined />}>Xuất Ảnh</Button>
                        <Button danger onClick={handleClear} icon={<ClearOutlined />}>Xóa hết</Button>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <div>
                            <span>Khoảng cách biên (Padding): </span>
                            <InputNumber value={padding} onChange={(v) => setPadding(v || 0)} min={0} max={10} size="small" /> cm
                        </div>
                        <div>
                            <span>Cho phép tự động xoay ngang dọc: </span>
                            <Switch checked={allowRotation} onChange={setAllowRotation} />
                        </div>
                    </Space>
                </Card>
            </Col>

            <Col span={16}>
                <Card title="Sơ đồ Vải (Canvas) - Có thể kéo thả (Manual Drag & Drop)" size="small">
                    <div style={{ backgroundColor: '#f0f2f5', border: '1px dashed #d9d9d9', overflowX: 'auto', padding: 10 }}>
                        <div style={{ width: CANVAS_DISPLAY_WIDTH, height: CANVAS_DISPLAY_HEIGHT, backgroundColor: 'white', position: 'relative', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                            <Stage 
                                width={CANVAS_DISPLAY_WIDTH} 
                                height={CANVAS_DISPLAY_HEIGHT} 
                                ref={stageRef}
                                onMouseDown={checkDeselect}
                                onTouchStart={checkDeselect}
                            >
                                <Layer>
                                    {packedRects.map((rect, i) => (
                                        <Group 
                                            key={rect.id}
                                            id={rect.id.toString()}
                                            x={(rect.x || 0) * scale} 
                                            y={(rect.y || 0) * scale}
                                            draggable
                                            onClick={() => selectShape(rect.id.toString())}
                                            onTap={() => selectShape(rect.id.toString())}
                                            onDragEnd={(e) => {
                                                // Update position in state if needed
                                                const newPacked = [...packedRects];
                                                newPacked[i].x = e.target.x() / scale;
                                                newPacked[i].y = e.target.y() / scale;
                                                setPackedRects(newPacked);
                                            }}
                                        >
                                            <KonvaRect
                                                width={rect.w * scale}
                                                height={rect.h * scale}
                                                fill={rect.data?.color || '#1890ff'}
                                                opacity={0.8}
                                                stroke="#000"
                                                strokeWidth={1}
                                            />
                                            <KonvaText
                                                text={`${rect.data?.name || 'Mảnh'} (${rect.w}x${rect.h})`}
                                                fontSize={12}
                                                fill="#fff"
                                                align="center"
                                                width={rect.w * scale}
                                                y={(rect.h * scale) / 2 - 6}
                                            />
                                        </Group>
                                    ))}
                                    {selectedId && (
                                        <Transformer
                                            ref={trRef}
                                            boundBoxFunc={(oldBox, newBox) => {
                                                // limit resize
                                                if (newBox.width < 5 || newBox.height < 5) {
                                                    return oldBox;
                                                }
                                                return newBox;
                                            }}
                                            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                                            rotationSnaps={[0, 90, 180, 270]}
                                        />
                                    )}
                                </Layer>
                            </Stage>
                        </div>
                    </div>
                    {unpackedRects.length > 0 && (
                        <div style={{ marginTop: 16, color: 'red' }}>
                            <b>Cảnh báo:</b> Có {unpackedRects.length} mảnh chưa thể xếp vào vải do không đủ diện tích!
                        </div>
                    )}
                </Card>
            </Col>
        </Row>
    );
};

export default NestingMarkerTool;

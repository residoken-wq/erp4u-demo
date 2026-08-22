import React, { useState, useEffect, useRef } from 'react';
import { Steps, Card, Table, Button, Select, InputNumber, Row, Col, Space, message, Upload, Divider, Switch, Tabs, Input, Tag, Alert, Modal, List } from 'antd';
import { UploadOutlined, FilePdfOutlined, FileImageOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, CopyOutlined, LockOutlined, UnlockOutlined, SearchOutlined } from '@ant-design/icons';
import { Stage, Layer, Rect as KonvaRect, Image as KonvaImage, Transformer, Group, Text as KonvaText, Arrow as KonvaArrow, Line as KonvaLine } from 'react-konva';
import useImage from 'use-image';
import jsPDF from 'jspdf';
import api from '../../utils/api';
import { packMultipleBins, Bin, Rect, BinResult, packContinuous } from '../../utils/binPacking';

const { Step } = Steps;

// A custom component to handle image loading in Konva
const URLImage = ({ image, x, y, width, height, isSelected, onSelect, onChange }: any) => {
    const [img, setImg] = useState<HTMLImageElement | undefined>(undefined);
    const shapeRef = useRef<any>();
    const trRef = useRef<any>();

    useEffect(() => {
        const imageObj = new Image();
        imageObj.crossOrigin = 'anonymous';
        imageObj.src = image;
        imageObj.onload = () => {
            setImg(imageObj);
        };
    }, [image]);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected, img]);

    if (!img) return null;

    return (
        <React.Fragment>
            <KonvaImage
                image={img}
                x={x}
                y={y}
                width={width}
                height={height}
                ref={shapeRef}
                draggable
                onClick={onSelect}
                onTap={onSelect}
                onDragEnd={(e) => {
                    onChange({
                        x: e.target.x(),
                        y: e.target.y(),
                        width: width,
                        height: height
                    });
                }}
                onTransformEnd={(e) => {
                    const node = shapeRef.current;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    onChange({
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY)
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 10 || newBox.height < 10) {
                            return oldBox;
                        }
                        return newBox;
                    }}
                />
            )}
        </React.Fragment>
    );
};

// --- Step 3 Interactive Rect Component ---
const DraggableRect = ({ rect, scale, face, isSelected, onSelect, onChange, onRemove }: any) => {
    const shapeRef = useRef<any>();
    const trRef = useRef<any>();
    const [logoImage] = useImage(rect.data?.logoUrl || '', 'anonymous');

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    return (
        <React.Fragment>
            <Group
                ref={shapeRef}
                x={(rect.x || 0) * scale}
                y={(rect.y || 0) * scale}
                rotation={rect.rotation !== undefined ? rect.rotation : (rect.rotated ? 90 : 0)}
                offsetX={0}
                offsetY={rect.rotated ? rect.h * scale : 0}
                draggable
                onClick={onSelect}
                onTap={onSelect}
                onDblClick={(e) => {
                    e.cancelBubble = true;
                    const currentRotation = rect.rotation !== undefined ? rect.rotation : (rect.rotated ? 90 : 0);
                    onChange({
                        ...rect,
                        rotation: currentRotation + 90
                    });
                }}
                onDblTap={(e) => {
                    e.cancelBubble = true;
                    const currentRotation = rect.rotation !== undefined ? rect.rotation : (rect.rotated ? 90 : 0);
                    onChange({
                        ...rect,
                        rotation: currentRotation + 90
                    });
                }}
                onDragMove={(e) => {
                    // Snap to 1cm grid
                    const snapSize = scale;
                    const x = Math.round(e.target.x() / snapSize) * snapSize;
                    const y = Math.round(e.target.y() / snapSize) * snapSize;
                    e.target.x(x);
                    e.target.y(y);
                }}
                onDragEnd={(e) => {
                    onChange({
                        ...rect,
                        x: Math.round(e.target.x() / scale),
                        y: Math.round(e.target.y() / scale)
                    });
                }}
                onTransformEnd={(e) => {
                    const node = shapeRef.current;
                    onChange({
                        ...rect,
                        x: Math.round(node.x() / scale),
                        y: Math.round(node.y() / scale),
                        rotation: Math.round(node.rotation() / 90) * 90
                    });
                }}
            >
                <KonvaRect
                    width={rect.w * scale}
                    height={rect.h * scale}
                    fill={rect.data?.color || '#e6f7ff'}
                    stroke={isSelected ? '#1890ff' : '#91d5ff'}
                    strokeWidth={isSelected ? 2 : 1}
                />
                
                {rect.data?.name && (
                    <KonvaText
                        text={rect.data.name}
                        width={rect.w * scale}
                        height={rect.h * scale}
                        align="center"
                        verticalAlign="middle"
                        fontSize={12}
                        fill="#000"
                        listening={false}
                    />
                )}

                {rect.data?.logoUrl && rect.data?.logoConfig && (
                    <KonvaImage
                        image={logoImage || undefined}
                        x={(rect.data.logoConfig.x / face.pieceSize.w) * rect.w * scale || 0}
                        y={(rect.data.logoConfig.y / face.pieceSize.h) * rect.h * scale || 0}
                        width={(rect.data.logoConfig.width / face.pieceSize.w) * rect.w * scale || 0}
                        height={(rect.data.logoConfig.height / face.pieceSize.h) * rect.h * scale || 0}
                        listening={false}
                    />
                )}

                {/* Kích thước (Dimensions) */}
                <Group listening={false}>
                    {/* Đường dọc */}
                    <KonvaLine
                        points={[5, rect.h * scale - 10, rect.w * scale - 5, rect.h * scale - 10]}
                        stroke="red"
                        strokeWidth={1}
                        dash={[2, 2]}
                    />
                    <KonvaLine
                        points={[5, rect.h * scale - 15, 5, rect.h * scale - 5]}
                        stroke="red"
                        strokeWidth={1}
                    />
                    <KonvaLine
                        points={[rect.w * scale - 5, rect.h * scale - 15, rect.w * scale - 5, rect.h * scale - 5]}
                        stroke="red"
                        strokeWidth={1}
                    />
                    <KonvaText
                        text={`${rect.w} cm`}
                        fontSize={10}
                        fill="red"
                        x={rect.w * scale / 2 - 15}
                        y={rect.h * scale - 25}
                    />

                    {/* Đường ngang */}
                    <KonvaLine
                        points={[rect.w * scale - 10, 5, rect.w * scale - 10, rect.h * scale - 5]}
                        stroke="red"
                        strokeWidth={1}
                        dash={[2, 2]}
                    />
                    <KonvaLine
                        points={[rect.w * scale - 15, 5, rect.w * scale - 5, 5]}
                        stroke="red"
                        strokeWidth={1}
                    />
                    <KonvaLine
                        points={[rect.w * scale - 15, rect.h * scale - 5, rect.w * scale - 5, rect.h * scale - 5]}
                        stroke="red"
                        strokeWidth={1}
                    />
                    <KonvaText
                        text={`${rect.h} cm`}
                        fontSize={10}
                        fill="red"
                        x={rect.w * scale - 25}
                        y={rect.h * scale / 2 + 15}
                        rotation={-90}
                    />
                </Group>
                
                {isSelected && rect.id.startsWith('custom-') && (
                    <Group
                        x={rect.w * scale - 10}
                        y={-10}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            if (onRemove) onRemove();
                        }}
                        onTap={(e) => {
                            e.cancelBubble = true;
                            if (onRemove) onRemove();
                        }}
                    >
                        <KonvaRect width={20} height={20} fill="red" cornerRadius={10} offsetX={10} offsetY={10} />
                        <KonvaText text="X" x={-4} y={-5} fill="white" fontSize={12} fontStyle="bold" />
                    </Group>
                )}
            </Group>
            {isSelected && (
                <Transformer
                    ref={trRef}
                    rotateEnabled={true}
                    resizeEnabled={false} // Chỉ cho phép xoay
                />
            )}
        </React.Fragment>
    );
};

const RulerLayer = ({ width, height, scale, offsetX = 0, offsetY = 0 }: { width: number, height: number, scale: number, offsetX?: number, offsetY?: number }) => {
    const ticksX = [];
    for(let i=0; i<=width; i+=50) {
        ticksX.push(<KonvaRect key={`x${i}`} x={offsetX + i * scale} y={offsetY - 10} width={1} height={10} fill="red" />);
        ticksX.push(<KonvaText key={`xt${i}`} x={offsetX + i * scale + 2} y={offsetY - 25} text={`${i}cm`} fontSize={12} fill="red" />);
    }
    const ticksY = [];
    for(let i=0; i<=height; i+=50) {
        if (i === 0) continue;
        ticksY.push(<KonvaRect key={`y${i}`} x={offsetX - 10} y={offsetY + i * scale} width={10} height={1} fill="red" />);
        ticksY.push(<KonvaText key={`yt${i}`} x={offsetX - 35} y={offsetY + i * scale - 5} text={`${i}cm`} fontSize={12} fill="red" />);
    }

    return (
        <Layer>
            {ticksX}
            {ticksY}
        </Layer>
    );
};

interface UnifiedDesignWorkflowProps {
    standaloneProduct?: any;
    onStandaloneComplete?: () => void;
    initialMarker?: any;
}

const UnifiedDesignWorkflow: React.FC<UnifiedDesignWorkflowProps> = ({ standaloneProduct, onStandaloneComplete, initialMarker }) => {
    // --- Global State ---
    const [currentStep, setCurrentStep] = useState(0);

    // --- Step 1 Data ---
    const [poList, setPoList] = useState<any[]>([]);
    const [selectedPo, setSelectedPo] = useState<any>(null);
    const [selectedItem, setSelectedItem] = useState<any>(
        standaloneProduct 
            ? { id: 'standalone', product: standaloneProduct, product_id: standaloneProduct.id, quantity: 100 }
            : null
    );
    const [loadingPo, setLoadingPo] = useState(false);
    
    // --- Step 1 Filter Data ---
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

    // --- Copy Design Modal Data ---
    const [isCopyModalVisible, setIsCopyModalVisible] = useState(false);
    const [savedDesigns, setSavedDesigns] = useState<any[]>([]);
    
    // --- Auto-Load Marker Modal Data ---
    const [isLoadSavedMarkerModalVisible, setIsLoadSavedMarkerModalVisible] = useState(false);
    const [savedProductMarkers, setSavedProductMarkers] = useState<any[]>([]);
    
    // --- Step 3 Data ---
    const [lockedFaces, setLockedFaces] = useState<Record<string, boolean>>({});
    const [isAutoPackModalVisible, setIsAutoPackModalVisible] = useState(false);
    const [autoPackOrientation, setAutoPackOrientation] = useState<'width' | 'height'>('width');
    const [autoPackForce, setAutoPackForce] = useState<boolean>(true);
    
    // --- Save Modal Data ---
    const [isSaveNameModalVisible, setIsSaveNameModalVisible] = useState(false);
    const [saveDesignName, setSaveDesignName] = useState('');

    useEffect(() => {
        if (isCopyModalVisible) {
            fetchSavedDesigns();
        }
    }, [isCopyModalVisible]);

    useEffect(() => {
        if (initialMarker && initialMarker.tech_pack && initialMarker.tech_pack.faces) {
            setFaces(initialMarker.tech_pack.faces);
            setBinsByFace(initialMarker.tech_pack.binsByFace || { 'face-1': [{ w: 400, h: 120 }] });
            setPadding(initialMarker.tech_pack.padding ?? 2);
            setAllowRotation(initialMarker.tech_pack.allowRotation ?? true);
            if (initialMarker.tech_pack.continuousConfigs) {
                setContinuousConfigs(initialMarker.tech_pack.continuousConfigs);
            }
            if (initialMarker.tech_pack.resultsByFace) {
                setResultsByFace(initialMarker.tech_pack.resultsByFace);
            }
            setSaveDesignName(initialMarker.name || '');
            setCurrentStep(2); // Jump to layout step
        }
    }, [initialMarker]);

    const fetchSavedDesigns = async () => {
        try {
            const res = await api.get('/designs/print-designs');
            setSavedDesigns(res.data);
        } catch (e) {
            message.error('Lỗi lấy danh sách sơ đồ');
        }
    };

    const handleCopyDesign = (design: any) => {
        if (design.tech_pack && design.tech_pack.faces) {
            setFaces(design.tech_pack.faces);
            setBinsByFace(design.tech_pack.binsByFace || { 'face-1': [{ w: 400, h: 120 }] });
            setPadding(design.tech_pack.padding ?? 2);
            setAllowRotation(design.tech_pack.allowRotation ?? true);
            if (design.tech_pack.continuousConfigs) {
                setContinuousConfigs(design.tech_pack.continuousConfigs);
            }
            if (design.tech_pack.resultsByFace) {
                setResultsByFace(design.tech_pack.resultsByFace);
            }
            message.success(`Đã sao chép cấu hình từ: ${design.name}`);
            setIsCopyModalVisible(false);
        } else {
            message.warning('Sơ đồ này không có dữ liệu cấu hình hợp lệ');
        }
    };

    const handleSaveDesign = () => {
        if (!selectedItem) {
            message.warning('Chưa chọn sản phẩm!');
            return;
        }
        setSaveDesignName(`Sơ đồ ${selectedItem.product?.name || selectedItem.material?.name || 'Sản phẩm'}`);
        setIsSaveNameModalVisible(true);
    };

    const confirmSaveDesign = async () => {
        setIsSaveNameModalVisible(false);
        try {
            const dataToSave = {
                code: initialMarker ? initialMarker.code : `SD-${Date.now()}`,
                name: saveDesignName || `Sơ đồ ${selectedItem.product?.name || selectedItem.material?.name || 'Sản phẩm'}`,
                type: 'PRINT',
                product_id: selectedItem.product?.id,
                customer_id: selectedPo?.pfo?.sales_order?.customer_id || selectedPo?.plan?.sales_orders?.[0]?.customer_id || selectedPo?.customer_id || null,
                tech_pack: {
                    faces,
                    binsByFace,
                    padding,
                    allowRotation,
                    resultsByFace,
                    continuousConfigs
                }
            };
            let savedDesign;
            if (initialMarker && initialMarker.id) {
                const res = await api.put(`/designs/print-designs/${initialMarker.id}`, dataToSave);
                savedDesign = res.data;
                message.success('Đã cập nhật sơ đồ thành công!');
            } else {
                const res = await api.post('/designs/print-designs', dataToSave);
                savedDesign = res.data;
                message.success('Đã lưu sơ đồ vào hệ thống!');
            }
            
            if (!standaloneProduct && selectedPo && selectedItem.id !== 'standalone') {
                await api.put(`/purchasing/${selectedPo.id}`, {
                    items: [{ id: selectedItem.id, print_design_id: savedDesign.id }]
                });
                
                setSelectedItem({ ...selectedItem, print_design: savedDesign });
                
                setPoList(prev => prev.map(po => {
                    if (po.id === selectedPo.id) {
                        return {
                            ...po,
                            items: po.items.map((i: any) => i.id === selectedItem.id ? { ...i, print_design: savedDesign } : i)
                        };
                    }
                    return po;
                }));
            }
            
            if (standaloneProduct && onStandaloneComplete) {
                onStandaloneComplete();
            }
        } catch (e) {
            console.error('Lỗi lưu sơ đồ', e);
            message.error('Lỗi khi lưu sơ đồ!');
        }
    };

    // --- Step 2 Data: Multi-Face Support ---
    const [faces, setFaces] = useState<any[]>([
        { id: 'face-1', name: 'Mặt trước', pieceSize: { w: 50, h: 40 }, bgColor: '#e6f7ff', logoUrl: null, processedLogoUrl: null, removeTolerance: 240, logoColor: 'original', logoConfig: { x: 0, y: 0, width: 0, height: 0 }, selectedId: null, fabricType: 'Canvas' }
    ]);
    const [activeFaceKey, setActiveFaceKey] = useState('face-1');

    // --- Step 3 Data: Multi-Bin per Face ---
    const [binsByFace, setBinsByFace] = useState<Record<string, Bin[]>>({
        'face-1': [{ w: 400, h: 120 }]
    });
    const [resultsByFace, setResultsByFace] = useState<Record<string, { binResults: BinResult[], unpacked: Rect[] }>>({});
    
    const [padding, setPadding] = useState(2);
    const [allowRotation, setAllowRotation] = useState(true);
    const stageRefs = useRef<Record<string, any[]>>({}); // Refs for multiple canvases mapped by faceId

    const [packingMode, setPackingMode] = useState<'CONTINUOUS' | 'FIXED_BINS'>('CONTINUOUS');
    const [continuousConfigs, setContinuousConfigs] = useState<Record<string, { width: number, qtyPerFile: number, totalQty: number, manualLength?: number }>>({});
    const [printOverrides, setPrintOverrides] = useState<Record<string, { length?: number, runs?: number }>>({});

    const [selectedPiece, setSelectedPiece] = useState<{faceId: string, binIdx: number, rectId: string} | null>(null);
    const [customPiece, setCustomPiece] = useState({ name: 'Túi hông', w: 10, h: 10, color: '#ffec3d' });

    const handleAddCustomPiece = (faceId: string, binIdx: number) => {
        const newResults = {...resultsByFace};
        const packed = newResults[faceId].binResults[binIdx].packed;
        packed.push({
            id: `custom-${Date.now()}`,
            x: 0,
            y: 0,
            w: customPiece.w,
            h: customPiece.h,
            rotated: false,
            data: {
                color: customPiece.color,
                name: customPiece.name,
                logoConfig: { width: 0, height: 0, x:0, y:0 }
            }
        });

        // Recalculate stats for continuous mode
        if (packingMode === 'CONTINUOUS' && newResults[faceId].stats) {
            let maxLength = 0;
            let totalArea = 0;
            packed.forEach((r: any) => {
                const rW = r.rotated || r.rotation === -90 || r.rotation === 90 || r.rotation === 270 ? r.h : r.w;
                const rH = r.rotated || r.rotation === -90 || r.rotation === 90 || r.rotation === 270 ? r.w : r.h;
                const bottomEdge = (r.y || 0) + rH;
                if (bottomEdge > maxLength) maxLength = bottomEdge;
                totalArea += (r.w * r.h);
            });
            const stats = newResults[faceId].stats;
            stats.length = maxLength;
            stats.expectedTotalLength = stats.runs * maxLength;
            stats.wasteArea = Math.max(0, (maxLength * stats.width) - totalArea);
            newResults[faceId].binResults[binIdx].h = maxLength;
        }

        setResultsByFace(newResults);
        message.success('Đã thêm chi tiết phụ vào Sơ đồ');
    };

    useEffect(() => {
        fetchPOs();
    }, []);

    const fetchPOs = async () => {
        setLoadingPo(true);
        try {
            const res = await api.get('/purchasing');
            const data = Array.isArray(res.data) ? res.data : [];
            const isRelevantItem = (item: any) => {
                const name = (item.description || item.product?.name || item.material?.name || '').toLowerCase();
                return name.includes('gia công in');
            };

            const filtered = data.filter((po: any) => 
                po.type === 'OUTSOURCING' && 
                ['DRAFT', 'ORDERED', 'SENT', 'CONFIRMED'].includes(po.status) &&
                po.items && po.items.some(isRelevantItem)
            );
            setPoList(filtered);
        } catch (e) {
            message.error('Lỗi tải danh sách PO');
        }
        setLoadingPo(false);
    };

    const handleUpload = async (options: any, faceId: string) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', 'erp'); // Prevent CMS from showing this ERP image
        try {
            const res = await api.post('/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            
            setFaces(prev => prev.map(f => {
                if (f.id === faceId) {
                    const newLogoConfig = (!f.logoConfig || f.logoConfig.width === 0) 
                        ? { x: 10, y: 10, width: 20, height: 20 } 
                        : f.logoConfig;
                    return { ...f, logoUrl: res.data.url, logoConfig: newLogoConfig };
                }
                return f;
            }));
            
            onSuccess(res.data.url);
            message.success('Tải logo thành công');
        } catch (e) {
            onError(e);
            message.error('Lỗi tải logo');
        }
    };

    const updateFace = (id: string, updates: any) => {
        setFaces(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    // Background removal logic
    const processImage = (imgUrl: string, tolerance: number, colorMode: string, faceId: string) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                if (r >= tolerance && g >= tolerance && b >= tolerance) {
                    data[i + 3] = 0;
                } else if (data[i + 3] > 0) {
                    if (colorMode === 'white') {
                        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
                    } else if (colorMode === 'black') {
                        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    const processedUrl = URL.createObjectURL(blob);
                    updateFace(faceId, { processedLogoUrl: processedUrl });
                }
            }, 'image/png');
        };
        img.src = imgUrl;
    };

    useEffect(() => {
        faces.forEach(face => {
            if (face.logoUrl) {
                // We re-run processImage if tolerance/color changes.
                // In a real app we'd debounce or check if it actually changed, but it's okay for now.
                processImage(face.logoUrl, face.removeTolerance || 240, face.logoColor || 'original', face.id);
            }
        });
    }, [faces.map(f => f.logoUrl).join(','), faces.map(f => f.removeTolerance).join(','), faces.map(f => f.logoColor).join(',')]);

    const handleAddFace = () => {
        const newId = `face-${Date.now()}`;
        setFaces([...faces, { id: newId, name: `Mặt vải ${faces.length + 1}`, pieceSize: { w: 50, h: 40 }, bgColor: '#fff7e6', logoUrl: null, processedLogoUrl: null, removeTolerance: 240, logoColor: 'original', logoConfig: { x: 10, y: 10, width: 20, height: 20 }, selectedId: null, fabricType: 'Canvas' }]);
        setBinsByFace({ ...binsByFace, [newId]: [{ w: 400, h: 120 }] });
        setActiveFaceKey(newId);
    };

    const handleRemoveFace = (id: string) => {
        if (faces.length === 1) return;
        const newFaces = faces.filter(f => f.id !== id);
        setFaces(newFaces);
        setActiveFaceKey(newFaces[0].id);
    };

    const handleNext = async () => {
        if (!standaloneProduct && currentStep === 0 && !selectedItem) {
            message.warning('Vui lòng chọn 1 sản phẩm trong đơn gia công!');
            return;
        }

        const nextStepIsPack = (!standaloneProduct && currentStep === 1) || (standaloneProduct && currentStep === 0);
        
        if (nextStepIsPack && selectedItem?.product_id) {
            try {
                const res = await api.get(`/designs/print-designs?product_id=${selectedItem.product_id}`);
                const markers = Array.isArray(res.data) ? res.data : [];
                if (markers.length > 0) {
                    setSavedProductMarkers(markers);
                    setIsLoadSavedMarkerModalVisible(true);
                    return; // Wait for modal to proceed to next step
                }
            } catch (e) {
                console.error('Lỗi tải sơ đồ đã lưu', e);
            }
        }

        setCurrentStep(currentStep + 1);
    };

    const handleLoadSavedMarker = (design: any, rotationOption: 'keep' | 'rotate90' | 'repack') => {
        if (design.tech_pack && design.tech_pack.faces) {
            setFaces(design.tech_pack.faces);
            setBinsByFace(design.tech_pack.binsByFace || { 'face-1': [{ w: 400, h: 120 }] });
            setPadding(design.tech_pack.padding ?? 2);
            setAllowRotation(design.tech_pack.allowRotation ?? false);
            if (design.tech_pack.continuousConfigs) {
                setContinuousConfigs(design.tech_pack.continuousConfigs);
            }
            
            if (design.tech_pack.resultsByFace) {
                const results = { ...design.tech_pack.resultsByFace };
                
                if (rotationOption === 'rotate90') {
                    // Xoay 90 độ tất cả mảnh rập
                    Object.keys(results).forEach(faceId => {
                        const faceResult = results[faceId];
                        if (faceResult.binResults) {
                            faceResult.binResults.forEach((bin: any) => {
                                if (bin.packed) {
                                    bin.packed.forEach((rect: any) => {
                                        rect.rotation = (rect.rotation || 0) + 90;
                                    });
                                }
                            });
                        }
                    });
                    setResultsByFace(results);
                } else if (rotationOption === 'keep') {
                    // Giữ nguyên (Manual)
                    setResultsByFace(results);
                }
            }
            
            if (design.tech_pack.continuousConfigs) {
                 setContinuousConfigs(design.tech_pack.continuousConfigs);
            }
        }
        setIsLoadSavedMarkerModalVisible(false);
        setCurrentStep(currentStep + 1);
        
        if (rotationOption === 'repack') {
            setTimeout(() => {
                // Allow state to update before repacking
                if (packingMode === 'CONTINUOUS') {
                    setIsAutoPackModalVisible(true);
                }
            }, 100);
        }
    };

    const handlePrev = () => {
        setCurrentStep(currentStep - 1);
    };

    const handleAddBin = (faceId: string) => {
        const currentBins = binsByFace[faceId] || [];
        setBinsByFace({ ...binsByFace, [faceId]: [...currentBins, { w: 400, h: 120 }] });
    };

    const handleRemoveBin = (faceId: string, index: number) => {
        const currentBins = [...(binsByFace[faceId] || [])];
        currentBins.splice(index, 1);
        setBinsByFace({ ...binsByFace, [faceId]: currentBins });
    };

    const handleBinChange = (faceId: string, index: number, field: string, value: number) => {
        const currentBins = [...(binsByFace[faceId] || [])];
        currentBins[index] = { ...currentBins[index], [field]: value };
        setBinsByFace({ ...binsByFace, [faceId]: currentBins });
    };

    const executeAutoPack = (options?: { orientation: 'width' | 'height', force: boolean }) => {
        if (!selectedItem) return;
        const newResults: Record<string, any> = {};
        const newConfigs = { ...continuousConfigs };
        let hasUnpacked = false;
        let hasError = false;

        faces.forEach(face => {
            if (lockedFaces[face.id] && resultsByFace[face.id]) {
                newResults[face.id] = resultsByFace[face.id];
                return;
            }
            const rects: Rect[] = [];
            
            if (packingMode === 'CONTINUOUS') {
                const defaultProductQuantity = selectedPo?.items?.find((i: any) => i.product && !i.description?.toLowerCase().includes('gia công'))?.quantity || 100;
                const config = newConfigs[face.id] || { width: 150, qtyPerFile: 10, totalQty: selectedItem.quantity || 100, productQuantity: defaultProductQuantity };
                let qtyToPack = config.qtyPerFile || 10;
                let finalAllowRotation = allowRotation;

                if (options) {
                    const fw = config.width;
                    const pw = face.pieceSize.w;
                    const ph = face.pieceSize.h;
                    
                    const sizeAlongWidth = options.orientation === 'width' ? pw : ph;
                    const maxQty = Math.floor(fw / (sizeAlongWidth + padding));
                    
                    if (maxQty < 1) {
                        message.error(`Khổ vải (${fw}cm) quá nhỏ để xếp sản phẩm này (${sizeAlongWidth}cm)! Vui lòng tăng khổ vải.`);
                        hasError = true;
                        return;
                    }
                    
                    qtyToPack = maxQty;
                    newConfigs[face.id] = { ...config, qtyPerFile: maxQty };
                    
                    if (options.force) {
                        finalAllowRotation = false;
                    }
                }

                if (hasError) return;

                for (let i = 0; i < qtyToPack; i++) {
                    const rect: Rect = {
                        id: `P-${face.id}-${i}`,
                        w: face.pieceSize.w,
                        h: face.pieceSize.h,
                        data: { name: face.name, color: face.bgColor, logoUrl: face.processedLogoUrl || face.logoUrl, logoConfig: face.logoConfig }
                    };
                    
                    if (options && options.force) {
                        if (options.orientation === 'width') {
                            rect.rotated = false;
                        } else {
                            rect.rotated = true;
                        }
                    }
                    rects.push(rect);
                }
                const productQuantity = config.productQuantity || 100;
                const totalQtyField = config.totalQty || selectedItem.quantity || 0;
                const fullRuns = Math.floor(productQuantity / qtyToPack);
                const remainderQty = productQuantity % qtyToPack;
                const result = packContinuous(config.width, rects, padding, finalAllowRotation);
                
                const binResults = [{
                    binId: 'Continuous',
                    w: result.width, // Khổ vải
                    h: result.totalLength, // Chiều dài
                    packed: result.packed
                }];

                let expectedTotalLength = fullRuns * result.totalLength;
                let totalWasteArea = fullRuns * result.wasteArea;
                let remainderLength = 0;

                if (remainderQty > 0) {
                    const remainderRects: Rect[] = [];
                    for (let i = 0; i < remainderQty; i++) {
                        const r = { ...rects[i] };
                        r.id = `P-REM-${face.id}-${i}`;
                        remainderRects.push(r);
                    }
                    const remainderResult = packContinuous(config.width, remainderRects, padding, finalAllowRotation);
                    
                    binResults.push({
                        binId: 'Continuous-Remainder',
                        w: remainderResult.width,
                        h: remainderResult.totalLength,
                        packed: remainderResult.packed
                    });

                    expectedTotalLength += remainderResult.totalLength;
                    totalWasteArea += remainderResult.wasteArea;
                    remainderLength = remainderResult.totalLength;
                }

                newResults[face.id] = {
                    binResults: binResults,
                    unpacked: result.unpacked,
                    stats: {
                        runs: fullRuns, // Only main runs
                        qtyPerFile: qtyToPack,
                        totalQty: totalQtyField,
                        productQuantity: productQuantity,
                        width: config.width,
                        length: result.totalLength,
                        remainderQty: remainderQty,
                        remainderLength: remainderLength,
                        expectedTotalLength: expectedTotalLength,
                        wasteArea: totalWasteArea
                    }
                };
                if (result.unpacked.length > 0) hasUnpacked = true;
            } else {
                const quantity = selectedItem.quantity || 1;
                for (let i = 0; i < quantity; i++) {
                    rects.push({
                        id: `P-${face.id}-${i}`,
                        w: face.pieceSize.w,
                        h: face.pieceSize.h,
                        data: { name: face.name, color: face.bgColor, logoUrl: face.logoUrl, logoConfig: face.logoConfig }
                    });
                }

                const bins = binsByFace[face.id] || [];
                const result = packMultipleBins(bins, rects, padding, allowRotation);
                newResults[face.id] = result;
                if (result.unpacked.length > 0) hasUnpacked = true;
            }
        });

        if (!hasError) {
            setContinuousConfigs(newConfigs);
            setResultsByFace(newResults);
            if (hasUnpacked) message.warning('Có mảnh chưa được xếp, vui lòng kiểm tra lại diện tích!');
            else message.success('Đã xếp xong sơ đồ!');
        }
    };

    const handleAutoPack = () => {
        if (packingMode === 'CONTINUOUS') {
            setIsAutoPackModalVisible(true);
        } else {
            executeAutoPack();
        }
    };

    const exportToPNG = () => {
        Object.keys(stageRefs.current).forEach(faceId => {
            const faceName = faces.find(f => f.id === faceId)?.name || faceId;
            const stages = stageRefs.current[faceId] || [];
            stages.forEach((stage, idx) => {
                if (stage) {
                    const uri = stage.toDataURL({ pixelRatio: 2 });
                    const link = document.createElement('a');
                    link.download = `Sodo_${faceName}_Tam_${idx + 1}.png`;
                    link.href = uri;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            });
        });
    };

    const exportToPDF = () => {
        const pdf = new jsPDF('l', 'px', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        let isFirstPage = true;

        Object.keys(stageRefs.current).forEach(faceId => {
            const faceName = faces.find(f => f.id === faceId)?.name || faceId;
            const stages = stageRefs.current[faceId] || [];
            
            stages.forEach((stage, idx) => {
                if (stage) {
                    if (!isFirstPage) pdf.addPage();
                    isFirstPage = false;
                    
                    const canvas = stage.toCanvas();
                    const imgData = canvas.toDataURL('image/png');
                    
                    const canvasW = canvas.width;
                    const canvasH = canvas.height;
                    const ratio = Math.min(pdfWidth / canvasW, pdfHeight / canvasH);
                    
                    const w = canvasW * ratio;
                    const h = canvasH * ratio;
                    const x = (pdfWidth - w) / 2;
                    const y = (pdfHeight - h) / 2;

                    pdf.addImage(imgData, 'PNG', x, y, w, h);
                    pdf.text(`Sơ đồ: ${faceName} - Tấm ${idx + 1}`, 20, 20);
                }
            });
        });

        pdf.save(`SoDo_PO_${selectedPo?.po_code || 'Export'}.pdf`);
    };

    // --- RENDER STEPS ---
    const renderStep1 = () => {
        // Extract unique categories from items
        const categories = new Set<string>();
        poList.forEach(po => {
            po.items?.forEach((item: any) => {
                if (item.product?.category) categories.add(item.product.category);
                else if (item.product?.category_link?.name) categories.add(item.product.category_link.name);
            });
        });
        const uniqueCategories = Array.from(categories).filter(Boolean);

        // Filter logic
        const filteredPoList = poList.map(po => {
            const filteredItems = (po.items || []).filter((item: any) => {
                const name = (item.description || item.product?.name || item.material?.name || '').toLowerCase();
                if (!name.includes('gia công in')) return false;

                // Search by SKU or Name
                const sku = (item.product?.sku || item.material?.code || '').toLowerCase();
                const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || sku.includes(searchQuery.toLowerCase());
                
                // Filter by category
                const cat = item.product?.category || item.product?.category_link?.name || '';
                const matchesCategory = categoryFilter === 'ALL' || cat === categoryFilter;

                return matchesSearch && matchesCategory;
            });
            return { ...po, filteredItems };
        }).filter(po => po.filteredItems.length > 0);

        const poColumns = [
            { title: 'Mã PO', dataIndex: 'po_code', render: (t: any, r: any) => <b>{t}</b> },
            { title: 'Khách hàng', render: (r: any) => {
                let customerName = r.pfo?.sales_order?.customer?.name || r.pfo?.sales_order?.customer_name || '';
                if (!customerName && r.plan?.sales_orders?.length > 0) {
                    customerName = Array.from(new Set(r.plan.sales_orders.map((so: any) => so?.customer?.name || so?.customer_name).filter(Boolean))).join(', ');
                }
                return <span style={{ color: '#555', fontWeight: 500 }}>{customerName || '-'}</span>;
            }},
            { title: 'Nhà GC', dataIndex: ['supplier', 'name'], render: (t: string) => <span style={{ color: '#1890ff', fontWeight: 500 }}>{t}</span> },
            { title: 'Trạng thái', dataIndex: 'status', render: (t: string) => <Tag color="blue" style={{ borderRadius: 12 }}>{t}</Tag> },
            { title: 'Tiến độ Sơ đồ', render: (r: any) => {
                const items = r.filteredItems || [];
                let total = items.length;
                let done = items.filter((i: any) => i.print_design).length;
                if (total === 0) return <span style={{ color: '#aaa' }}>-</span>;
                return <span style={{ fontWeight: 'bold', color: done === total ? '#52c41a' : '#fa8c16' }}>{done} / {total}</span>;
            }}
        ];

        const expandedRowRender = (po: any) => {
            return (
                <div style={{ padding: '16px 24px', background: '#fafafa', borderRadius: 12, border: '1px solid #f0f0f0' }}>
                    <List
                        grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 4 }}
                        dataSource={po.filteredItems}
                        renderItem={(r: any) => {
                            const isDone = !!r.print_design;
                            return (
                                <List.Item>
                                    <Card 
                                        size="small" 
                                        hoverable 
                                        style={{ 
                                            borderRadius: 12, 
                                            border: isDone ? '1px solid #b7eb8f' : '1px solid #ffe58f',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                                        }}
                                        bodyStyle={{ padding: 16 }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <Tag color={isDone ? 'success' : 'warning'} style={{ borderRadius: 12, margin: 0 }}>
                                                {isDone ? 'Đã Sơ đồ' : 'Chưa Sơ đồ'}
                                            </Tag>
                                            <span style={{ color: '#888', fontSize: 12, fontWeight: 'bold' }}>SL: {r.quantity}</span>
                                        </div>
                                        <div style={{ marginBottom: 4, fontWeight: 'bold', fontSize: 14 }}>
                                            {r.product?.name || r.material?.name || r.description}
                                        </div>
                                        <div style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
                                            SKU: {r.product?.sku || r.material?.code || '-'}
                                        </div>
                                        
                                        <Button
                                            type={selectedItem?.id === r.id ? 'primary' : 'default'}
                                            shape="round"
                                            block
                                            onClick={() => {
                                                setSelectedPo(po);
                                                setSelectedItem(r);
                                            }}
                                            style={{
                                                background: selectedItem?.id === r.id ? 'linear-gradient(90deg, #1890ff, #096dd9)' : undefined,
                                                borderColor: selectedItem?.id === r.id ? 'transparent' : '#d9d9d9',
                                                color: selectedItem?.id === r.id ? '#fff' : undefined
                                            }}
                                        >
                                            {selectedItem?.id === r.id ? 'Đang chọn' : 'Chọn Thiết kế'}
                                        </Button>
                                    </Card>
                                </List.Item>
                            );
                        }}
                    />
                </div>
            );
        };

        return (
            <div>
                <div style={{ marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', background: '#fff', padding: '16px 24px', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                    <Input 
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} 
                        placeholder="Tìm theo SKU hoặc Tên sản phẩm..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: 300, borderRadius: 8 }}
                        size="large"
                        allowClear
                    />
                    <Select
                        showSearch
                        placeholder="Lọc theo Danh mục"
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        style={{ width: 250 }}
                        size="large"
                        options={[{ value: 'ALL', label: 'Tất cả danh mục' }, ...uniqueCategories.map(c => ({ value: c, label: c }))]}
                    />
                    <div style={{ marginLeft: 'auto', color: '#888' }}>
                        Hiển thị <b>{filteredPoList.length}</b> Đơn hàng
                    </div>
                </div>

                <Table 
                    columns={poColumns} 
                    dataSource={filteredPoList} 
                    rowKey="id" 
                    expandable={{ expandedRowRender, defaultExpandAllRows: true }}
                    loading={loadingPo}
                    pagination={{ pageSize: 10 }}
                    style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
                />
            </div>
        );
    };

    const renderStep2 = () => {
        const SCALE = 5;

        return (
            <div>
                {selectedItem && (
                    <Alert 
                        message={<b>Sản phẩm: {selectedItem.product?.name || selectedItem.material?.name || selectedItem.description}</b>} 
                        description={<span>Mã SKU / Mã hàng: <b>{selectedItem.product?.sku || selectedItem.material?.code || '-'}</b></span>} 
                        type="info" 
                        showIcon 
                        style={{ marginBottom: 16 }} 
                    />
                )}
                <div style={{ marginBottom: 16 }}>
                    <Space>
                        <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddFace}>Thêm Mặt Vải / Chi tiết</Button>
                        <Button type="primary" ghost icon={<CopyOutlined />} onClick={() => setIsCopyModalVisible(true)}>Sao chép từ Sơ đồ mẫu</Button>
                    </Space>
                </div>
                <Tabs type="card" activeKey={activeFaceKey} onChange={setActiveFaceKey}>
                    {faces.map(face => (
                        <Tabs.TabPane tab={face.name} key={face.id}>
                            <Row gutter={24}>
                                <Col span={8}>
                                    <Card title="Thông số (1 mảnh)" extra={faces.length > 1 && <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveFace(face.id)} />}>
                                        <Space direction="vertical" style={{ width: '100%' }}>
                                            <div>
                                                <label>Tên Mặt/Chi tiết:</label>
                                                <input className="ant-input" value={face.name} onChange={e => updateFace(face.id, { name: e.target.value })} />
                                            </div>
                                            <div>
                                                <label>Loại vải in:</label>
                                                <input className="ant-input" value={face.fabricType || ''} onChange={e => updateFace(face.id, { fabricType: e.target.value })} placeholder="Ví dụ: Canvas trắng ngà" />
                                            </div>
                                            <div>
                                                <label>Kích thước Dài (cm):</label>
                                                <InputNumber style={{ width: '100%' }} value={face.pieceSize.w} onChange={v => updateFace(face.id, { pieceSize: { ...face.pieceSize, w: v || 50 } })} />
                                            </div>
                                            <div>
                                                <label>Kích thước Rộng/Cao (cm):</label>
                                                <InputNumber style={{ width: '100%' }} value={face.pieceSize.h} onChange={v => updateFace(face.id, { pieceSize: { ...face.pieceSize, h: v || 40 } })} />
                                            </div>
                                            <div>
                                                <label>Màu nền (Branding/Hex):</label>
                                                <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                                                    <input type="color" style={{ width: 40, height: 32, cursor: 'pointer', border: '1px solid #d9d9d9', borderRight: 0, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, padding: 0 }} value={face.bgColor} onChange={e => updateFace(face.id, { bgColor: e.target.value })} />
                                                    <Input placeholder="#FFFFFF" value={face.bgColor} onChange={e => updateFace(face.id, { bgColor: e.target.value })} style={{ width: 'calc(100% - 40px)' }} />
                                                </Space.Compact>
                                            </div>
                                            <Upload
                                                customRequest={(options) => handleUpload(options, face.id)}
                                                showUploadList={false}
                                                accept="image/*"
                                            >
                                                <Button icon={<UploadOutlined />} type={face.logoUrl ? 'default' : 'primary'}>
                                                    {face.logoUrl ? 'Đổi Logo' : 'Tải Logo Lên'}
                                                </Button>
                                            </Upload>
                                            {face.logoUrl && (
                                                <>
                                                    <Divider style={{ margin: '12px 0' }} />
                                                    <div>
                                                        <label>Tách nền trắng (Tolerance):</label>
                                                        <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                                                            <InputNumber min={0} max={255} value={face.removeTolerance || 240} onChange={v => updateFace(face.id, { removeTolerance: v })} style={{ width: '100%' }} />
                                                        </Space.Compact>
                                                    </div>
                                                    <div style={{ marginTop: 12 }}>
                                                        <label>Màu Logo:</label>
                                                        <Select value={face.logoColor || 'original'} onChange={v => updateFace(face.id, { logoColor: v })} style={{ width: '100%', marginTop: 4 }}>
                                                            <Select.Option value="original">Giữ Nguyên Bản</Select.Option>
                                                            <Select.Option value="white">Chuyển sang Trắng</Select.Option>
                                                            <Select.Option value="black">Chuyển sang Đen</Select.Option>
                                                        </Select>
                                                    </div>
                                                </>
                                            )}
                                        </Space>
                                    </Card>
                                </Col>
                                <Col span={16}>
                                    <Card title="Căn chỉnh Logo trên mảnh">
                                        <div style={{ background: '#f0f2f5', padding: 20, display: 'flex', justifyContent: 'center' }}>
                                            <div style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: 'white' }}>
                                                <Stage width={face.pieceSize.w * SCALE} height={face.pieceSize.h * SCALE} onMouseDown={(e) => {
                                                    if (e.target === e.target.getStage()) updateFace(face.id, { selectedId: null });
                                                }}>
                                                    <Layer>
                                                        <KonvaRect width={face.pieceSize.w * SCALE} height={face.pieceSize.h * SCALE} fill={face.bgColor} />
                                                    </Layer>
                                                    <Layer>
                                                        {(face.processedLogoUrl || face.logoUrl) && (
                                                            <URLImage
                                                                image={face.processedLogoUrl || face.logoUrl}
                                                                x={face.logoConfig.x * SCALE}
                                                                y={face.logoConfig.y * SCALE}
                                                                width={face.logoConfig.width * SCALE}
                                                                height={face.logoConfig.height * SCALE}
                                                                isSelected={face.selectedId === 'logo'}
                                                                onSelect={() => updateFace(face.id, { selectedId: 'logo' })}
                                                                onChange={(newAttrs: any) => {
                                                                    updateFace(face.id, {
                                                                        logoConfig: {
                                                                            x: newAttrs.x / SCALE,
                                                                            y: newAttrs.y / SCALE,
                                                                            width: newAttrs.width / SCALE,
                                                                            height: newAttrs.height / SCALE,
                                                                        }
                                                                    });
                                                                }}
                                                            />
                                                        )}
                                                    </Layer>
                                                </Stage>
                                            </div>
                                        </div>
                                    </Card>
                                </Col>
                            </Row>
                        </Tabs.TabPane>
                    ))}
                </Tabs>
            </div>
        );
    }

    const renderStep3 = () => {
        const CANVAS_DISPLAY_WIDTH = 800;

        return (
            <Row gutter={16}>
                <Col span={6}>
                    <Card title="Cấu hình Khổ Vải" size="small">
                        <div style={{ marginBottom: 16 }}>
                            <label><b>Chế độ xếp:</b></label>
                            <Select 
                                value={packingMode} 
                                onChange={setPackingMode} 
                                style={{ width: '100%', marginTop: 8 }}
                                options={[
                                    { label: 'Xếp liên tục theo Khổ vải', value: 'CONTINUOUS' },
                                    { label: 'Xếp theo Tấm rời', value: 'FIXED_BINS' }
                                ]}
                            />
                        </div>
                        <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 4 }}>
                            <div style={{ marginBottom: 12 }}>
                                <label><b>Cấu hình cho Mặt:</b></label>
                                <Select 
                                    value={activeFaceKey} 
                                    onChange={setActiveFaceKey} 
                                    style={{ width: '100%', marginTop: 4 }}
                                    options={faces.map(f => ({ label: f.name, value: f.id }))}
                                />
                            </div>
                            
                            {faces.filter(f => f.id === activeFaceKey).map(face => {
                                const bins = binsByFace[face.id] || [];
                                return (
                                    <div key={face.id}>
                                        {packingMode === 'CONTINUOUS' ? (
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                <div><label>Khổ vải (cm):</label> <InputNumber size="small" value={continuousConfigs[face.id]?.width || 150} onChange={v => {
                                                    const newConf = {...continuousConfigs, [face.id]: { ...(continuousConfigs[face.id] || { width: 150, qtyPerFile: 10, totalQty: selectedItem?.quantity || 0, productQuantity: 100 }), width: v || 150 }};
                                                    setContinuousConfigs(newConf);
                                                }} onBlur={() => executeAutoPack()} onPressEnter={() => executeAutoPack()} style={{ width: '100%' }} /></div>
                                                <div><label>Số lượng sản phẩm:</label> <InputNumber size="small" value={continuousConfigs[face.id]?.productQuantity || 100} onChange={v => {
                                                    const newConf = {...continuousConfigs, [face.id]: { ...(continuousConfigs[face.id] || { width: 150, qtyPerFile: 10, totalQty: selectedItem?.quantity || 0, productQuantity: 100 }), productQuantity: v || 1 }};
                                                    setContinuousConfigs(newConf);
                                                }} onBlur={() => executeAutoPack()} onPressEnter={() => executeAutoPack()} style={{ width: '100%' }} /></div>
                                                <div><label>Tổng số mét vải cần (m):</label> <InputNumber size="small" value={continuousConfigs[face.id]?.totalQty ?? selectedItem?.quantity ?? 0} onChange={v => {
                                                    const newConf = {...continuousConfigs, [face.id]: { ...(continuousConfigs[face.id] || { width: 150, qtyPerFile: 10, totalQty: selectedItem?.quantity || 0, productQuantity: 100 }), totalQty: v || 0 }};
                                                    setContinuousConfigs(newConf);
                                                }} onBlur={() => executeAutoPack()} onPressEnter={() => executeAutoPack()} style={{ width: '100%' }} /></div>
                                                <div><label>Số con / file:</label> <InputNumber size="small" value={continuousConfigs[face.id]?.qtyPerFile || 10} onChange={v => {
                                                    const newConf = {...continuousConfigs, [face.id]: { ...(continuousConfigs[face.id] || { width: 150, qtyPerFile: 10, totalQty: selectedItem?.quantity || 0, productQuantity: 100 }), qtyPerFile: v || 1 }};
                                                    setContinuousConfigs(newConf);
                                                }} onBlur={() => executeAutoPack()} onPressEnter={() => executeAutoPack()} style={{ width: '100%' }} /></div>
                                                <div style={{color: '#1890ff', fontSize: 12}}>Số lần in (Runs): <b>{Math.ceil((continuousConfigs[face.id]?.productQuantity || 100) / (continuousConfigs[face.id]?.qtyPerFile || 10))}</b></div>
                                            </Space>
                                        ) : (
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                {bins.map((bin, index) => (
                                                    <Card size="small" key={index} title={`Tấm vải ${index + 1}`} extra={bins.length > 1 && <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveBin(face.id, index)} />}>
                                                        <div>Dài (cm): <InputNumber size="small" value={bin.w} onChange={v => handleBinChange(face.id, index, 'w', v || 400)} /></div>
                                                        <div style={{ marginTop: 4 }}>Rộng (cm): <InputNumber size="small" value={bin.h} onChange={v => handleBinChange(face.id, index, 'h', v || 120)} /></div>
                                                    </Card>
                                                ))}
                                                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => handleAddBin(face.id)}>Thêm tấm vải mới</Button>
                                            </Space>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <Divider />
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <div>Padding (cm): <InputNumber size="small" value={padding} onChange={v => setPadding(v || 0)} /></div>
                            <div>Tự động xoay: <Switch checked={allowRotation} onChange={setAllowRotation} size="small" /></div>
                            <Button type="primary" block style={{ background: '#52c41a' }} onClick={handleAutoPack}>Chạy Tự Động Xếp Tất Cả</Button>
                        </Space>
                        <div style={{fontSize: 11, color: '#888', marginTop: 12}}>
                            <b>Mẹo:</b> 
                            <br/>- Dùng chuột kéo các chấm tròn để <b>xoay tự do</b>.
                            <br/>- <b>Click đúp (Double-click)</b> vào 1 mảnh để xoay nhanh góc 90 độ (đảo chiều ngang/dọc).
                        </div>
                    </Card>
                    
                    {Object.keys(resultsByFace).length > 0 && (
                        <Card title="Xuất File & Lưu Sơ Đồ" size="small" style={{ marginTop: 16 }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button block icon={<SaveOutlined />} type="primary" onClick={handleSaveDesign}>Lưu Sơ Đồ</Button>
                                <Button block icon={<FilePdfOutlined />} onClick={exportToPDF} style={{ color: '#cf1322', borderColor: '#cf1322' }}>Xuất PDF Gộp</Button>
                                <Button block icon={<FileImageOutlined />} onClick={exportToPNG}>Xuất PNG Rời</Button>
                            </Space>
                        </Card>
                    )}

                    {Object.keys(resultsByFace).length > 0 && (
                        <Card title="Thêm Chi Tiết Phụ" size="small" style={{ marginTop: 16 }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div><label>Tên chi tiết:</label> <Input size="small" value={customPiece.name} onChange={e => setCustomPiece({...customPiece, name: e.target.value})} /></div>
                                <div><label>Dài (cm):</label> <InputNumber size="small" style={{width: '100%'}} value={customPiece.w} onChange={v => setCustomPiece({...customPiece, w: v || 10})} /></div>
                                <div><label>Rộng (cm):</label> <InputNumber size="small" style={{width: '100%'}} value={customPiece.h} onChange={v => setCustomPiece({...customPiece, h: v || 10})} /></div>
                                <div><label>Màu:</label> <input type="color" value={customPiece.color} onChange={e => setCustomPiece({...customPiece, color: e.target.value})} style={{width: '100%'}} /></div>
                            </Space>
                            <div style={{fontSize: 11, color: '#888', marginTop: 8}}>* Thêm chi tiết phụ vào các tấm vải bên phải bằng nút [Thêm chi tiết phụ] tương ứng.</div>
                        </Card>
                    )}
                </Col>
                <Col span={18}>
                    {faces.map(face => {
                        const resultObj = resultsByFace[face.id];
                        if (!resultObj) return null;
                        
                        return (
                            <div key={face.id} style={{ marginBottom: 24 }}>
                                <Divider orientation="left">
                                    <Space>
                                        {face.name}
                                        <Button 
                                            type="text" 
                                            size="small" 
                                            icon={lockedFaces[face.id] ? <LockOutlined style={{color: '#cf1322'}}/> : <UnlockOutlined style={{color: '#52c41a'}}/>}
                                            onClick={() => setLockedFaces({...lockedFaces, [face.id]: !lockedFaces[face.id]})}
                                            title={lockedFaces[face.id] ? "Mở khóa sơ đồ" : "Khóa sơ đồ (Giữ cố định khi Chạy Tự Động xếp)"}
                                        />
                                        {lockedFaces[face.id] && <Tag color="error">Đã khóa</Tag>}

                                    </Space>
                                </Divider>
                                
                                {resultObj.unpacked.length > 0 && (
                                    <div style={{ marginBottom: 16, padding: 12, background: '#fff2f0', border: '1px solid #ffccc7', color: '#cf1322', borderRadius: 4 }}>
                                        <b>{face.name} - Thiếu diện tích!</b> Có {resultObj.unpacked.length} mảnh chưa thể xếp vào vải. Vui lòng thêm tấm vải.
                                    </div>
                                )}

                                {resultObj.binResults.map((result, idx) => {
                                    const scale = CANVAS_DISPLAY_WIDTH / result.w;
                                    const displayHeight = result.h * scale;
                                    
                                    if (!stageRefs.current[face.id]) stageRefs.current[face.id] = [];

                                    return (
                                        <Card 
                                            title={(
                                                <Space>
                                                    <span>Sơ đồ: {face.name} - Tấm {idx + 1} ({result.w}x{result.h} cm) - Đã xếp: {result.packed.length} mảnh</span>
                                                    {lockedFaces[face.id] && (() => {
                                                        const binW = result.w;
                                                        const binH = result.h;
                                                        let xSet = new Set([0, binW]);
                                                        let ySet = new Set([0, binH]);
                                                        
                                                        result.packed.forEach((p: any) => {
                                                            const pW = p.rotated || p.rotation === -90 || p.rotation === 90 || p.rotation === 270 ? p.h : p.w;
                                                            const pH = p.rotated || p.rotation === -90 || p.rotation === 90 || p.rotation === 270 ? p.w : p.h;
                                                            xSet.add(p.x);
                                                            xSet.add(p.x + pW);
                                                            ySet.add(p.y);
                                                            ySet.add(p.y + pH);
                                                        });
                                                        
                                                        const xCoords = Array.from(xSet).sort((a,b) => a-b);
                                                        const yCoords = Array.from(ySet).sort((a,b) => a-b);
                                                        const R = xCoords.length - 1;
                                                        const C = yCoords.length - 1;
                                                        
                                                        const grid = [];
                                                        for(let i=0; i<R; i++) {
                                                            grid[i] = [];
                                                            const cx = xCoords[i];
                                                            const cw = xCoords[i+1] - cx;
                                                            const midX = cx + cw/2;
                                                            for(let j=0; j<C; j++) {
                                                                const cy = yCoords[j];
                                                                const ch = yCoords[j+1] - cy;
                                                                const midY = cy + ch/2;
                                                                
                                                                let filled = false;
                                                                for(const p of result.packed) {
                                                                    const pW = p.rotated || p.rotation === -90 || p.rotation === 90 || p.rotation === 270 ? p.h : p.w;
                                                                    const pH = p.rotated || p.rotation === -90 || p.rotation === 90 || p.rotation === 270 ? p.w : p.h;
                                                                    if (midX > p.x && midX < p.x + pW && midY > p.y && midY < p.y + pH) {
                                                                        filled = true;
                                                                        break;
                                                                    }
                                                                }
                                                                grid[i][j] = filled;
                                                            }
                                                        }
                                                        
                                                        let maxEmptyW = 0;
                                                        let maxEmptyH = 0;
                                                        let maxEmptyArea = 0;
                                                        const accW = new Array(C).fill(0);
                                                        for(let i=0; i<R; i++) {
                                                            const cw = xCoords[i+1] - xCoords[i];
                                                            for(let j=0; j<C; j++) {
                                                                if (!grid[i][j]) accW[j] += cw;
                                                                else accW[j] = 0;
                                                            }
                                                            
                                                            for(let j=0; j<C; j++) {
                                                                let minW = accW[j];
                                                                if (minW === 0) continue;
                                                                let currentH = 0;
                                                                for(let k=j; k<C; k++) {
                                                                    if (accW[k] === 0) break;
                                                                    minW = Math.min(minW, accW[k]);
                                                                    currentH += yCoords[k+1] - yCoords[k];
                                                                    const area = minW * currentH;
                                                                    if (area > maxEmptyArea) {
                                                                        maxEmptyArea = area;
                                                                        maxEmptyW = minW;
                                                                        maxEmptyH = currentH;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        return (
                                                            <Tag color="warning">
                                                                Phần dư: {maxEmptyW.toFixed(1)}x{maxEmptyH.toFixed(1)} cm ({maxEmptyArea.toFixed(1)} cm²)
                                                            </Tag>
                                                        );
                                                    })()}
                                                </Space>
                                            )} 
                                            size="small" style={{ marginBottom: 16 }} key={idx}
                                            extra={<Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => handleAddCustomPiece(face.id, idx)}>Thêm chi tiết phụ</Button>}
                                        >
                                            <div style={{ overflowX: 'auto', background: '#f0f2f5', padding: 10 }}>
                                                <div style={{ position: 'relative', width: CANVAS_DISPLAY_WIDTH + 80, height: displayHeight + 80 }}>
                                                    <div style={{ position: 'absolute', top: 40, left: 40, width: CANVAS_DISPLAY_WIDTH, height: displayHeight, background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', backgroundImage: 'linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                                    <Stage style={{ position: 'absolute', top: 0, left: 0 }} width={CANVAS_DISPLAY_WIDTH + 80} height={displayHeight + 80} ref={(node) => { stageRefs.current[face.id][idx] = node; }} onMouseDown={(e) => {
                                                        if (e.target === e.target.getStage()) setSelectedPiece(null);
                                                    }}>
                                                        <Layer x={40} y={40}>
                                                            {result.packed.map((rect) => {
                                                                const isSelected = selectedPiece?.faceId === face.id && selectedPiece?.binIdx === idx && selectedPiece?.rectId === rect.id;
                                                                return (
                                                                    <DraggableRect
                                                                        key={rect.id}
                                                                        rect={rect}
                                                                        scale={scale}
                                                                        face={face}
                                                                        isSelected={isSelected}
                                                                        onSelect={() => setSelectedPiece({ faceId: face.id, binIdx: idx, rectId: rect.id })}
                                                                        onRemove={() => {
                                                                            const newResults = {...resultsByFace};
                                                                            const packed = newResults[face.id].binResults[idx].packed;
                                                                            const rectIdx = packed.findIndex((r: any) => r.id === rect.id);
                                                                            if (rectIdx !== -1) {
                                                                                packed.splice(rectIdx, 1);
                                                                                if (packingMode === 'CONTINUOUS' && newResults[face.id].stats) {
                                                                                    let maxLength = 0;
                                                                                    let totalArea = 0;
                                                                                    packed.forEach((r: any) => {
                                                                                        const rW = r.rotated || r.rotation === -90 || r.rotation === 90 || r.rotation === 270 ? r.h : r.w;
                                                                                        const rH = r.rotated || r.rotation === -90 || r.rotation === 90 || r.rotation === 270 ? r.w : r.h;
                                                                                        const bottomEdge = (r.y || 0) + rH;
                                                                                        if (bottomEdge > maxLength) maxLength = bottomEdge;
                                                                                        totalArea += (r.w * r.h);
                                                                                    });
                                                                                    if (maxLength === 0) maxLength = 10;
                                                                                    const stats = newResults[face.id].stats;
                                                                                    stats.length = maxLength;
                                                                                    stats.expectedTotalLength = stats.runs * maxLength;
                                                                                    stats.wasteArea = Math.max(0, (maxLength * stats.width) - totalArea);
                                                                                    newResults[face.id].binResults[idx].h = maxLength;
                                                                                }
                                                                                setResultsByFace(newResults);
                                                                                setSelectedPiece(null);
                                                                            }
                                                                        }}
                                                                        onChange={(newAttrs: any) => {
                                                                            const newResults = {...resultsByFace};
                                                                            const packed = newResults[face.id].binResults[idx].packed;
                                                                            const rectIdx = packed.findIndex(r => r.id === rect.id);
                                                                            if (rectIdx !== -1) {
                                                                                packed[rectIdx] = { ...packed[rectIdx], ...newAttrs };
                                                                                
                                                                                // Recalculate stats for continuous mode
                                                                                if (packingMode === 'CONTINUOUS' && newResults[face.id].stats) {
                                                                                    let maxLength = 0;
                                                                                    let totalArea = 0;
                                                                                    packed.forEach((r: any) => {
                                                                                        const rW = r.rotated || r.rotation === -90 || r.rotation === 90 || r.rotation === 270 ? r.h : r.w;
                                                                                        const rH = r.rotated || r.rotation === -90 || r.rotation === 90 || r.rotation === 270 ? r.w : r.h;
                                                                                        const bottomEdge = (r.y || 0) + rH;
                                                                                        if (bottomEdge > maxLength) maxLength = bottomEdge;
                                                                                        totalArea += (r.w * r.h);
                                                                                    });
                                                                                    // Prevent zero length if everything is dragged to 0
                                                                                    if (maxLength === 0) maxLength = 10;
                                                                                    const stats = newResults[face.id].stats;
                                                                                    stats.length = maxLength;
                                                                                    stats.expectedTotalLength = stats.runs * maxLength;
                                                                                    stats.wasteArea = Math.max(0, (maxLength * stats.width) - totalArea);
                                                                                    newResults[face.id].binResults[idx].h = maxLength;
                                                                                }

                                                                                setResultsByFace(newResults);
                                                                            }
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </Layer>
                                                        <RulerLayer width={result.w} height={result.h} scale={scale} offsetX={40} offsetY={40} />
                                                    </Stage>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {packingMode === 'CONTINUOUS' && Object.keys(resultsByFace).length > 0 && (
                        <>
                            <Card title="Bảng Thống Kê (Dự kiến thực tế)" size="small" style={{ marginTop: 24, borderColor: '#52c41a' }}>
                                <Table
                                    size="small"
                                    pagination={false}
                                    dataSource={faces.map(face => {
                                        const stats = resultsByFace[face.id]?.stats;
                                        if (!stats) return null;
                                        return {
                                            key: face.id,
                                            name: face.name,
                                            runs: stats.runs,
                                            qtyPerFile: stats.qtyPerFile,
                                            totalQty: stats.totalQty,
                                            productQuantity: stats.productQuantity,
                                            width: stats.width,
                                            length: stats.length,
                                            remainderQty: stats.remainderQty,
                                            remainderLength: stats.remainderLength,
                                            expectedTotalLength: stats.expectedTotalLength.toFixed(2),
                                            wasteArea: stats.wasteArea.toFixed(2)
                                        };
                                    }).filter(Boolean)}
                                    columns={[
                                        { title: 'Nội dung in', dataIndex: 'name', render: t => <b>{t}</b> },
                                        { title: 'Số lượng SP', dataIndex: 'productQuantity', render: v => <b>{v}</b> },
                                        { title: 'Số lần in', dataIndex: 'runs', render: (v, r) => r.remainderQty > 0 ? <span>{v} <br/><small style={{color: '#888'}}>+1 (lượt cuối)</small></span> : v },
                                        { title: 'Số con/file', dataIndex: 'qtyPerFile', render: (v, r) => r.remainderQty > 0 ? <span>{v} <br/><small style={{color: '#888'}}>+ {r.remainderQty} (lượt cuối)</small></span> : v },
                                        { title: 'Tổng mét vải (m)', dataIndex: 'expectedTotalLength', render: v => <b style={{ color: '#52c41a' }}>{(Number(v) / 100).toFixed(2)}</b> },
                                        { title: 'Khổ (cm)', dataIndex: 'width' },
                                        { title: 'Kích thước / file (cm)', dataIndex: 'length', render: (v, r) => r.remainderQty > 0 ? <span><span style={{ color: '#cf1322' }}>{v.toFixed(2)}</span> <br/><small style={{color: '#cf1322'}}>+ {r.remainderLength.toFixed(2)} (lượt cuối)</small></span> : <span style={{ color: '#cf1322' }}>{v.toFixed(2)}</span> },
                                        { title: 'Dự kiến cần (cm)', dataIndex: 'expectedTotalLength', render: v => <b style={{ color: '#1890ff' }}>{v}</b> },
                                        { title: 'Diện tích dư cuối (cm²)', dataIndex: 'wasteArea' },
                                    ]}
                                />
                            </Card>

                            <Card title="Gửi nhà in" size="small" style={{ marginTop: 24, borderColor: '#1890ff' }}>
                                <Table
                                    size="small"
                                    pagination={false}
                                    dataSource={faces.map(face => {
                                        const stats = resultsByFace[face.id]?.stats;
                                        if (!stats) return null;
                                        
                                        const manualLength = printOverrides[face.id]?.length ?? (stats.length / 100);
                                        const defaultRuns = stats.runs + (stats.remainderQty > 0 ? 1 : 0);
                                        const manualRuns = printOverrides[face.id]?.runs ?? defaultRuns;
                                        const calculatedExpected = Number((manualRuns * manualLength).toFixed(2));

                                        return {
                                            key: face.id,
                                            fabricType: face.fabricType || face.name,
                                            runs: manualRuns,
                                            width: stats.width,
                                            length: manualLength,
                                            expectedTotalLength: calculatedExpected,
                                            faceId: face.id
                                        };
                                    }).filter(Boolean)}
                                    columns={[
                                        { 
                                            title: 'IN VẢI', 
                                            dataIndex: 'fabricType', 
                                            render: t => <b style={{ color: 'red' }}>{t}</b> 
                                        },
                                        { 
                                            title: 'Số lần in', 
                                            dataIndex: 'runs',
                                            render: (v, r: any) => (
                                                <InputNumber 
                                                    size="small" 
                                                    style={{ width: 80 }}
                                                    value={Number(v)} 
                                                    onChange={(val) => setPrintOverrides(prev => ({ ...prev, [r.faceId]: { ...prev[r.faceId], runs: val || 0 } }))} 
                                                />
                                            )
                                        },
                                        { title: 'Khổ', dataIndex: 'width' },
                                        { 
                                            title: 'Kích thước', 
                                            dataIndex: 'length',
                                            render: (v, r: any) => (
                                                <InputNumber 
                                                    size="small" 
                                                    style={{ width: 80 }}
                                                    value={Number(v)} 
                                                    onChange={(val) => setPrintOverrides(prev => ({ ...prev, [r.faceId]: { ...prev[r.faceId], length: val || 0 } }))} 
                                                />
                                            )
                                        },
                                        { 
                                            title: 'Dự kiến cần', 
                                            dataIndex: 'expectedTotalLength',
                                            render: v => <span>{v}</span>
                                        }
                                    ]}
                                    summary={(pageData: readonly any[]) => {
                                        let totalExpected = 0;
                                        pageData.forEach(({ expectedTotalLength }) => {
                                            totalExpected += Number(expectedTotalLength || 0);
                                        });
                                        return (
                                            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                                <Table.Summary.Cell index={0} colSpan={4} align="right">Tổng cộng Dự kiến cần:</Table.Summary.Cell>
                                                <Table.Summary.Cell index={1}>
                                                    <div style={{ background: '#fffb8f', padding: '4px 8px', display: 'inline-block' }}>{totalExpected.toFixed(2)}</div>
                                                </Table.Summary.Cell>
                                            </Table.Summary.Row>
                                        );
                                    }}
                                />
                            </Card>
                        </>
                    )}
                </Col>
            </Row>
        );
    }

    const steps = [
        { title: 'Chọn Đơn Hàng (PO_GC)', content: renderStep1() },
        { title: 'Thiết Kế Sản Phẩm (Đa Mặt)', content: renderStep2() },
        { title: 'Xếp Sơ Đồ Đa Mặt', content: renderStep3() },
    ];

    return (
        <Card title="Quy Trình Xếp Sơ Đồ & Thiết Kế In/Thêu">

            <Modal 
                title="Đặt tên sơ đồ (VD: Mốc 30, Mốc 50...)" 
                open={isSaveNameModalVisible} 
                onOk={confirmSaveDesign}
                onCancel={() => setIsSaveNameModalVisible(false)}
                okText="Lưu Sơ đồ"
                cancelText="Hủy"
            >
                <Input 
                    value={saveDesignName} 
                    onChange={e => setSaveDesignName(e.target.value)} 
                    placeholder="Nhập tên hoặc mốc số lượng..." 
                    onPressEnter={confirmSaveDesign}
                />
            </Modal>
            <Steps current={currentStep} items={steps.map(s => ({ title: s.title }))} style={{ marginBottom: 24 }} />
            
            <div style={{ minHeight: 400 }}>
                {steps[currentStep].content}
            </div>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
                {currentStep > 0 && <Button style={{ margin: '0 8px' }} onClick={handlePrev}>Quay Lại</Button>}
                {currentStep < steps.length - 1 && <Button type="primary" onClick={handleNext}>Tiếp Tục</Button>}
                {currentStep === steps.length - 1 && <Button type="primary" style={{ background: '#52c41a' }} onClick={handleSaveDesign}>Hoàn Thành</Button>}
            </div>

            <Modal title="Chọn Sơ đồ mẫu để Sao chép" open={isCopyModalVisible} onCancel={() => setIsCopyModalVisible(false)} footer={null} width={600}>
                <List
                    dataSource={savedDesigns}
                    renderItem={(item: any) => (
                        <List.Item
                            actions={[<Button type="primary" size="small" onClick={() => handleCopyDesign(item)}>Sao chép</Button>]}
                        >
                            <List.Item.Meta
                                title={<b>{item.name}</b>}
                                description={`Mã: ${item.code} | Khách hàng: ${item.customer?.name || '-'} | SKU: ${item.product?.sku || '-'} - SP: ${item.product?.name || '-'}`}
                            />
                        </List.Item>
                    )}
                />
            </Modal>

            <Modal 
                title="Đã tìm thấy Sơ đồ cho sản phẩm này" 
                open={isLoadSavedMarkerModalVisible} 
                onCancel={() => {
                    setIsLoadSavedMarkerModalVisible(false);
                    setCurrentStep(currentStep + 1);
                }} 
                footer={null} 
                width={700}
            >
                <Alert message="Sản phẩm này đã có Sơ đồ được lưu trước đó. Bạn có thể chọn để tải lại Sơ đồ này, hoặc Bỏ qua để thiết kế sơ đồ hoàn toàn mới." type="info" showIcon style={{ marginBottom: 16 }} />
                <List
                    dataSource={savedProductMarkers}
                    renderItem={(item: any) => (
                        <List.Item
                            actions={[
                                <Button key="keep" type="default" size="small" onClick={() => handleLoadSavedMarker(item, 'keep')}>Sử dụng (Manual)</Button>,
                                <Button key="rotate" type="default" size="small" onClick={() => handleLoadSavedMarker(item, 'rotate90')}>Sử dụng (Xoay 90°)</Button>,
                                <Button key="repack" type="primary" size="small" onClick={() => handleLoadSavedMarker(item, 'repack')}>Chạy Tự động xếp lại</Button>
                            ]}
                        >
                            <List.Item.Meta
                                title={<b>{item.name}</b>}
                                description={`Mã: ${item.code} | Ngày lưu: ${new Date(item.created_at).toLocaleDateString()}`}
                            />
                        </List.Item>
                    )}
                />
                <div style={{ textAlign: 'right', marginTop: 16 }}>
                    <Button onClick={() => {
                        setIsLoadSavedMarkerModalVisible(false);
                        setCurrentStep(currentStep + 1);
                    }}>Bỏ qua (Tạo mới)</Button>
                </div>
            </Modal>

            <Modal 
                title="Cấu hình Tự Động Xếp Sơ Đồ" 
                open={isAutoPackModalVisible} 
                onCancel={() => setIsAutoPackModalVisible(false)}
                onOk={() => {
                    setIsAutoPackModalVisible(false);
                    executeAutoPack({ orientation: autoPackOrientation, force: autoPackForce });
                }}
                okText="Tính toán & Chạy"
                cancelText="Huỷ"
            >
                <div style={{ marginBottom: 16 }}>
                    <p><b>Bạn muốn ưu tiên xếp các mảnh rập theo chiều nào ngang theo Khổ vải?</b></p>
                    <Select value={autoPackOrientation} onChange={setAutoPackOrientation} style={{ width: '100%' }}>
                        <Select.Option value="width">Theo Chiều Rộng của sản phẩm</Select.Option>
                        <Select.Option value="height">Theo Chiều Dài của sản phẩm</Select.Option>
                    </Select>
                </div>
                <div>
                    <p><b>Tuỳ chọn ép hướng (Force Orientation):</b></p>
                    <Switch checked={autoPackForce} onChange={setAutoPackForce} /> 
                    <span style={{ marginLeft: 8 }}>Tắt xoay tự do, ép xoay đúng theo chiều đã chọn để hàng cắt ngay ngắn.</span>
                </div>
                <Alert 
                    type="info" 
                    showIcon 
                    message="Hệ thống sẽ tự động tính toán Số con tối đa trên 1 hàng dựa vào lựa chọn của bạn và Khổ vải hiện tại." 
                    style={{ marginTop: 16 }}
                />
            </Modal>
        </Card>
    );
};

export default UnifiedDesignWorkflow;

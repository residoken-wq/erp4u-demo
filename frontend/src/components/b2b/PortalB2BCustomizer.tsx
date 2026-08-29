import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { WizardConfigData, WizardCategoryL1, WizardCategoryL2 } from './types';
import CategoryFunnel from './CategoryFunnel';
import ConfiguratorAccordion from './ConfiguratorAccordion';
import ProductVisualizer from './ProductVisualizer';
import DynamicPriceBar from './DynamicPriceBar';
import PortalB2BOrderModal from './PortalB2BOrderModal';
import SelectionSummary from './SelectionSummary';

interface Props {
    slug: string;
    token: string;
    onClose: () => void;
}

export default function PortalB2BCustomizer({ slug, token, onClose }: Props) {
    const [config, setConfig] = useState<WizardConfigData | null>(null);
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);

    // Selections state
    const [selectedL1, setSelectedL1] = useState<string>('');
    const [selectedL2, setSelectedL2] = useState<string>('');
    const [stepSelections, setStepSelections] = useState<Record<string, string>>({}); // stepId -> optionId
    const [skippedSteps, setSkippedSteps] = useState<Record<string, boolean>>({});

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageSelections, setImageSelections] = useState<Record<string, number>>({}); // optionId -> image index

    useEffect(() => {
        const loadData = async () => {
            try {
                const [settingsRes, configRes] = await Promise.all([
                    fetch(`${API_URL}/public/settings`),
                    fetch(`${API_URL}/public/wizard/config`)
                ]);

                if (settingsRes.ok) {
                    const settingsData = await settingsRes.json();
                    setSettings(settingsData);
                }

                if (configRes.ok) {
                    const configData = await configRes.json();
                    setConfig(configData);

                    // Khởi tạo state mặc định nếu có categories
                    if (configData.categories && configData.categories.length > 0) {
                        const firstL1 = configData.categories[0];
                        setSelectedL1(firstL1.id);
                        if (firstL1.subcategories && firstL1.subcategories.length > 0) {
                            setSelectedL2(firstL1.subcategories[0].id);
                        }
                    }
                }
            } catch (error) {
                console.error('Lỗi khi tải dữ liệu trang:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Helper: get current L1 and L2
    const currentL1: WizardCategoryL1 | undefined = config?.categories?.find(c => c.id === selectedL1);
    const currentL2: WizardCategoryL2 | undefined = currentL1?.subcategories?.find(c => c.id === selectedL2);

    // Initialize default selections when switching L2
    useEffect(() => {
        if (currentL2 && currentL2.customization_steps) {
            const initialSelections: Record<string, string> = {};
            currentL2.customization_steps.forEach(step => {
                if (step.default_option_id) {
                    initialSelections[step.id] = step.default_option_id;
                } else if (step.options && step.options.length > 0) {
                    initialSelections[step.id] = step.options[0].id;
                }
            });
            setStepSelections(initialSelections);
        }
    }, [selectedL2, currentL2]);

    const handleSelectL1 = (id: string) => {
        setSelectedL1(id);
        const l1 = config?.categories?.find(c => c.id === id);
        if (l1 && l1.subcategories && l1.subcategories.length > 0) {
            setSelectedL2(l1.subcategories[0].id);
        } else {
            setSelectedL2('');
        }
    };

    const handleSelectL2 = (id: string) => {
        setSelectedL2(id);
    };

    const handleStepChange = (stepId: string, optionId: string) => {
        setStepSelections(prev => ({
            ...prev,
            [stepId]: optionId
        }));
        // Un-skip if was skipped
        setSkippedSteps(prev => ({ ...prev, [stepId]: false }));
    };

    const handleSkipStep = (stepId: string) => {
        setSkippedSteps(prev => ({
            ...prev,
            [stepId]: !prev[stepId]
        }));
    };

    const handleImageSelect = (optionId: string, imageIndex: number) => {
        setImageSelections(prev => ({
            ...prev,
            [optionId]: imageIndex
        }));
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!config || !config.categories || config.categories.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Trang đang được cập nhật</h2>
                <p className="text-gray-500">Vui lòng quay lại sau</p>
            </div>
        );
    }

    const selectedOptionsList = currentL2?.customization_steps?.map(step => {
        const optionId = stepSelections[step.id];
        return step.options?.find(o => o.id === optionId);
    }).filter(Boolean) as any[] || [];

    return (
        <div className="bg-gray-50 pb-20 w-full min-h-screen relative">
            {/* Header / Close button */}
            <div className="bg-white border-b sticky top-0 z-50 flex items-center justify-between px-6 py-4 shadow-sm">
                <h2 className="text-xl font-bold text-gray-800">Tự Thiết Kế Sản Phẩm</h2>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition text-xl">✕</button>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8 md:py-12">
                <CategoryFunnel 
                    categories={config.categories}
                    selectedL1={selectedL1}
                    selectedL2={selectedL2}
                    onSelectL1={handleSelectL1}
                    onSelectL2={handleSelectL2}
                />

                {currentL2 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                        {/* Cột trái: Visualization */}
                        <div className="lg:sticky lg:top-24 h-max">
                            <ProductVisualizer 
                                subcategory={currentL2}
                                selectedOptions={selectedOptionsList}
                                stepSelections={stepSelections}
                                imageSelections={imageSelections}
                                skippedSteps={skippedSteps}
                            />
                            <SelectionSummary
                                subcategory={currentL2}
                                steps={currentL2.customization_steps || []}
                                selections={stepSelections}
                                skippedSteps={skippedSteps}
                            />
                        </div>

                        {/* Cột phải: Accordion Configurator & Dynamic Pricing */}
                        <div className="flex flex-col gap-6">
                            {currentL2.customization_steps && currentL2.customization_steps.length > 0 ? (
                                <ConfiguratorAccordion 
                                    steps={currentL2.customization_steps}
                                    selections={stepSelections}
                                    onChange={handleStepChange}
                                    skippedSteps={skippedSteps}
                                    onSkip={handleSkipStep}
                                    imageSelections={imageSelections}
                                    onImageSelect={handleImageSelect}
                                />
                            ) : (
                                <div className="p-8 bg-white rounded-xl shadow-sm text-center border border-gray-100">
                                    <p className="text-gray-500">Sản phẩm này chưa có cấu hình tùy biến.</p>
                                </div>
                            )}

                            <DynamicPriceBar 
                                subcategory={currentL2}
                                steps={currentL2.customization_steps || []}
                                selections={stepSelections}
                                onShowModal={() => setIsModalOpen(true)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <p className="text-gray-500">Vui lòng chọn một danh mục sản phẩm ở trên</p>
                    </div>
                )}
            </main>

            {/* Quy trình & Trust Section */}
            <section className="bg-white py-20 mt-12 relative overflow-hidden border-t border-gray-100">
                {/* Background decorative elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
                
                <div className="max-w-6xl mx-auto px-4 relative z-10">
                    <div className="text-center mb-16">
                        <span className="text-sm font-bold tracking-wider text-primary uppercase mb-2 block">Roadmap</span>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Quy Trình Triển Khai B2B Chuyên Nghiệp</h2>
                        <p className="text-gray-500 max-w-2xl mx-auto text-lg">Đồng hành cùng bạn từ ý tưởng đến sản phẩm hoàn thiện với quy trình khép kín, minh bạch và tối ưu.</p>
                    </div>

                    <div className="relative">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-blue-100 via-primary to-blue-100 -translate-y-1/2 z-0 opacity-50 rounded-full"></div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 relative z-10">
                            {/* Step 1 */}
                            <div className="group relative bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-300">
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full p-1 shadow-sm">
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-primary text-white rounded-full flex items-center justify-center font-bold text-lg shadow-inner">1</div>
                                </div>
                                <div className="mt-6 text-center">
                                    <div className="w-14 h-14 mx-auto bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-lg mb-3 text-gray-800">Tư Vấn & Lên Ý Tưởng</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">Trao đổi yêu cầu, chọn mẫu thiết kế, và nhận bảng giá chi tiết phù hợp với ngân sách.</p>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="group relative bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-300 md:mt-8">
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full p-1 shadow-sm">
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-primary text-white rounded-full flex items-center justify-center font-bold text-lg shadow-inner">2</div>
                                </div>
                                <div className="mt-6 text-center">
                                    <div className="w-14 h-14 mx-auto bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-lg mb-3 text-gray-800">Thiết Kế Mockup</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">Lên phối cảnh 3D thực tế với màu sắc thương hiệu và logo trường một cách trực quan.</p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="group relative bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-300">
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full p-1 shadow-sm">
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-primary text-white rounded-full flex items-center justify-center font-bold text-lg shadow-inner">3</div>
                                </div>
                                <div className="mt-6 text-center">
                                    <div className="w-14 h-14 mx-auto bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-lg mb-3 text-gray-800">Duyệt Mẫu Thực Tế</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">Gửi mẫu thật đến tận nơi để nhà trường kiểm tra trực tiếp chất liệu và form dáng.</p>
                                </div>
                            </div>

                            {/* Step 4 */}
                            <div className="group relative bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-300 md:mt-8">
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full p-1 shadow-sm">
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-primary text-white rounded-full flex items-center justify-center font-bold text-lg shadow-inner">4</div>
                                </div>
                                <div className="mt-6 text-center">
                                    <div className="w-14 h-14 mx-auto bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                                    </div>
                                    <h3 className="font-bold text-lg mb-3 text-gray-800">Sản Xuất & Giao Hàng</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">Tiến hành sản xuất số lượng lớn đúng tiến độ cam kết và giao hàng tận nơi nhanh chóng.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* B2B Lead Modal */}
            {currentL1 && currentL2 && (
                <PortalB2BOrderModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={onClose}
                    slug={slug}
                    token={token}
                    category={currentL1}
                    subcategory={currentL2}
                    steps={currentL2.customization_steps || []}
                    selections={stepSelections}
                />
            )}
        </div>
    );
}

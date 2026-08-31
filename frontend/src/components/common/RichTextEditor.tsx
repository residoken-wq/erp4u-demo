import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Input, Button, Spin, Empty, message } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import { API_URL } from '../../config';
import 'ckeditor5/ckeditor5.css';

interface RichTextEditorProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    minHeight?: number;
}

// Helpers
const resolveImageUrl = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('/uploads/')) {
        // Use the API's proxy for uploads if possible, or just the URL directly
        return `${API_URL}/upload/files/${url.replace('/uploads/', '')}`;
    }
    return url;
};

// Custom Upload Adapter
class ERP4UUploadAdapter {
    private loader: any;
    private xhr?: XMLHttpRequest;

    constructor(loader: any) {
        this.loader = loader;
    }

    upload(): Promise<{ default: string }> {
        return this.loader.file.then((file: File) => new Promise<{ default: string }>((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('source', 'erp');

            const token = localStorage.getItem('token');

            this.xhr = new XMLHttpRequest();
            this.xhr.open('POST', `${API_URL}/upload/image`, true);
            if (token) {
                this.xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            this.xhr.upload.addEventListener('progress', (evt) => {
                if (evt.lengthComputable) {
                    this.loader.uploadTotal = evt.total;
                    this.loader.uploaded = evt.loaded;
                }
            });

            this.xhr.addEventListener('load', () => {
                if (!this.xhr) return;
                if (this.xhr.status >= 200 && this.xhr.status < 300) {
                    try {
                        const response = JSON.parse(this.xhr.responseText);
                        const rawUrl = response.url || response.path || response.data?.url || '';
                        resolve({ default: resolveImageUrl(rawUrl) });
                    } catch {
                        reject('Invalid server response.');
                    }
                } else {
                    reject(`Upload failed with status ${this.xhr.status}`);
                }
            });

            this.xhr.addEventListener('error', () => reject('Upload failed due to network error.'));
            this.xhr.addEventListener('abort', () => reject('Upload aborted.'));

            this.xhr.send(formData);
        }));
    }

    abort() {
        if (this.xhr) {
            this.xhr.abort();
        }
    }
}

function ERP4UUploadAdapterPlugin(editor: any) {
    editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => {
        return new ERP4UUploadAdapter(loader);
    };
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
    value,
    onChange,
    placeholder = 'Nhập nội dung...',
    minHeight = 400
}) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const [isLayoutReady, setIsLayoutReady] = useState(false);
    const [toolbarContainer, setToolbarContainer] = useState<HTMLElement | null>(null);

    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Library state
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [libraryFiles, setLibraryFiles] = useState<any[]>([]);
    const [librarySearch, setLibrarySearch] = useState('');

    useEffect(() => {
        setIsLayoutReady(true);
        return () => setIsLayoutReady(false);
    }, []);

    useEffect(() => {
        if (!isLayoutReady || !editorContainerRef.current) return;

        let editorInstance: any = null;

        const initEditor = async () => {
            try {
                // Dynamic import CKEditor packages
                // In Vite, we import from 'ckeditor5' package if we have the all-in-one build or standard package
                const {
                    ClassicEditor, Essentials, Paragraph, Bold, Italic, Underline,
                    Heading, Link, List, Table, TableToolbar, Alignment,
                    BlockQuote, Indent, IndentBlock, Image, ImageUpload,
                    ImageResize, ImageToolbar, ImageCaption, ImageInsert,
                    MediaEmbed, HtmlEmbed, SourceEditing, GeneralHtmlSupport,
                    FontSize, FontFamily, FontColor, FontBackgroundColor
                } = await import('ckeditor5');

                if (editorRef.current) return;

                editorInstance = await ClassicEditor.create(editorContainerRef.current!, {
                    plugins: [
                        Essentials, Paragraph, Bold, Italic, Underline,
                        Heading, Link, List, Table, TableToolbar, Alignment,
                        BlockQuote, Indent, IndentBlock,
                        Image, ImageUpload, ImageResize, ImageToolbar, ImageCaption, ImageInsert,
                        MediaEmbed, HtmlEmbed, SourceEditing, GeneralHtmlSupport,
                        FontSize, FontFamily, FontColor, FontBackgroundColor
                    ],
                    extraPlugins: [ERP4UUploadAdapterPlugin],
                    toolbar: {
                        items: [
                            'heading', '|',
                            'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|',
                            'bold', 'italic', 'underline', '|',
                            'link', 'blockQuote', '|',
                            'bulletedList', 'numberedList', '|',
                            'outdent', 'indent', '|',
                            'alignment', '|',
                            'insertImage', 'insertTable', 'mediaEmbed', 'htmlEmbed', '|',
                            'sourceEditing', '|',
                            'undo', 'redo'
                        ],
                        shouldNotGroupWhenFull: false
                    },
                    heading: {
                        options: [
                            { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                            { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
                            { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                            { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
                        ]
                    },
                    fontSize: {
                        options: [
                            8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36
                        ],
                        supportAllValues: true
                    },
                    image: {
                        toolbar: ['imageTextAlternative', '|', 'imageResize'],
                        resizeOptions: [
                            { name: 'resizeImage:original', value: null, label: 'Original' },
                            { name: 'resizeImage:50', value: '50', label: '50%' },
                            { name: 'resizeImage:75', value: '75', label: '75%' },
                        ],
                    },
                    table: {
                        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
                    },
                    htmlSupport: {
                        allow: [
                            { name: /.*/, attributes: true, classes: true, styles: true }
                        ]
                    },
                    placeholder: placeholder
                });

                editorRef.current = editorInstance;

                if (value) {
                    editorInstance.setData(value);
                }

                editorInstance.model.document.on('change:data', () => {
                    const data = editorInstance.getData();
                    if (onChangeRef.current) onChangeRef.current(data);
                });

                // Attach custom Library Button
                setTimeout(() => {
                    const tbWrappers = document.querySelectorAll('.ck-toolbar__items');
                    tbWrappers.forEach(tb => {
                        if (!tb.querySelector('.custom-library-btn-slot')) {
                            const btnSlot = document.createElement('div');
                            btnSlot.className = 'ck ck-toolbar__item custom-library-btn-slot';
                            btnSlot.style.display = 'flex';
                            btnSlot.style.alignItems = 'center';
                            btnSlot.style.padding = '0 6px';
                            btnSlot.style.marginLeft = 'auto'; 
                            tb.appendChild(btnSlot);
                            setToolbarContainer(btnSlot);
                        }
                    });
                }, 300);

                // Listen to mode toggle to sync data
                const sourceEditing = editorInstance.plugins.get('SourceEditing');
                if (sourceEditing) {
                    sourceEditing.on('change:isSourceEditingMode', (evt: any, name: string, isSourceMode: boolean) => {
                        if (!isSourceMode) {
                            if (onChangeRef.current) onChangeRef.current(editorInstance.getData());
                        } else {
                            // When entering source mode, attach input listener to the textarea
                            setTimeout(() => {
                                const textarea = editorContainerRef.current?.querySelector('.ck-source-editing-area textarea');
                                if (textarea) {
                                    textarea.addEventListener('input', () => {
                                        if (onChangeRef.current) onChangeRef.current(editorInstance.getData());
                                    });
                                }
                            }, 100);
                        }
                    });
                }

            } catch (error) {
                console.error('Failed to initialize CKEditor:', error);
            }
        };

        if (isLayoutReady) {
            initEditor();
        }

        return () => {
            if (editorRef.current) {
                editorRef.current.destroy().catch((err: any) => console.error(err));
                editorRef.current = null;
            }
        };
    }, [isLayoutReady]);

    // Value sync
    useEffect(() => {
        if (editorRef.current) {
            const currentData = editorRef.current.getData();
            if (value !== currentData && value !== undefined) {
                const isFocused = editorRef.current.editing.view.document.isFocused;
                
                let isSourceEditing = false;
                try {
                    const sourceEditingPlugin = editorRef.current.plugins.get('SourceEditing');
                    if (sourceEditingPlugin) {
                        isSourceEditing = sourceEditingPlugin.isSourceEditingMode;
                    }
                } catch (e) {
                    console.warn(e);
                }

                if (!isFocused && !isSourceEditing) {
                    editorRef.current.setData(value || '');
                }
            }
        }
    }, [value]);

    const openLibrary = async () => {
        setLibraryOpen(true);
        setLibrarySearch('');
        try {
            setLibraryLoading(true);
            const res = await api.get('/upload/list?source=erp');
            setLibraryFiles(Array.isArray(res.data) ? res.data : []);
        } catch {
            message.error('Không thể tải thư viện hình ảnh');
        } finally {
            setLibraryLoading(false);
        }
    };

    const handlePickFromLibrary = (url: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        const resolvedUrl = resolveImageUrl(url);
        editor.model.change((writer: any) => {
            const imageElement = writer.createElement('imageBlock', { src: resolvedUrl });
            editor.model.insertContent(imageElement);
        });

        setLibraryOpen(false);
        message.success('Đã chèn ảnh');
    };

    const filteredLibraryFiles = libraryFiles.filter(f =>
        (f?.name || '').toLowerCase().includes(librarySearch.trim().toLowerCase())
    );

    return (
        <div className="ckeditor-wrapper" style={{ position: 'relative' }}>
            <div ref={editorContainerRef} style={{ minHeight: `${minHeight}px` }} />

            {toolbarContainer && createPortal(
                <Button
                    icon={<PictureOutlined />}
                    onClick={openLibrary}
                    type="primary"
                    size="small"
                    style={{ background: '#1677ff', border: 'none' }}
                >
                    Thư viện
                </Button>,
                toolbarContainer
            )}

            <Modal
                title="Thư viện hình ảnh"
                open={libraryOpen}
                onCancel={() => setLibraryOpen(false)}
                footer={null}
                width={800}
                destroyOnClose
            >
                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                    <Input
                        placeholder="Tìm kiếm ảnh..."
                        value={librarySearch}
                        onChange={e => setLibrarySearch(e.target.value)}
                    />
                    <Button onClick={openLibrary}>Làm mới</Button>
                </div>

                {libraryLoading ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div> : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: 10,
                        maxHeight: 400,
                        overflowY: 'auto'
                    }}>
                        {filteredLibraryFiles.length > 0 ? filteredLibraryFiles.map(f => (
                            <div
                                key={f.name}
                                onClick={() => handlePickFromLibrary(f.url)}
                                style={{
                                    border: '1px solid #ddd',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    textAlign: 'center'
                                }}
                            >
                                <img src={resolveImageUrl(f.url)} alt={f.name} style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                                <div style={{ fontSize: 11, padding: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                            </div>
                        )) : <Empty />}
                    </div>
                )}
            </Modal>

            <style>{`
                .ck-editor__editable {
                    min-height: ${minHeight}px !important;
                }
                .ck-content {
                    font-size: 14px;
                }
                .ck-content ul, .ck-content ol {
                    margin-left: 20px !important;
                    padding-left: 0 !important;
                }
                /* Add more CKEditor specific styling as needed */
            `}</style>
        </div>
    );
};

export default RichTextEditor;

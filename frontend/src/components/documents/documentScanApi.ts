import api from '../../utils/api';
import { mapScanErrorCode } from './documentScanTransformers';

export interface DocumentScanResponse {
  id: string;
  status: 'processing' | 'ready' | 'failed' | 'linked' | string;
  kind: 'supplier_quote' | 'delivery_note' | 'expense_invoice' | string;
  source: 'xml' | 'image' | 'pdf' | string;
  file_key: string;
  mime: string;
  size_bytes: number;
  page_count: number;
  sha256: string;
  extracted?: Record<string, any> | null;
  field_confidence?: Record<string, any> | null;
  warnings?: Array<Record<string, any>> | null;
  suggestions?: Record<string, any> | null;
  error_code?: string | null;
  result_type?: string | null;
  result_id?: string | null;
  created_at: string;
  expires_at: string;
}

export interface DocumentScanByRefResponse {
  id: string;
  expires_at: string;
}

/**
 * Upload file chứng từ lên server để AI hoặc TT78 parser trích xuất
 */
export async function uploadScanDocument(
  file: File,
  kind: string = 'auto',
  onProgress?: (percent: number) => void,
): Promise<DocumentScanResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);

  try {
    const res = await api.post('/ai/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  } catch (err: any) {
    const errorCode = err?.response?.data?.code || err?.response?.data?.error_code;
    const fallbackMsg = err?.response?.data?.message || err?.message;
    const vietnameseMsg = mapScanErrorCode(errorCode, fallbackMsg);
    const error: any = new Error(vietnameseMsg);
    error.code = errorCode;
    error.statusCode = err?.response?.status;
    throw error;
  }
}

/**
 * Lấy chi tiết thông tin bản trích xuất
 */
export async function getScanDocument(id: string): Promise<DocumentScanResponse> {
  try {
    const res = await api.get(`/ai/documents/${id}`);
    return res.data;
  } catch (err: any) {
    const errorCode = err?.response?.data?.code;
    const fallbackMsg = err?.response?.data?.message || 'Không tìm thấy chứng từ hoặc không có quyền truy cập';
    const error: any = new Error(mapScanErrorCode(errorCode, fallbackMsg));
    error.statusCode = err?.response?.status;
    throw error;
  }
}

/**
 * Đổi loại chứng từ sau khi AI đoán loại tự động (Copilot auto classify)
 */
export async function patchScanDocumentKind(id: string, kind: string): Promise<DocumentScanResponse> {
  const res = await api.patch(`/ai/documents/${id}`, { kind });
  return res.data;
}

/**
 * Liên kết bản đọc với chứng từ nghiệp vụ đã lưu
 */
export async function linkScanDocument(
  id: string,
  resultType: string,
  resultId: string | number,
): Promise<{ status: string; result_type: string; result_id: string }> {
  const res = await api.post(`/ai/documents/${id}/link`, {
    result_type: resultType,
    result_id: String(resultId),
  });
  return res.data;
}

/**
 * Tra cứu chứng từ gốc theo thực thể nghiệp vụ (PO, goods receipt, transaction)
 */
export async function getScanDocumentByRef(
  resultType: string,
  resultId: string | number,
): Promise<DocumentScanByRefResponse | null> {
  try {
    const res = await api.get('/ai/documents/by-ref', {
      params: {
        result_type: resultType,
        result_id: String(resultId),
      },
    });
    return res.data;
  } catch (err: any) {
    // 404 hoặc 403 -> ẩn hoàn toàn
    return null;
  }
}

/**
 * Tải file gốc chứng từ qua endpoint xác thực JWT và tạo Blob URL
 */
export async function fetchDocumentFileBlobUrl(id: string): Promise<{ blobUrl: string; mimeType: string }> {
  const res = await api.get(`/ai/documents/${id}/file`, {
    responseType: 'blob',
  });
  const blob: Blob = res.data;
  const mimeType = blob.type || 'application/octet-stream';
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, mimeType };
}

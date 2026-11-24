import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import { getScanDocument, linkScanDocument, DocumentScanResponse } from '../components/documents/documentScanApi';

export interface UseAiScanOptions {
  expectedKind?: 'supplier_quote' | 'delivery_note' | 'expense_invoice' | string;
  onScanLoaded?: (scan: DocumentScanResponse) => void;
}

export function useAiScan(options: UseAiScanOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scanId = searchParams.get('aiScan');

  const [scan, setScan] = useState<DocumentScanResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const clearScanFromUrl = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('aiScan');
    setSearchParams(nextParams, { replace: true });
    setScan(null);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!scanId) {
      setScan(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getScanDocument(scanId)
      .then((detail) => {
        if (!isMounted) return;

        // Nếu có expectedKind và không khớp -> bỏ qua
        if (options.expectedKind && detail.kind !== options.expectedKind) {
          return;
        }

        setScan(detail);
        if (options.onScanLoaded) {
          options.onScanLoaded(detail);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        message.warning(err.message || 'Không thể tải thông tin chứng từ đã quét');
        clearScanFromUrl();
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [scanId]);

  /**
   * Gọi link sau khi lưu nghiệp vụ thành công. Nếu lỗi chỉ cảnh báo, không chặn.
   */
  const link = useCallback(
    async (resultType: string, resultId: string | number) => {
      if (!scanId) return;
      try {
        await linkScanDocument(scanId, resultType, resultId);
      } catch (err: any) {
        message.warning(`Không thể liên kết chứng từ gốc: ${err.message || 'Lỗi mạng'}`);
      }
    },
    [scanId],
  );

  return {
    scanId,
    scan,
    setScan,
    loading,
    clearScanFromUrl,
    link,
  };
}

export default useAiScan;

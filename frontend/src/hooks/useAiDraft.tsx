import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Alert, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import {
  AiDraftDetail,
  DraftConfirmResult,
  getDraftDetail,
  confirmDraft,
} from '../components/copilot/draftApi';
import {
  mapDraftValidationErrors,
  getDraftStatusInfo,
} from '../components/copilot/draftRoutes';

export interface UseAiDraftOptions {
  expectedKind?: string;
  onDraftLoaded?: (draft: AiDraftDetail) => void;
  onConfirmSuccess?: (result: DraftConfirmResult) => void;
  form?: any;
}

export function useAiDraft(options: UseAiDraftOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const draftId = searchParams.get('aiDraft');

  const [draft, setDraft] = useState<AiDraftDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);

  const clearDraftFromUrl = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('aiDraft');
    setSearchParams(nextParams, { replace: true });
    setDraft(null);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!draftId) {
      setDraft(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getDraftDetail(draftId)
      .then((detail) => {
        if (!isMounted) return;

        // Nháp không còn pending -> thông báo và không mở form
        if (detail.status !== 'pending') {
          const statusInfo = getDraftStatusInfo(detail.status);
          message.warning(
            `Bản nháp không còn ở trạng thái chờ duyệt (${statusInfo.label}).`,
          );
          clearDraftFromUrl();
          return;
        }

        // Kiểm tra đúng loại nếu có yêu cầu
        if (options.expectedKind && detail.kind !== options.expectedKind) {
          // Không đúng loại của trang
          return;
        }

        setDraft(detail);
        if (options.onDraftLoaded) {
          options.onDraftLoaded(detail);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        message.warning(err.message || 'Bản nháp không tồn tại hoặc bạn không có quyền truy cập');
        clearDraftFromUrl();
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [draftId]);

  const confirm = useCallback(
    async (payload: Record<string, any>): Promise<DraftConfirmResult | null> => {
      if (!draftId) {
        throw new Error('Không có mã nháp để xác nhận');
      }

      setConfirming(true);
      try {
        const result = await confirmDraft(draftId, payload);
        message.success('Đã xác nhận và tạo thành công!');

        if (options.onConfirmSuccess) {
          options.onConfirmSuccess(result);
        }

        clearDraftFromUrl();

        if (result.result_ref?.path) {
          navigate(result.result_ref.path);
        }

        return result;
      } catch (err: any) {
        if (err.code === 'DRAFT_INVALID') {
          if (options.form && Array.isArray(err.errors)) {
            const { fieldErrors } = mapDraftValidationErrors(err.errors);
            options.form.setFields(fieldErrors);
          }
          message.error(err.message || 'Dữ liệu nháp không hợp lệ, vui lòng kiểm tra lại');
        } else {
          message.error(err.message || 'Có lỗi khi xác nhận bản nháp');
        }
        return null;
      } finally {
        setConfirming(false);
      }
    },
    [draftId, options, navigate, clearDraftFromUrl],
  );

  const isAiDraft = useMemo(() => {
    return !!draft && draft.status === 'pending';
  }, [draft]);

  const warningBanner = useMemo(() => {
    if (!isAiDraft) return null;
    return (
      <Alert
        type="warning"
        showIcon
        icon={<RobotOutlined />}
        message="Nháp do AI soạn — kiểm tra kỹ trước khi lưu."
        style={{ marginBottom: 16, borderRadius: 6 }}
      />
    );
  }, [isAiDraft]);

  return {
    draftId,
    draft,
    isAiDraft,
    loading,
    confirming,
    confirm,
    clearDraftFromUrl,
    warningBanner,
  };
}

export default useAiDraft;

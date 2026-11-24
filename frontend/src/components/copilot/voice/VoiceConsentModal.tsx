import React from 'react';
import { Modal, Typography, Space } from 'antd';
import { AudioOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import {
  VoiceProvider,
  VOICE_CONSENT_KEY,
  VOICE_CONSENT_KEY_PREFIX,
  getVoiceConsentKey,
  VOICE_DENIED_SESSION_KEY,
  hasUserGivenVoiceConsent,
  saveUserVoiceConsent,
  wasPermissionDeniedInSession,
  markPermissionDeniedInSession,
} from './voiceStateMachine.ts';
import { brandColors } from '../../../theme/brand.ts';

const { Text, Paragraph } = Typography;

export {
  VOICE_CONSENT_KEY,
  VOICE_CONSENT_KEY_PREFIX,
  getVoiceConsentKey,
  VOICE_DENIED_SESSION_KEY,
  hasUserGivenVoiceConsent,
  saveUserVoiceConsent,
  wasPermissionDeniedInSession,
  markPermissionDeniedInSession,
};

interface VoiceConsentModalProps {
  open: boolean;
  provider?: VoiceProvider;
  onConsent: () => void;
  onCancel: () => void;
}

export const VoiceConsentModal: React.FC<VoiceConsentModalProps> = ({
  open,
  provider = 'gemini',
  onConsent,
  onCancel,
}) => {
  const isBrowser = provider === 'browser';

  const explanationText = isBrowser
    ? 'Âm thanh do trình duyệt gửi tới dịch vụ nhận dạng của nhà sản xuất trình duyệt để chuyển thành chữ. Chữ sẽ hiện để bạn kiểm trước khi gửi.'
    : 'Âm thanh được gửi tới nhà cung cấp AI (Gemini) để chuyển thành chữ, không lưu lại. Chữ sẽ hiện để bạn kiểm trước khi gửi.';

  const handleOk = () => {
    saveUserVoiceConsent(provider);
    onConsent();
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <AudioOutlined style={{ color: brandColors.navy }} />
          <span>Sử dụng giọng nói với ERP4U Copilot</span>
        </Space>
      }
      onOk={handleOk}
      onCancel={onCancel}
      okText="Tôi đồng ý & Bật micro"
      cancelText="Hủy"
      okButtonProps={{
        style: { background: brandColors.navy, borderColor: brandColors.navy },
      }}
      destroyOnClose
      centered
      width={460}
    >
      <div style={{ marginTop: 12 }}>
        <Paragraph style={{ fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
          {explanationText}
        </Paragraph>
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            marginTop: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 16, marginTop: 2 }} />
          <Text style={{ fontSize: 12, color: '#475569' }}>
            ERP4U cam kết không lưu lại file âm thanh ghi âm. Văn bản sau khi nhận diện sẽ được điền vào ô nhập để bạn tự kiểm tra và duyệt trước khi bấm gửi.
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default VoiceConsentModal;

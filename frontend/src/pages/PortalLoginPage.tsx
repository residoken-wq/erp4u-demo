import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';

// Standalone Portal Login Page — NOT inside AdminLayout
// Design follows erp4u-website CSS globals (Be Vietnam Pro, #23A7D3 primary, pill buttons)

const PortalLoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [customerName, setCustomerName] = useState('');

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/public/portal/request-otp`, { email: email.trim() });
            if (res.data.success) {
                setCustomerName(res.data.customer_name || '');
                setStep('OTP');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/public/portal/verify-otp`, {
                email: email.trim(),
                otp_code: otpCode.trim(),
            });
            if (res.data.success) {
                // Store token and customer info in sessionStorage
                sessionStorage.setItem('portal_token', res.data.token);
                sessionStorage.setItem('portal_customer', JSON.stringify(res.data.customer));
                sessionStorage.setItem('portal_slug', res.data.slug);
                // Navigate to dashboard
                navigate(`/portal/${res.data.slug}`);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.wrapper}>
            {/* Background decoration */}
            <div style={styles.bgDecor1} />
            <div style={styles.bgDecor2} />

            <div style={styles.container}>
                {/* Logo */}
                <div style={styles.logoSection}>
                    <a href="https://demo.erp4u.local" target="_blank" rel="noopener noreferrer" style={styles.logoLink}>
                        <img src="/logo-erp4u.png" alt="ERP4U" style={{ height: 150, width: 'auto', marginBottom: 8, objectFit: 'contain' }} />
                        <div style={styles.logoSub}>Cổng Đối Tác B2B</div>
                    </a>
                </div>

                {/* Card */}
                <div style={styles.card}>
                    {step === 'EMAIL' ? (
                        <>
                            <h1 style={styles.title}>Đăng Nhập Đối Tác</h1>
                            <p style={styles.subtitle}>
                                Nhập email đã đăng ký để nhận mã xác thực OTP
                            </p>

                            <form onSubmit={handleRequestOtp}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Email</label>
                                    <div style={styles.inputWrapper}>
                                        <span style={styles.inputIcon}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#23A7D3" strokeWidth="2">
                                                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </span>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="email@truonghoc.edu.vn"
                                            required
                                            style={styles.input}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {error && <div style={styles.errorBox}>{error}</div>}

                                <button type="submit" disabled={loading} style={{
                                    ...styles.button,
                                    opacity: loading ? 0.7 : 1,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                }}>
                                    {loading ? (
                                        <span style={styles.loadingDots}>Đang gửi...</span>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                                            </svg>
                                            Gửi Mã OTP
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <h1 style={styles.title}>Xác Thực OTP</h1>
                            <p style={styles.subtitle}>
                                {customerName && <><strong>Xin chào {customerName}</strong><br /></>}
                                Nhập mã 6 số đã được gửi đến <strong>{email}</strong>
                            </p>

                            <form onSubmit={handleVerifyOtp}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Mã OTP</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="______"
                                        required
                                        style={{
                                            ...styles.input,
                                            textAlign: 'center',
                                            fontSize: 28,
                                            letterSpacing: 12,
                                            fontWeight: 800,
                                            fontFamily: 'monospace',
                                            padding: '16px 20px',
                                        }}
                                        autoFocus
                                    />
                                    <p style={styles.otpHint}>Mã hết hạn sau 5 phút</p>
                                </div>

                                {error && <div style={styles.errorBox}>{error}</div>}

                                <button type="submit" disabled={loading || otpCode.length < 6} style={{
                                    ...styles.button,
                                    opacity: (loading || otpCode.length < 6) ? 0.7 : 1,
                                    cursor: (loading || otpCode.length < 6) ? 'not-allowed' : 'pointer',
                                }}>
                                    {loading ? 'Đang xác thực...' : '🔐 Xác Nhận Đăng Nhập'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setStep('EMAIL'); setOtpCode(''); setError(''); }}
                                    style={styles.backButton}
                                >
                                    ← Quay lại nhập email
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRequestOtp}
                                    disabled={loading}
                                    style={styles.resendButton}
                                >
                                    Gửi lại mã OTP
                                </button>
                            </form>
                        </>
                    )}
                </div>

                {/* Footer info */}
                <div style={styles.footer}>
                    <p>Chưa có tài khoản? <a href="https://demo.erp4u.local/lien-he" style={styles.footerLink}>Đăng ký đối tác</a></p>
                    <p style={{ marginTop: 4, fontSize: 12, color: '#aaa' }}>
                        © 2026 ERP4U - Nệm Mầm Non | localhost:8080
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- STYLES ---
const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fcff 0%, #e8f7fc 30%, #f0f4f8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Be Vietnam Pro', 'Inter', -apple-system, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        padding: '20px',
    },
    bgDecor1: {
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(35,167,211,0.08) 0%, transparent 70%)',
        top: -100,
        right: -100,
    },
    bgDecor2: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(35,167,211,0.06) 0%, transparent 70%)',
        bottom: -80,
        left: -80,
    },
    container: {
        width: '100%',
        maxWidth: 440,
        zIndex: 1,
        position: 'relative' as const,
    },
    logoSection: {
        textAlign: 'center' as const,
        marginBottom: 32,
    },
    logoLink: {
        textDecoration: 'none',
    },
    logoText: {
        fontSize: 36,
        fontWeight: 900,
        color: '#23A7D3',
        letterSpacing: 4,
        lineHeight: 1,
    },
    logoSub: {
        fontSize: 13,
        color: '#888',
        marginTop: 4,
        letterSpacing: 2,
        textTransform: 'uppercase' as const,
    },
    card: {
        background: '#fff',
        borderRadius: 20,
        padding: '40px 36px',
        boxShadow: '0 8px 40px rgba(35,167,211,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        border: '1px solid rgba(35,167,211,0.1)',
    },
    title: {
        fontSize: 24,
        fontWeight: 800,
        color: '#1a1a1a',
        margin: '0 0 8px',
        textAlign: 'center' as const,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center' as const,
        marginBottom: 28,
        lineHeight: 1.6,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        color: '#555',
        marginBottom: 6,
    },
    inputWrapper: {
        position: 'relative' as const,
    },
    inputIcon: {
        position: 'absolute' as const,
        left: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
    },
    input: {
        width: '100%',
        padding: '14px 16px 14px 44px',
        fontSize: 15,
        border: '2px solid #e8e8e8',
        borderRadius: 12,
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        fontFamily: "'Be Vietnam Pro', sans-serif",
        boxSizing: 'border-box' as const,
        background: '#fafcfd',
    },
    otpHint: {
        fontSize: 12,
        color: '#aaa',
        textAlign: 'center' as const,
        marginTop: 8,
    },
    errorBox: {
        background: '#fff2f0',
        border: '1px solid #ffccc7',
        color: '#cf1322',
        padding: '10px 14px',
        borderRadius: 10,
        fontSize: 13,
        marginBottom: 16,
        textAlign: 'center' as const,
    },
    button: {
        width: '100%',
        padding: '14px 24px',
        background: 'linear-gradient(135deg, #23A7D3 0%, #1e8fb5 100%)',
        color: '#fff',
        fontSize: 15,
        fontWeight: 700,
        border: 'none',
        borderRadius: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        boxShadow: '0 4px 16px rgba(35,167,211,0.3)',
        fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    loadingDots: {
        animation: 'pulse 1.2s infinite',
    },
    backButton: {
        width: '100%',
        padding: '10px',
        background: 'transparent',
        color: '#23A7D3',
        fontSize: 13,
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        marginTop: 12,
        fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    resendButton: {
        width: '100%',
        padding: '10px',
        background: 'transparent',
        color: '#888',
        fontSize: 12,
        fontWeight: 500,
        border: '1px dashed #ddd',
        borderRadius: 8,
        cursor: 'pointer',
        marginTop: 8,
        fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    footer: {
        textAlign: 'center' as const,
        marginTop: 24,
        fontSize: 13,
        color: '#888',
    },
    footerLink: {
        color: '#23A7D3',
        fontWeight: 600,
        textDecoration: 'none',
    },
};

export default PortalLoginPage;

import axios from 'axios';
import { API_URL } from '../config';
import { getPackageLabel } from '../config/packages';
import { handleUnauthorized } from './authSession';

export { handleUnauthorized };

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor: Handle Errors (Global)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            handleUnauthorized();
        }
        if (error.response?.status === 402 && error.response?.data?.code === 'PACKAGE_REQUIRED') {
            const pkgLabel = getPackageLabel(error.response?.data?.package);
            import('antd').then(({ message }) =>
                message.warning(`Tính năng thuộc gói ${pkgLabel} chưa được kích hoạt. Liên hệ quản trị viên để nâng cấp.`)
            );
        }
        if (error.response?.status === 403) {
            // Permission denied - show server message
            const msg = error.response?.data?.message || 'Bạn không có quyền thực hiện thao tác này.';
            import('antd').then(({ message }) => message.error(msg));
        }
        if (error.response?.status === 429) {
            // Rate limited - display friendly notice
            const isLogin = error.config?.url?.includes('/auth/login');
            if (!isLogin) {
                const retryAfter = error.response?.data?.retryAfter;
                const msg = retryAfter
                    ? `Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ${retryAfter} giây.`
                    : (error.response?.data?.message || 'Quá nhiều yêu cầu, vui lòng thử lại sau.');
                import('antd').then(({ message }) => message.error(msg));
            }
        }
        return Promise.reject(error);
    }
);

export default api;

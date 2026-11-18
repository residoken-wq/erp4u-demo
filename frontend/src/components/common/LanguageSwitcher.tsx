import React, { useEffect, useState } from 'react';
import { Dropdown, MenuProps, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

const languages = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

export const LanguageSwitcher: React.FC = () => {
  const [currentLang, setCurrentLang] = useState('vi');

  useEffect(() => {
    // Check local storage or google translate cookie
    const savedLang = localStorage.getItem('erp_language');
    if (savedLang) {
      setCurrentLang(savedLang);
    } else {
      // Parse googtrans cookie if exists
      const match = document.cookie.match(/googtrans=\/vi\/([a-zA-Z-]+)/);
      if (match && match[1]) {
        setCurrentLang(match[1]);
        localStorage.setItem('erp_language', match[1]);
      }
    }
  }, []);

  const changeLanguage = (langCode: string) => {
    if (langCode === currentLang) return;
    
    setCurrentLang(langCode);
    localStorage.setItem('erp_language', langCode);
    
    // Set cookie for Google Translate
    if (langCode === 'vi') {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${window.location.hostname}; path=/;`;
    } else {
      document.cookie = `googtrans=/vi/${langCode}; path=/;`;
      document.cookie = `googtrans=/vi/${langCode}; domain=.${window.location.hostname}; path=/;`;
    }
    
    // Reload the page to apply translation
    window.location.reload();
  };

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    changeLanguage(e.key as string);
  };

  const currentLangObj = languages.find(l => l.code === currentLang) || languages[0];

  const items: MenuProps['items'] = languages.map((lang) => ({
    key: lang.code,
    label: (
      <Space>
        <span>{lang.flag}</span>
        <span>{lang.name}</span>
      </Space>
    ),
  }));

  return (
    <Dropdown menu={{ items, onClick: handleMenuClick, selectedKeys: [currentLang] }} placement="bottomRight" arrow>
      <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-2 rounded-md transition-colors">
        <GlobalOutlined className="text-lg text-gray-600 dark:text-gray-300" />
        <span className="hidden md:inline text-sm font-medium text-gray-700 dark:text-gray-200">
          {currentLangObj.flag} {currentLangObj.name}
        </span>
      </div>
    </Dropdown>
  );
};

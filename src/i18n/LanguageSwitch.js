/** EN / 中文 toggle. `dark` styles it for a dark background (the sign-in hero). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './index';

export default function LanguageSwitch({ dark, className = '' }) {
    const { t, i18n } = useTranslation();
    return (
        <div className={`dc-lang ${dark ? 'dark' : ''} ${className}`} role="group" aria-label={t('lang.label')}>
            <i className="fa-solid fa-globe" aria-hidden="true" />
            {LANGUAGES.map((lng) => (
                <button key={lng} type="button" lang={lng === 'zh' ? 'zh-CN' : 'en'} aria-pressed={i18n.language === lng}
                    className={i18n.language === lng ? 'active' : ''} onClick={() => i18n.changeLanguage(lng)}>
                    {t(`lang.${lng}`)}
                </button>
            ))}
        </div>
    );
}

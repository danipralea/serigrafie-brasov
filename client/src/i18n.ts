import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import roTranslations from './i18n/locales/ro.json';
import enTranslations from './i18n/locales/en.json';

const resources = {
  ro: {
    translation: roTranslations
  },
  en: {
    translation: enTranslations
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ro',
    fallbackLng: 'ro',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

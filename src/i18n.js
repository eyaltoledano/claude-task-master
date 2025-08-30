import i18next from 'i18next';
import FsBackend from 'i18next-fs-backend';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const i18n = i18next.createInstance();

i18n
  .use(FsBackend)
  .init({
    // debug: true, // Uncomment to see debug logs
    initImmediate: false, // Important for backend usage
    fallbackLng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    backend: {
      loadPath: path.resolve(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },
  });

export default i18n;

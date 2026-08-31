// i18n for the public site chrome (W5.5, §17). Somali is the default locale;
// English and Arabic (RTL) are switchable. This covers the shared chrome — the
// header navigation, the footer, and the language switcher. Page-body content
// remains Somali (the default locale) until translated per surface.

export const LOCALES = ['so', 'en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'so';
export const RTL_LOCALES: readonly Locale[] = ['ar'];
export const LOCALE_LABELS: Record<Locale, string> = { so: 'SO', en: 'EN', ar: 'AR' };
export const LOCALE_NAMES: Record<Locale, string> = {
  so: 'Soomaali',
  en: 'English',
  ar: 'العربية',
};

// Chrome strings, keyed by a dotted path. Somali is the source of truth; the
// server renders Somali and the client swaps to the stored locale on load.
export const chrome: Record<Locale, Record<string, string>> = {
  so: {
    'nav.home': 'Guriga',
    'nav.services': 'Adeegyada',
    'nav.portfolio': 'Shaqooyinka',
    'nav.blog': 'Maqaallada',
    'nav.team': 'Kooxda',
    'nav.testimonials': 'Marag-furka',
    'nav.faq': 'Su’aalaha',
    'nav.careers': 'Fursado shaqo',
    'nav.contact': 'Nala soo xiriir',
    'cta.portal': 'Portal-ka',
    'footer.services': 'Adeegyada',
    'footer.company': 'Shirkadda',
    'footer.newsletter.title': 'Warsidaha iimaylka',
    'footer.newsletter.desc': 'Hel talooyin iyo warar cusub — geli iimaylkaaga.',
    'footer.newsletter.button': 'Diiwaangeli',
    'footer.rights': 'Dhammaan xuquuqdu way xifdisan tahay.',
    'lang.label': 'Luqadda',
  },
  en: {
    'nav.home': 'Home',
    'nav.services': 'Services',
    'nav.portfolio': 'Portfolio',
    'nav.blog': 'Blog',
    'nav.team': 'Team',
    'nav.testimonials': 'Testimonials',
    'nav.faq': 'FAQ',
    'nav.careers': 'Careers',
    'nav.contact': 'Contact',
    'cta.portal': 'Portal',
    'footer.services': 'Services',
    'footer.company': 'Company',
    'footer.newsletter.title': 'Email newsletter',
    'footer.newsletter.desc': 'Get tips and updates — enter your email.',
    'footer.newsletter.button': 'Subscribe',
    'footer.rights': 'All rights reserved.',
    'lang.label': 'Language',
  },
  ar: {
    'nav.home': 'الرئيسية',
    'nav.services': 'الخدمات',
    'nav.portfolio': 'الأعمال',
    'nav.blog': 'المدونة',
    'nav.team': 'الفريق',
    'nav.testimonials': 'آراء العملاء',
    'nav.faq': 'الأسئلة الشائعة',
    'nav.careers': 'الوظائف',
    'nav.contact': 'اتصل بنا',
    'cta.portal': 'البوابة',
    'footer.services': 'الخدمات',
    'footer.company': 'الشركة',
    'footer.newsletter.title': 'النشرة البريدية',
    'footer.newsletter.desc': 'احصل على النصائح والتحديثات — أدخل بريدك الإلكتروني.',
    'footer.newsletter.button': 'اشترك',
    'footer.rights': 'جميع الحقوق محفوظة.',
    'lang.label': 'اللغة',
  },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

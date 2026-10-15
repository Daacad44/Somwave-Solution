import type { PublicService } from '@somwave/shared';

// The original repository seed created these three example service records in
// Somali. Only translate them while their seed titles remain untouched in CMS.
const seedEnglish = {
  'horumarinta-websaydka': {
    original: 'Horumarinta Websaydka',
    originalSummary:
      'Website-yo dhaqso ah oo naqshadeysan, ku habboon mobil iyo kombuyuutar, oo Google si fiican u arko.',
    title: 'Website Design & Development',
    summary:
      'Responsive, thoughtfully designed websites that work across devices and are easy to discover.',
  },
  'nidaamyo-gudaha': {
    original: 'Nidaamyo Gudaha ah',
    originalSummary:
      'Nidaamyo maamul oo mashruuc, shaqaale, iyo maaliyad hal meel isugu keena — Excel iyo WhatsApp ka bax.',
    title: 'Software Development',
    summary: 'Custom business systems that bring projects, people, and workflows together.',
  },
  'barnaamijyo-mobil': {
    original: 'Barnaamijyo Mobil',
    originalSummary:
      'Apps iOS iyo Android ah oo isku xiran API-gaaga, adeeggaaga macaamiisha kuu fududeeya.',
    title: 'Mobile App Development',
    summary: 'Connected iOS and Android apps that make your services easier to use.',
  },
} as const;

export function displayService<T extends PublicService>(service: T): T {
  const translation = seedEnglish[service.slug as keyof typeof seedEnglish];
  if (
    !translation ||
    service.title !== translation.original ||
    service.summary !== translation.originalSummary
  )
    return service;
  return { ...service, title: translation.title, summary: translation.summary };
}

// Services requested for the public offer but not yet entered in the CMS.
export const additionalServices = [
  {
    title: 'Creative Design',
    summary: 'Brand, interface, and visual design shaped around your audience.',
    icon: 'software' as const,
  },
  {
    title: 'Domain & Hosting',
    summary: 'Guidance on domain registration and a dependable home for your website.',
    icon: 'web' as const,
  },
  {
    title: 'IT Consulting',
    summary: 'Practical technology planning for your next business decision.',
    icon: 'consult' as const,
  },
];

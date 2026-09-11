// Homepage teaser copy — matches the supplied Somwave website UI exactly.
// Listing pages remain API-driven; these cards only exist so the homepage
// can stay prerendered and visually identical to the reference.

export const trustedClients = [
  'Hormuud Telecom',
  'Somtel',
  'Dahabshiil',
  'Premier Bank',
  'Amal Bank',
] as const;

export const homeServices = [
  {
    title: 'Web Development',
    description: 'Website-yo dhaqso ah oo naqshad casri ah, ku habboon mobil iyo kombuyuutar.',
    href: '/adeegyada',
    icon: 'web' as const,
  },
  {
    title: 'Mobile App Development',
    description: 'Apps iOS iyo Android ah oo isku xiran API-gaaga iyo macaamiishaada.',
    href: '/adeegyada',
    icon: 'mobile' as const,
  },
  {
    title: 'Custom Software',
    description: 'Nidaamyo gaar ah oo ku habboon habka shaqada ee shirkaddaada.',
    href: '/adeegyada',
    icon: 'software' as const,
  },
  {
    title: 'IT Consulting',
    description: 'Talo iyo qorshe teknoolojiyadeed oo kuu horseeda go’aanno cad.',
    href: '/adeegyada',
    icon: 'consult' as const,
  },
] as const;

export const whyItems = [
  {
    title: 'Khibrad & Karti',
    description: 'Koox khibrad u leh dhisidda nidaamyo iyo website-yo lagu kalsoonaan karo.',
    icon: 'skill' as const,
  },
  {
    title: 'Xalal La Isku Halayn Karo',
    description: 'Nidaamyo ammaan ah, dhaqso ah, oo sii shaqeeya marka ganacsigaagu koro.',
    icon: 'trust' as const,
  },
  {
    title: 'Taageero Joogto ah',
    description: 'Ka dib bilawga, waan ku ilaalinaa, waan hagaajinnaa, waan horumarinnaa.',
    icon: 'support' as const,
  },
  {
    title: 'Qiimo Macquul ah',
    description: 'Xalal tayo sare leh oo ku habboon miisaaniyadda ganacsigaaga.',
    icon: 'value' as const,
  },
] as const;

export const processSteps = [
  {
    n: '01',
    title: 'Falanqayn',
    description: 'Waxaan si qoto dheer u barannaa baahidaada iyo yoolalkaaga.',
  },
  {
    n: '02',
    title: 'Naqshadeyn',
    description: 'Waxaan sameynaa naqshad cad oo aad aragto kahor intaan la dhisin.',
  },
  {
    n: '03',
    title: 'Horumarin',
    description: 'Waxaan ku dhisnaa teknoolojiyad casri ah oo la isku halayn karo.',
  },
  {
    n: '04',
    title: 'Daah-fur',
    description: 'Waxaan si nadiif ah u daah-furnaa, ka dibna waan ku taageernaa.',
  },
] as const;

export const homeProjects = [
  {
    title: 'E-Commerce Platform',
    category: 'Web Development',
    href: '/shaqooyinka',
    scene: 'shop' as const,
  },
  {
    title: 'School Management',
    category: 'Custom Software',
    href: '/shaqooyinka/nidaamka-maamulka-iskuulka',
    scene: 'school' as const,
  },
  {
    title: 'Travel Agency',
    category: 'Web & Mobile',
    href: '/shaqooyinka',
    scene: 'travel' as const,
  },
  {
    title: 'Real Estate Platform',
    category: 'Web Development',
    href: '/shaqooyinka',
    scene: 'estate' as const,
  },
] as const;

export const homeStats = [
  { value: '100+', label: 'Macaamiil ku kalsoon' },
  { value: '250+', label: 'Mashruuc oo la dhammeystiray' },
  { value: '5+', label: 'Sano oo khibrad ah' },
  { value: '99%', label: 'Kalsooni macaamil' },
] as const;

export const homeTestimonials = [
  {
    author: 'Faadumo Cabdi',
    role: 'Maamulaha Guud',
    company: 'Iskuul Gaar ah',
    quote:
      'Somwave waxay nagu dhistay nidaam maamul oo casri ah — hawshu waa fududaatay, khaladaadkuna way yaraadeen.',
    rating: 5,
  },
  {
    author: 'Axmed Nuur',
    role: 'Milkiile',
    company: 'Shirkad Dhaqaale',
    quote: 'App-ka ay noo sameeyeen macaamiisheena aad buu u helay — lacag-bixintu way fududaatay.',
    rating: 5,
  },
  {
    author: 'Hodan Maxamed',
    role: 'Agaasime IT',
    company: 'Shirkad Ganacsi',
    quote:
      'Waa koox xirfad leh. Waxay inaga caawiyeen inaan ka gudubno Excel una gudubno nidaam buuxa.',
    rating: 5,
  },
] as const;

export const homeArticles = [
  {
    title: 'Sida loo doorto shirkad website oo ku habboon',
    date: '2026-10-05',
    href: '/blog/sida-loo-doorto-shirkad-website',
    scene: 'logo' as const,
  },
  {
    title: 'Muhiimadda nidaamyada gudaha ee ganacsiga',
    date: '2026-09-12',
    href: '/blog/muhiimadda-nidaamyada-gudaha',
    scene: 'app' as const,
  },
  {
    title: 'Sida loo dhiso nidaam software oo sii kora',
    date: '2026-08-20',
    href: '/blog',
    scene: 'code' as const,
  },
] as const;

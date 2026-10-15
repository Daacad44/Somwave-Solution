import type { PublicFaq, PublicPostDetail, PublicPostSummary } from '@somwave/shared';

// Translate only unchanged demonstration content shipped in backend/prisma/seed.ts.
// CMS edits and customer-authored content pass through untouched.
const faqSeeds = [
  {
    question: 'Intee in le’eg ayay qaadataa in website la dhiso?',
    answer:
      'Waqtigu wuxuu ku xiran yahay baaxadda mashruuca — website fudud 2–4 toddobaad, nidaam buuxana wax ka badan.',
    enQuestion: 'How long does it take to build a website?',
    enAnswer:
      'The timeline depends on the project scope. We can provide an estimate after discussing your requirements.',
  },
  {
    question: 'Ma bixisaan taageero ka dib markii la dhammeeyo?',
    answer:
      'Haa, waxaan bixinaa taageero iyo dayactir joogto ah si mashruucaagu si fiican u shaqeeyo.',
    enQuestion: 'Do you provide support after launch?',
    enAnswer: 'Yes. We offer ongoing support and maintenance to keep your solution working well.',
  },
];

export function displayFaq<T extends PublicFaq>(faq: T): T {
  const seed = faqSeeds.find(
    (item) => item.question === faq.question && item.answer === faq.answer,
  );
  return seed ? { ...faq, question: seed.enQuestion, answer: seed.enAnswer } : faq;
}

const postSeeds = {
  'sida-loo-doorto-shirkad-website': {
    title: 'Sida loo doorto shirkad website oo ku habboon',
    excerpt: 'Afar shay oo aad fiirsato kahor intaadan dooran shirkad kuu dhista website.',
    body: 'Marka aad doorato shirkad website, fiiri khibradda, tayada naqshadda, taageerada kadib, iyo qiimaha cad. Shirkad wanaagsan waxay ku caawisaa inaad online si guul leh ugu koraan.',
    enTitle: 'How to Choose the Right Website Partner',
    enExcerpt: 'Four things to consider before choosing a company to build your website.',
    enBody:
      'When choosing a website partner, look at their experience, design quality, support after launch, and transparent pricing. A good partner helps your business grow online.',
  },
  'muhiimadda-nidaamyada-gudaha': {
    title: 'Muhiimadda nidaamyada gudaha ee ganacsiga',
    excerpt: 'Sababta ganacsigaagu uga baxo Excel iyo WhatsApp una gudbo nidaam buuxa.',
    body: 'Nidaamyada gudaha waxay hal meel isugu keenaan mashruucyada, shaqaalaha, iyo maaliyadda — taasoo yareysa khaladaadka oo kordhisa hufnaanta.',
    enTitle: 'Why Internal Systems Matter for Business',
    enExcerpt:
      'How a connected system can help your business move beyond spreadsheets and chat threads.',
    enBody:
      'Internal systems bring projects, staff, and finances together in one place. That can reduce errors and make everyday work more efficient.',
  },
} as const;

export function displayPostSummary<T extends PublicPostSummary>(post: T): T {
  const seed = postSeeds[post.slug as keyof typeof postSeeds];
  if (!seed || post.title !== seed.title || post.excerpt !== seed.excerpt) return post;
  return {
    ...post,
    title: seed.enTitle,
    excerpt: seed.enExcerpt,
    category:
      post.category?.slug === 'talooyin' && post.category.name === 'Talooyin'
        ? { ...post.category, name: 'Guides' }
        : post.category,
  };
}

export function displayPostDetail(post: PublicPostDetail): PublicPostDetail {
  const seed = postSeeds[post.slug as keyof typeof postSeeds];
  const displayed = displayPostSummary(post);
  return seed && displayed !== post && post.body === seed.body
    ? { ...displayed, body: seed.enBody }
    : displayed;
}

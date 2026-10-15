// Homepage teaser copy. Project examples and client logos use the existing assets.
// The articles section is not here: it reads published posts from the API.

export const trustedClients = [
  { id: 'hormuud', name: 'Hormuud Telecom', logo: '/clients/hormuud.png', width: 321, height: 135 },
  { id: 'somtel', name: 'Somtel', logo: '/clients/somtel.png', width: 270, height: 122 },
  {
    id: 'dahabshiil',
    name: 'Dahabshiil',
    logo: '/clients/dahabshiil.png',
    width: 271,
    height: 151,
  },
  { id: 'taaj', name: 'TAAJ', logo: '/clients/taaj.png', width: 259, height: 134 },
  {
    id: 'premier-bank',
    name: 'Premier Bank',
    logo: '/clients/premier-bank.png',
    width: 250,
    height: 158,
  },
  { id: 'amal-bank', name: 'Amal Bank', logo: '/clients/amal-bank.png', width: 256, height: 153 },
] as const;

export const homeServices = [
  {
    title: 'Web Development',
    description: 'Fast, thoughtfully designed websites that work across mobile and desktop.',
    href: '/adeegyada',
    icon: 'web' as const,
  },
  {
    title: 'Mobile App Development',
    description: 'iOS and Android apps that connect your services with your customers.',
    href: '/adeegyada',
    icon: 'mobile' as const,
  },
  {
    title: 'Custom Software',
    description: 'Software shaped around the way your team actually works.',
    href: '/adeegyada',
    icon: 'software' as const,
  },
  {
    title: 'IT Consulting',
    description: 'Clear technical advice and planning to help you make confident decisions.',
    href: '/adeegyada',
    icon: 'consult' as const,
  },
] as const;

export const whyItems = [
  {
    title: 'Experienced team',
    description: 'People who know how to build dependable websites and business systems.',
    icon: 'skill' as const,
  },
  {
    title: 'Reliable solutions',
    description: 'Secure, responsive systems designed to grow with your business.',
    icon: 'trust' as const,
  },
  {
    title: 'Ongoing support',
    description: 'We maintain, improve, and support your product after launch.',
    icon: 'support' as const,
  },
  {
    title: 'Practical value',
    description: 'Quality solutions planned around your goals and budget.',
    icon: 'value' as const,
  },
] as const;

export const processSteps = [
  {
    n: '01',
    title: 'Discover',
    description: 'We learn about your needs, your users, and your goals.',
  },
  {
    n: '02',
    title: 'Design',
    description: 'We shape and review a clear design before development begins.',
  },
  {
    n: '03',
    title: 'Build',
    description: 'We develop the solution with dependable technology.',
  },
  {
    n: '04',
    title: 'Launch',
    description: 'We launch carefully and stay alongside you afterwards.',
  },
] as const;

export const homeProjects = [
  {
    slug: 'e-commerce-platform',
    title: 'E-Commerce Platform',
    category: 'Web Development',
    description: 'An e-commerce platform for businesses that want to sell their products online.',
    image: '/works/ecommerce.png',
    imageWidth: 1536,
    imageHeight: 1024,
    highlights: ['Storefront', 'Products', 'Cart', 'Checkout', 'Admin dashboard'],
    features: [
      'Product catalogue and filtering',
      'Product details, variants, and stock',
      'Cart and order checkout',
      'Order management dashboard',
    ],
    technologies: ['Web', 'Dashboard', 'Mobile'],
  },
  {
    slug: 'school-management',
    title: 'School Management',
    category: 'Custom Software',
    description:
      'A school management system connecting students, teachers, attendance, exams, and payments.',
    image: '/works/school.png',
    imageWidth: 1536,
    imageHeight: 1024,
    highlights: ['Dashboard', 'Students', 'Teachers', 'Attendance', 'Timetable', 'Reports'],
    features: [
      'Student and teacher records',
      'Class attendance',
      'Exams and payments',
      'Weekly timetables and reports',
    ],
    technologies: ['Custom Software', 'Dashboard', 'Reports'],
  },
  {
    slug: 'travel-agency',
    title: 'Travel Agency',
    category: 'Web & Mobile',
    description:
      'A travel website and app bringing flights, hotels, and packages into one booking experience.',
    image: '/works/travel.png',
    imageWidth: 1536,
    imageHeight: 1024,
    highlights: ['Homepage', 'Flights', 'Hotels', 'Packages', 'Booking'],
    features: [
      'Flight and hotel search',
      'Destinations and travel packages',
      'Customer registration',
      'Booking dashboard',
    ],
    technologies: ['Web', 'Mobile', 'Booking'],
  },
  {
    slug: 'real-estate-platform',
    title: 'Real Estate Platform',
    category: 'Web Development',
    description:
      'A property marketplace with search, maps, agent profiles, and an owner dashboard.',
    image: '/works/estate.png',
    imageWidth: 1536,
    imageHeight: 1024,
    highlights: ['Search', 'Properties', 'Details', 'Map', 'Agents', 'Dashboard'],
    features: [
      'Property and category search',
      'Property details and agent contact',
      'Location map',
      'Owner dashboard and inquiries',
    ],
    technologies: ['Web', 'Map', 'Dashboard'],
  },
] as const;

export const homeStats = [
  { value: '100+', label: 'Clients served' },
  { value: '250+', label: 'Projects completed' },
  { value: '5+', label: 'Years of experience' },
  { value: '99%', label: 'Client satisfaction' },
] as const;

export const homeTestimonials = [
  {
    author: 'Faadumo Cabdi',
    role: 'Director',
    company: 'Private school',
    quote:
      'Somwave built a modern management system for us. Our work became easier and mistakes decreased.',
    rating: 5,
  },
  {
    author: 'Axmed Nuur',
    role: 'Owner',
    company: 'Financial services company',
    quote: 'Our customers welcomed the app they built for us, and payments became easier.',
    rating: 5,
  },
  {
    author: 'Hodan Maxamed',
    role: 'IT Director',
    company: 'Trading company',
    quote: 'A professional team. They helped us move from spreadsheets to a complete system.',
    rating: 5,
  },
] as const;

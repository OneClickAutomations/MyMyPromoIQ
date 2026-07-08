/**
 * copy.ts — Single source of truth for all landing page copy & content.
 *
 * Edit text here without touching layout code. Voice: direct-response
 * (Dan Kennedy school) — blunt, benefit-first, specific numbers, short
 * sentences, no corporate hedging. Avoid: "unlock", "elevate", "seamless",
 * "supercharge", "revolutionize", "game-changer".
 */

export const brand = {
  name: 'PromoIQ',
  // The dashboard mockup and demo are real UI built in React. When you move
  // past the landing page into the app shell, the live generation flow plugs
  // in here (see components/HowItWorks.tsx + components/Hero dashboard).
}

export const nav = {
  links: [
    { label: 'Product', href: '#product' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Login', href: '#login' },
  ],
  cta: 'Start Creating Free',
}

export const hero = {
  eyebrow: 'AI UGC · Zero Editing Skills Required',
  headline: ['Get scroll-stopping', 'video ads', 'before your coffee gets cold.'],
  // The middle fragment renders in the fire gradient.
  subhead:
    'No camera. No creators. No $5,000 agency. Describe the ad you want and walk away with finished UGC videos in minutes — not three weeks.',
  ctaPrimary: 'Start Generating Videos',
  ctaSecondary: 'Watch 60-second demo',
  trustline: 'No credit card. First 3 videos on us.',
  // Floating glass chips around the dashboard
  chips: {
    toast: '12 videos generated',
    rendering: 'Rendering ad #13…',
    metric: '+340% reply rate',
  },
}

export const socialProof = {
  // Avatar testimonials, not brand logos — UGC/creator-facing lands harder.
  intro: 'Operators shipping more creative with fewer people',
  people: [
    { name: 'Marcus', initials: 'MR', result: '+340% reply rate', tone: 'fire' },
    { name: 'Lena', initials: 'LK', result: '0 creators hired', tone: 'gold' },
    { name: 'Dev', initials: 'DP', result: '15 variants / day', tone: 'fire' },
    { name: 'Priya', initials: 'PS', result: '$4,200 saved / mo', tone: 'gold' },
    { name: 'Theo', initials: 'TM', result: '90-sec turnaround', tone: 'fire' },
    { name: 'Sofia', initials: 'SA', result: '6x ad tests / week', tone: 'gold' },
    { name: 'Jonah', initials: 'JW', result: '+2.1 ROAS', tone: 'fire' },
    { name: 'Amara', initials: 'AO', result: 'Cut agency entirely', tone: 'gold' },
  ],
}

export const problem = {
  eyebrow: 'The Old Way vs. The PromoIQ Way',
  title: 'Stop renting the bottleneck.',
  titleEmphasis: 'Own the pipeline instead.',
  subtitle: 'Same ad. Two timelines. One of them is bleeding you dry.',
  // Side-by-side comparison. Each row pairs a pain with the PromoIQ win,
  // and each side floats its own metric chip.
  oldLabel: 'The Agency Treadmill',
  newLabel: 'PromoIQ',
  rows: [
    {
      pain: 'Book a creator. Wait a week. Reshoot when it’s wrong.',
      painMetric: '3 weeks',
      painMetricLabel: 'per video',
      gain: 'Describe it. Walk away. Finished UGC in minutes.',
      gainMetric: '90 sec',
      gainMetricLabel: 'per video',
    },
    {
      pain: 'Pay the retainer before a single frame is shot.',
      painMetric: '$5,000',
      painMetricLabel: '/mo retainer',
      gain: 'Flat plan. No crew, no retainer, no surprises.',
      gainMetric: '$0',
      gainMetricLabel: 'crew cost',
    },
    {
      pain: 'Budget kills testing. You ship two angles and pray.',
      painMetric: '2 variants',
      painMetricLabel: 'all you can test',
      gain: 'Spin up a dozen variants and let winners surface.',
      gainMetric: '15+/day',
      gainMetricLabel: 'variants shipped',
    },
    {
      pain: 'Your competitor shipped ten this week. You shipped none.',
      painMetric: '0',
      painMetricLabel: 'ads live',
      gain: 'An AI director writes, casts, and renders on autopilot.',
      gainMetric: '+340%',
      gainMetricLabel: 'reply rate',
    },
  ],
}

export const videoSection = {
  caption: 'Watch a real product turn into a scroll-stopping ad in 90 seconds',
  subcaption: 'One upload in. A finished, on-brand UGC video out. No timeline, no plugins, no editor.',
  // Drop a real <video> src or embed here later.
  posterAlt: 'Product-to-ad demo preview',
}

export const howItWorks = {
  eyebrow: 'It Is Actually This Simple',
  title: 'You watched 10 tutorials on CLI setups and MCP connections.',
  titleEmphasis: 'Here it is one screen and four clicks.',
  steps: [
    {
      id: 'upload',
      kicker: 'Step 1',
      title: 'Drop in your product',
      blurb:
        'Upload a photo, a link, or a sentence about what you sell. That is the entire setup. No rig, no studio, no brief.',
      panelTitle: 'Upload',
      panelHint: 'product.jpg · 2.4 MB',
    },
    {
      id: 'style',
      kicker: 'Step 2',
      title: 'Pick a style',
      blurb:
        'Choose the vibe — unboxing, testimonial, day-in-the-life, fast-cut hook. We handle the casting, pacing, and look.',
      panelTitle: 'Pick a style',
      panelHint: 'Testimonial · Punchy · 9:16',
    },
    {
      id: 'direct',
      kicker: 'Step 3',
      title: 'AI directs & generates',
      blurb:
        'An AI director writes the script, blocks the scene, and renders the footage. You see the prompt logic if you want it. You can also ignore it completely.',
      panelTitle: 'AI directing…',
      panelHint: 'Writing hook · Casting scene · Rendering',
    },
    {
      id: 'publish',
      kicker: 'Step 4',
      title: 'Download or publish',
      blurb:
        'Grab the file or push straight to your ad account. Then generate ten more variants before lunch and let the data pick the winner.',
      panelTitle: 'Ready to ship',
      panelHint: 'ad_v13.mp4 · 1080×1920 · 0:18',
    },
  ],
}

export const generator = {
  eyebrow: 'Live · Real Generation',
  title: 'Stop reading. Generate one.',
  subtitle:
    'Drop in a product image URL, describe it, pick a style. Claude directs the shot and Google Veo 3 renders a real UGC video — right here, right now.',
  // Style ids must match the backend (netlify/lib/director.ts).
  styles: [
    { id: 'testimonial', label: 'Testimonial', hint: 'Person to camera, warm + handheld' },
    { id: 'unboxing', label: 'Unboxing', hint: 'Tactile reveal, crisp detail shots' },
    { id: 'day-in-life', label: 'Day-in-the-life', hint: 'Lifestyle b-roll, golden light' },
    { id: 'fast-cut', label: 'Fast-cut hook', hint: 'Kinetic, scroll-stopping opener' },
  ],
  qualities: [
    { id: 'lite', label: 'Lite', hint: 'Fastest' },
    { id: 'turbo', label: 'Turbo', hint: 'Balanced' },
    { id: 'standard', label: 'Standard', hint: 'Highest quality' },
  ],
  fields: {
    imageUrl: { label: 'Product image URL', placeholder: 'https://…/your-product.jpg' },
    description: {
      label: 'What is it?',
      placeholder: 'A matte ceramic pour-over coffee dripper for slow mornings.',
    },
  },
  cta: 'Generate My Video',
  ctaBusy: 'Directing & rendering…',
  // Status copy keyed to the render lifecycle.
  steps: ['Claude is directing the shot', 'Submitting to the render engine', 'Rendering your video'],
  note: 'First 3 videos are free. Rendering usually takes 1–3 minutes.',
}

export const ugcShowcase = {
  eyebrow: 'AI UGC Creator',
  // Last two fragments render in the fire gradient.
  headline: ['Authentic UGC.', 'Real Creators.', 'Any Niche.'],
  subhead:
    'Generate high-converting UGC campaigns featuring diverse creators, cinematic product shots, and scroll-stopping commercials in minutes. Every campaign is AI-generated, fully editable, and ready to publish.',
  ctaPrimary: 'Generate a UGC Campaign',
  ctaSecondary: 'See UGC examples',
  // Bottom caption strip under the showcase
  footnote: 'PromoIQ works with any product, any audience, any niche.',
  footnoteEmphasis: 'Real people. Real products. Real performance.',
  // Drives the shared <StudioMockup> — a second, completely different campaign
  // (athletic hydration brand, male creator) in the same premium UI.
  mockup: {
    statusBadge: '12 videos generated',
    renderPill: 'Rendering ad #7…',
    title: '“Hydrate Electrolytes — UGC hook”',
    percent: 68,
    masterChip: '4K · 9:16 master',
    previewAlt: 'AI-generated Hydrate Electrolytes UGC ad frame with a male creator',
    director: 'Writing hook · adding captions · enhancing natural light…',
    ctaCard: {
      label: 'CTA card',
      lines: ['Stay hydrated.', 'Perform better.'] as [string, string],
      button: 'Shop Hydrate',
    },
  },
}

export const testimonials = {
  eyebrow: 'Receipts',
  title: 'Operators, not influencers.',
  items: [
    {
      quote:
        'I stopped paying creators $400 a video and just generate 15 variants before lunch. My best-performing ad this quarter was made by typing one sentence.',
      name: 'Marcus R.',
      role: 'DTC founder · skincare',
      initials: 'MR',
      metric: '+340% reply rate',
    },
    {
      quote:
        'We killed a $5K monthly retainer. Same volume of creative, none of the back-and-forth. I brief it like I would brief a freelancer and it never misses a deadline.',
      name: 'Lena K.',
      role: 'Head of growth · fitness app',
      initials: 'LK',
      metric: '$4,200 saved / mo',
    },
    {
      quote:
        'I am not technical. I watched a dozen videos about MCP and prompt engineering and bounced off all of them. This is the first tool that just gave me the finished video.',
      name: 'Dev P.',
      role: 'Solo operator · supplements',
      initials: 'DP',
      metric: '15 variants / day',
    },
    {
      quote:
        'We went from two ad tests a month to six a week. The winners pay for the whole subscription in a day. The rest cost us nothing but a few minutes.',
      name: 'Sofia A.',
      role: 'Performance lead · agency',
      initials: 'SA',
      metric: '+2.1 ROAS',
    },
    {
      quote:
        'My old turnaround was three weeks per concept. Now I test the concept the same afternoon I think of it. That speed changed how we plan the whole quarter.',
      name: 'Theo M.',
      role: 'Marketing lead · home goods',
      initials: 'TM',
      metric: '90-sec turnaround',
    },
  ],
}

export const pricing = {
  eyebrow: 'Pricing',
  title: 'Pick a plan. Start generating.',
  subtitle: 'Cancel anytime. The first 3 videos are free — no card.',
  tiers: [
    {
      name: 'Starter',
      price: '$39',
      cadence: '/mo',
      tagline: 'Test the engine on your own products.',
      features: ['20 videos / month', '3 ad styles', '1080p export', 'Email support'],
      cta: 'Start Creating Free',
      featured: false,
    },
    {
      name: 'Operator',
      price: '$99',
      cadence: '/mo',
      tagline: 'For people shipping creative every single week.',
      features: [
        '120 videos / month',
        'Every ad style + custom hooks',
        '4K export + watermark removal',
        'Push to Meta & TikTok ad accounts',
        'Priority rendering',
      ],
      cta: 'Start Generating Videos',
      featured: true,
      badge: 'Most Popular',
    },
    {
      name: 'Studio',
      price: '$299',
      cadence: '/mo',
      tagline: 'Agencies running creative for a roster of brands.',
      features: [
        'Unlimited videos',
        'Brand kits & client workspaces',
        'API access',
        'Dedicated success manager',
      ],
      cta: 'Talk to Us',
      featured: false,
    },
  ],
}

export const finalCta = {
  // Kennedy-style close: name the loss, not a generic "get started".
  headline: ['Close this tab and nothing changes.', 'Your competitor still ships 10 ads this week.'],
  sub: 'You still book the creator. Still wait three weeks. Still test two variants and hope. Or you generate your first video in the next five minutes and find out what scales.',
  cta: 'Generate My First Video',
  reassurance: 'Free to start · No card · Cancel in two clicks',
}

export const adForge = {
  title: 'New Campaign',
  subtitle: 'Three paths, one world-class output. Pick the one that fits how you work today.',
  clone: {
    title: 'Clone a Winning Ad',
    subtitle: 'Find what\'s already working and make it yours.',
    detail: 'Search real running ads, see why they\'re winning, and let Claude rewrite the structure for your product — differentiated, never copied.',
    cta: 'Search ad library',
  },
  build: {
    title: 'Build From Scratch',
    subtitle: '12 guided steps. Full creative control.',
    detail: 'Walk through product, creator, brand, scenes, voiceover and more. Upload your product image — Veo 3 animates it into a video with native audio.',
    cta: 'Start building',
  },
  quick: {
    title: 'Quick Generate',
    subtitle: 'Fastest path from product to video.',
    detail: 'Five fields, one click. Upload your product photo and Claude writes the director brief — Veo 3 renders the video in minutes.',
    cta: 'Quick generate',
  },
  review: {
    title: 'Review & Adjust',
    fromClone: 'Pre-filled from ad analysis — every field is editable.',
    fromBuild: 'Fill in your product details and creative direction.',
    generateCta: 'Generate Video',
    filledLabel: 'from analysis',
  },
}

export const dashboard = {
  greeting: 'Welcome back',
  subgreeting: 'Pick up where you left off, or start something new.',
  actions: {
    start: 'Start',
    clone: { title: 'Clone a Winning Ad', subtitle: 'Find what works. Make it yours.' },
    build: { title: 'Build From Scratch', subtitle: 'Full creative control.' },
    quick: { title: 'Quick Generate', subtitle: 'Product in. Video out.' },
  },
  inProgress: 'In Progress',
  recent: 'Recent',
  continue: 'Continue',
  stats: {
    videos: 'Videos generated',
    analyzed: 'Ads analyzed',
    sourced: 'Products sourced',
    credits: 'Credits remaining',
  },
  emptyProjects: {
    heading: 'Nothing in progress',
    body: 'Start a new ad and it will show up here while it generates.',
    action: 'Create your first ad',
  },
  emptyRecent: {
    heading: 'No videos yet',
    body: 'Your finished commercials will collect here, ready to download and remix.',
    action: 'Create your first ad',
  },
}

export const footer = {
  tagline: 'UGC video ads on autopilot. You get the output. We hide the pipeline.',
  columns: [
    {
      title: 'Product',
      links: ['Features', 'How It Works', 'Pricing', 'Changelog'],
    },
    {
      title: 'Company',
      links: ['About', 'Blog', 'Careers', 'Contact'],
    },
    {
      title: 'Legal',
      links: ['Privacy', 'Terms', 'Cookies', 'DPA'],
    },
  ],
  socials: ['x', 'youtube', 'instagram', 'linkedin'],
  copyright: `© ${new Date().getFullYear()} PromoIQ. All rights reserved.`,
}

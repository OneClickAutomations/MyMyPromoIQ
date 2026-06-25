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
  eyebrow: 'The Old Way Is Bleeding You Dry',
  // Problem → Agitate → Solve
  blocks: [
    {
      kind: 'problem',
      text: 'Here is how a single ad used to happen. Book a creator. Wait a week. Ship them product. Wait again. Get the footage. It is wrong. Reshoot. Pay the agency retainer anyway. Three weeks gone for one video you are not even sure will convert.',
    },
    {
      kind: 'agitate',
      text: 'Meanwhile the cost is not the $400 you paid the creator. It is the ad spend you burned testing slow, stale creative. It is the winning angle you never found because you could only afford to test two. Your competitor shipped ten variants this week. You shipped none.',
    },
    {
      kind: 'solve',
      text: 'So stop renting the bottleneck. PromoIQ hands the whole pipeline to an AI director that writes the script, casts the scene, and renders finished UGC video while you do literally anything else. You get the output. We hide the wiring.',
    },
  ],
  // Visceral cost-of-inaction stat row
  costRow: [
    { stat: '3 weeks', label: 'gone per agency video' },
    { stat: '$5,000', label: 'retainer, before a single edit' },
    { stat: '2 variants', label: 'all most teams can afford to test' },
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
      links: ['Privacy', 'Terms', 'DPA', 'Security'],
    },
  ],
  socials: ['x', 'youtube', 'instagram', 'linkedin'],
  copyright: `© ${new Date().getFullYear()} PromoIQ. All rights reserved.`,
}

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ProductCard } from '@/components/product/ProductCard';
import type { ProductCard as Card } from '@/lib/catalog';
import { ClipReveal, Parallax, Reveal, SplitText, Stagger, StaggerItem } from '@/components/motion/Reveal';

export function Marquee({ items }: { items: string[] }) {
  const group = (hidden: boolean) => (
    <div className="flex shrink-0 items-center py-5 font-display text-5xl uppercase md:py-7 md:text-8xl" aria-hidden={hidden || undefined}>
      {items.map((t) => (
        <span key={t} className="flex items-center">
          <span className="whitespace-nowrap px-6 md:px-10">{t}</span>
          <Icon name="star" className="h-3 w-3 md:h-4 md:w-4" />
        </span>
      ))}
    </div>
  );
  return (
    <section className="overflow-hidden bg-accent text-ink" aria-label={items.join(', ')}>
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]" style={{ ['--marquee-speed' as string]: '35s' }}>
        {group(false)}{group(true)}
      </div>
    </section>
  );
}

export function ProductRow({ eyebrow, heading, products, href }: { eyebrow: string; heading: string; products: Card[]; href: string }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mb-8 flex items-end justify-between gap-6 md:mb-12">
          <div>
            <Reveal><p className="eyebrow mb-3 text-muted">{eyebrow}</p></Reveal>
            <SplitText text={heading} className="font-display text-display-md uppercase" />
          </div>
          <Link href={href} className="group hidden shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] sm:flex">
            <span className="link-underline">View all</span><Icon name="arrow-right" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
        <Stagger className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-4 lg:grid-cols-4">
          {products.map((p, i) => <StaggerItem key={p.id}><ProductCard product={p} priority={i < 2} /></StaggerItem>)}
        </Stagger>
        <div className="mt-10 text-center sm:hidden"><Link href={href} className="btn btn-outline">View all</Link></div>
      </div>
    </section>
  );
}

export function CategoryTiles({ categories }: { categories: { name: string; slug: string; image: string | null; count: number }[] }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mb-8 md:mb-12">
          <Reveal><p className="eyebrow mb-3 text-muted">Shop by category</p></Reveal>
          <SplitText text="Find your fit" className="font-display text-display-md uppercase" />
        </div>
        <Stagger className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          {categories.map((c) => (
            <StaggerItem key={c.slug}>
              <Link href={`/collections/${c.slug}`} className="group relative block overflow-hidden bg-bone text-paper" style={{ aspectRatio: '4 / 5' }}>
                <ClipReveal className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.image && <img src={c.image} alt="" decoding="async" className="h-full w-full object-cover transition-transform duration-[1.4s] ease-expo group-hover:scale-[1.06]" />}
                </ClipReveal>
                <span className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/0 to-transparent" />
                <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 sm:inset-x-5 sm:bottom-5">
                  <span>
                    <span className="eyebrow mb-2 hidden text-paper/70 sm:block">{c.count} {c.count === 1 ? 'product' : 'products'}</span>
                    <span className="block font-display text-xl uppercase leading-none sm:text-display-sm">{c.name}</span>
                  </span>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper text-ink transition-all duration-500 ease-expo group-hover:rotate-45 group-hover:bg-accent sm:h-12 sm:w-12">
                    <Icon name="arrow-up-right" className="h-4 w-4 sm:h-5 sm:w-5" />
                  </span>
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function Story({ image }: { image: string }) {
  return (
    <section className="overflow-hidden bg-ink text-paper">
      <div className="grid items-stretch md:grid-cols-2">
        <Parallax className="min-h-[70vw] bg-bone md:min-h-[80vh]" strength={0.12}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        </Parallax>
        <div className="flex items-center px-4 py-16 sm:px-6 md:px-12 lg:px-20">
          <div className="max-w-xl">
            <Reveal><p className="eyebrow mb-5 opacity-60">Our story</p></Reveal>
            <SplitText text={'Good enough\nnever was.'} className="font-display text-display-lg uppercase" />
            <Reveal><p className="mt-6 opacity-80">NEVER SETTLE makes the pieces you actually reach for: heavyweight T-shirts, pants that hold their shape, punjabis and kurtas for every occasion, and shoes and wallets built to last years, not seasons.</p></Reveal>
            <Reveal><Link href="/about" className="btn btn-accent mt-8">Read our story <Icon name="arrow-right" className="h-4 w-4" /></Link></Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Banner({ image }: { image: string }) {
  return (
    <section className="relative h-[80svh] min-h-[480px] overflow-hidden bg-ink text-paper">
      <Parallax className="absolute inset-0" strength={0.25}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
      </Parallax>
      <div className="absolute inset-0 bg-ink/35" />
      <div className="container relative flex h-full flex-col items-center justify-center text-center">
        <Reveal><p className="eyebrow mb-5">Punjabi season</p></Reveal>
        <SplitText text={'Dressed for\nthe occasion'} className="font-display text-display-xl uppercase" />
        <Reveal><Link href="/collections/punjabis" className="btn btn-light mt-10">Shop punjabis & kurtas <Icon name="arrow-right" className="h-4 w-4" /></Link></Reveal>
      </div>
    </section>
  );
}

const PROMISES = [
  { icon: 'truck', big: '1–2 days', title: 'Fast delivery', text: 'Inside Dhaka, 2–4 days nationwide', href: '/faq' },
  { icon: 'return', big: '7 days', title: 'Easy exchange', text: 'Unworn with tags, no questions asked', href: '/policies/returns' },
  { icon: 'shield', big: 'COD', title: 'Cash on delivery', text: 'Or pay online with cards, bKash or Nagad', href: '/faq' },
  { icon: 'bolt', big: '৳3,000+', title: 'Free delivery', text: 'On every order over ৳3,000', href: '/faq' },
] as const;

export function PromiseSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <Reveal><p className="eyebrow mb-4 inline-flex items-center gap-3 text-muted"><span className="inline-block h-2 w-2 rounded-full bg-accent" />Shop with confidence</p></Reveal>
            <SplitText text="The NEVER SETTLE promise" className="font-display text-display-md uppercase" />
          </div>
          <Reveal><p className="max-w-sm text-sm text-muted">Everything you need to know before you order, in four numbers.</p></Reveal>
        </div>
        <Stagger className="grid grid-cols-2 border-l border-t border-ink/10 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <StaggerItem key={p.title} className="border-b border-r border-ink/10">
              <Link href={p.href} className="group relative flex h-full flex-col gap-8 overflow-hidden p-5 sm:p-7 lg:p-8">
                <span className="absolute inset-0 origin-bottom scale-y-0 bg-accent transition-transform duration-700 ease-expo group-hover:scale-y-100" aria-hidden="true" />
                <span className="relative flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-full border border-ink/20 transition-all duration-500 ease-expo group-hover:-rotate-12 group-hover:border-ink group-hover:bg-ink group-hover:text-accent">
                    <Icon name={p.icon} />
                  </span>
                  <Icon name="arrow-up-right" className="h-5 w-5 opacity-40 transition-all duration-500 group-hover:rotate-45 group-hover:opacity-100" />
                </span>
                <span className="relative mt-auto block">
                  <span className="block font-display text-[clamp(1.6rem,7.5vw,2.25rem)] uppercase leading-none tabular-nums sm:text-5xl lg:text-6xl">{p.big}</span>
                  <span className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] sm:text-sm">{p.title}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted transition-colors duration-500 group-hover:text-ink/70">{p.text}</span>
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

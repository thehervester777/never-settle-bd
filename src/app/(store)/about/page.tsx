import type { Metadata } from 'next';
import Link from 'next/link';
import { Parallax, Reveal, SplitText } from '@/components/motion/Reveal';
import { PromiseSection } from '@/components/home/Sections';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = { title: 'About us', description: 'NEVER SETTLE designs T-shirts, pants, punjabis and kurtas in Dhaka, and finishes the look with shoes and wallets.' };

export default function AboutPage() {
  return (
    <>
      <section className="container max-w-5xl py-20 text-center md:py-32">
        <p className="eyebrow mb-6 text-muted">Our story</p>
        <SplitText as="h1" text="Built for people who keep raising the bar" className="font-display text-display-md uppercase" onMount />
        <Reveal><p className="mx-auto mt-6 max-w-2xl text-base text-muted md:text-lg">NEVER SETTLE started with a simple idea: everyday clothes should be made as carefully as occasion wear. We design T-shirts, pants, punjabis and kurtas in Dhaka, and finish the look with shoes and wallets that last years, not seasons.</p></Reveal>
      </section>
      <section className="overflow-hidden bg-ink text-paper">
        <div className="grid md:grid-cols-2">
          <Parallax className="min-h-[70vw] md:min-h-[80vh]" strength={0.12}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/story.jpg" alt="" className="h-full w-full object-cover" />
          </Parallax>
          <div className="flex items-center px-4 py-16 sm:px-6 md:px-12 lg:px-20">
            <div className="max-w-xl">
              <Reveal><p className="eyebrow mb-5 opacity-60">The craft</p></Reveal>
              <SplitText text={'Made to\nbe worn hard'} className="font-display text-display-lg uppercase" />
              <Reveal><p className="mt-6 opacity-80">We choose fabrics by weight and feel, test every pattern on real bodies, and quality check each piece before it ships.</p></Reveal>
              <Reveal><Link href="/collections/new-in" className="btn btn-accent mt-8">Shop new arrivals <Icon name="arrow-right" className="h-4 w-4" /></Link></Reveal>
            </div>
          </div>
        </div>
      </section>
      <PromiseSection />
    </>
  );
}

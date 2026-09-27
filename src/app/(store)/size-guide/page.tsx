import type { Metadata } from 'next';
import { SplitText } from '@/components/motion/Reveal';
import { SizeTabs } from '@/components/ui/SizeTabs';

export const metadata: Metadata = { title: 'Size guide', description: 'Size charts for NEVER SETTLE T-shirts, punjabis, kurtas, pants and shoes.' };

const CHARTS = [
  { title: 'T-shirts', head: ['Size', 'Chest', 'Length', 'Shoulder'], rows: [['S', '38', '27', '17'], ['M', '40', '28', '18'], ['L', '42', '29', '19'], ['XL', '44', '30', '20'], ['XXL', '46', '31', '21']], note: 'Oversized styles are cut 4 inches wider through the chest.' },
  { title: 'Punjabis & Kurtas', head: ['Size', 'Chest', 'Punjabi length', 'Kurta length', 'Sleeve'], rows: [['S', '38', '40', '32', '23'], ['M', '40', '41', '33', '24'], ['L', '42', '42', '34', '24.5'], ['XL', '44', '43', '35', '25'], ['XXL', '46', '44', '36', '25.5']], note: 'Punjabi length is measured from shoulder to hem.' },
  { title: 'Pants', head: ['Waist size', 'Waist (in)', 'Hip (in)', 'Inseam (in)'], rows: [['28', '28–29', '36', '30'], ['30', '30–31', '38', '30'], ['32', '32–33', '40', '31'], ['34', '34–35', '42', '31'], ['36', '36–37', '44', '32']], note: '' },
  { title: 'Shoes', head: ['EU', 'UK', 'US', 'Foot length (cm)'], rows: [['39', '6', '7', '24.5'], ['40', '6.5', '7.5', '25'], ['41', '7.5', '8.5', '26'], ['42', '8', '9', '26.5'], ['43', '9', '10', '27.5'], ['44', '9.5', '10.5', '28']], note: 'Measure your foot in the evening, heel to longest toe. Between sizes? Go up one.' },
];

export default function SizeGuidePage() {
  return (
    <section className="container pb-20 pt-10 md:pb-28 md:pt-16">
      <p className="eyebrow mb-4 text-muted">Find your fit</p>
      <SplitText as="h1" text="Size guide" className="font-display text-display-lg uppercase" onMount />
      <p className="mt-6 max-w-2xl text-muted">All measurements are in inches unless noted. Between sizes? Size up for a relaxed fit.</p>
      <SizeTabs charts={CHARTS} />
    </section>
  );
}

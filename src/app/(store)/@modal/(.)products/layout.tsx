import { ProductOverlay } from '@/components/product/ProductOverlay';

/** The sheet stays open while the shopper moves between products inside it. */
export default function ProductOverlayLayout({ children }: { children: React.ReactNode }) {
  return <ProductOverlay>{children}</ProductOverlay>;
}

import Link from 'next/link';
import { getCategories } from '@/lib/catalog';
import { ProductEditor } from '@/components/admin/ProductEditor';

export const metadata = { title: 'Add product' };

export default async function NewProduct() {
  const categories = await getCategories();
  return (
    <div className="space-y-6">
      <Link href="/admin/products" className="text-sm underline">← Products</Link>
      <h1 className="font-display text-4xl uppercase">Add product</h1>
      <ProductEditor
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{ id: null, title: '', slug: '', categoryId: '', price: '', compareAt: '', description: '', details: '', tags: 'new', isActive: true, isFeatured: false, images: [], variants: [{ color: '', size: '', sku: '', stock: 0 }] }}
      />
    </div>
  );
}

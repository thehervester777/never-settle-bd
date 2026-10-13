import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getCategories } from '@/lib/catalog';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { PageHeader } from '@/components/admin/ui';

export const metadata = { title: 'Add product' };

export default async function NewProduct() {
  const admin = await requirePermission('products');
  const categories = await getCategories();
  return (
    <div>
      <PageHeader back={{ href: '/admin/products', label: 'Products' }} title="Add product" description="Name, photos, price, then sizes with their stock." />
      <ProductEditor
        canCost={can(admin.role, 'costs')}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{ id: null, title: '', slug: '', categoryId: '', price: '', compareAt: '', description: '', details: '', tags: 'new', isActive: true, isFeatured: false, images: [], variants: [{ color: '', size: '', sku: '', stock: 0, cost: '' }] }}
      />
    </div>
  );
}

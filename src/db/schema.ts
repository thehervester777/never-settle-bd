import {
  mysqlTable, int, varchar, text, boolean, datetime, mysqlEnum, uniqueIndex, index,
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';

/* All money columns are integers in poisha (1 taka = 100 poisha). */

const createdAt = () => datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`);

export const categories = mysqlTable('categories', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 140 }).notNull(),
  description: text('description'),
  image: varchar('image', { length: 500 }),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('categories_slug_uq').on(t.slug)]);

export const products = mysqlTable('products', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 220 }).notNull(),
  description: text('description').notNull(),
  details: text('details'),
  categoryId: int('category_id').notNull(),
  price: int('price').notNull(),
  compareAt: int('compare_at'),
  tags: varchar('tags', { length: 300 }).notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex('products_slug_uq').on(t.slug),
  index('products_category_idx').on(t.categoryId),
  index('products_active_created_idx').on(t.isActive, t.createdAt),
]);

export const productImages = mysqlTable('product_images', {
  id: int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  alt: varchar('alt', { length: 200 }).notNull().default(''),
  sortOrder: int('sort_order').notNull().default(0),
}, (t) => [index('product_images_product_idx').on(t.productId)]);

export const variants = mysqlTable('variants', {
  id: int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull(),
  color: varchar('color', { length: 60 }),
  size: varchar('size', { length: 30 }),
  sku: varchar('sku', { length: 80 }),
  stock: int('stock').notNull().default(0),
}, (t) => [index('variants_product_idx').on(t.productId)]);

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'] as const;
export const PAYMENT_METHODS = ['COD', 'SSLCOMMERZ'] as const;
export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'] as const;

export const orders = mysqlTable('orders', {
  id: int('id').autoincrement().primaryKey(),
  number: varchar('number', { length: 20 }).notNull(),
  status: mysqlEnum('status', ORDER_STATUSES).notNull().default('PENDING'),
  paymentMethod: mysqlEnum('payment_method', PAYMENT_METHODS).notNull(),
  paymentStatus: mysqlEnum('payment_status', PAYMENT_STATUSES).notNull().default('UNPAID'),
  customerName: varchar('customer_name', { length: 120 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 160 }),
  address: text('address').notNull(),
  city: varchar('city', { length: 80 }).notNull(),
  area: varchar('area', { length: 80 }),
  zone: varchar('zone', { length: 20 }).notNull(),
  note: text('note'),
  subtotal: int('subtotal').notNull(),
  shippingFee: int('shipping_fee').notNull(),
  total: int('total').notNull(),
  stockReleased: boolean('stock_released').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex('orders_number_uq').on(t.number),
  index('orders_phone_idx').on(t.phone),
  index('orders_status_created_idx').on(t.status, t.createdAt),
]);

export const orderItems = mysqlTable('order_items', {
  id: int('id').autoincrement().primaryKey(),
  orderId: int('order_id').notNull(),
  productId: int('product_id'),
  variantId: int('variant_id'),
  title: varchar('title', { length: 200 }).notNull(),
  options: varchar('options', { length: 120 }).notNull().default(''),
  image: varchar('image', { length: 500 }),
  unitPrice: int('unit_price').notNull(),
  quantity: int('quantity').notNull(),
}, (t) => [index('order_items_order_idx').on(t.orderId)]);

export const payments = mysqlTable('payments', {
  id: int('id').autoincrement().primaryKey(),
  orderId: int('order_id').notNull(),
  provider: varchar('provider', { length: 30 }).notNull(),
  tranId: varchar('tran_id', { length: 60 }).notNull(),
  valId: varchar('val_id', { length: 80 }),
  amount: int('amount').notNull(),
  currency: varchar('currency', { length: 8 }).notNull().default('BDT'),
  status: varchar('status', { length: 20 }).notNull(), // INITIATED | VALID | FAILED | CANCELLED
  cardType: varchar('card_type', { length: 60 }),
  bankTranId: varchar('bank_tran_id', { length: 80 }),
  raw: text('raw'),
  createdAt: createdAt(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => new Date()),
}, (t) => [uniqueIndex('payments_tran_uq').on(t.tranId), index('payments_order_idx').on(t.orderId)]);

export const messages = mysqlTable('messages', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 160 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  orderNo: varchar('order_no', { length: 20 }),
  body: text('body').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: createdAt(),
});

export const subscribers = mysqlTable('subscribers', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 160 }).notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('subscribers_email_uq').on(t.email)]);

export const admins = mysqlTable('admins', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 160 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  passwordHash: varchar('password_hash', { length: 100 }).notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('admins_email_uq').on(t.email)]);

export const settings = mysqlTable('settings', {
  key: varchar('key', { length: 60 }).primaryKey(),
  value: text('value').notNull(),
});

/* Relations (for db.query.* helpers) */
export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  variants: many(variants),
}));
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
}));
export const ordersRelations = relations(orders, ({ many }) => ({ items: many(orderItems), payments: many(payments) }));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export type Order = typeof orders.$inferSelect;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

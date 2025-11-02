import { z } from 'zod';

const orderItemSchema = z
  .object({
    menuItem: z.string().optional(),
    itemId: z.string().optional(),
    name: z.string().trim().min(1).optional(),
    quantity: z.coerce.number().int().positive().default(1)
  })
  .refine(
    (value) => value.menuItem || value.itemId || value.name,
    { message: 'menuItem or name is required' }
  );

export const createOrderSchema = z.object({
  tableNumber: z.union([z.string().trim().min(1), z.number()]),
  status: z.enum(['ordered', 'preparing', 'served']).optional(),
  source: z.enum(['staff', 'table', 'kiosk', 'other']).optional(),
  items: z.array(orderItemSchema).min(1)
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['ordered', 'preparing', 'served'])
});

const baseMenuSchema = z.object({
  name: z.string().trim().min(1),
  price: z.coerce.number().positive(),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().url().optional(),
  category: z.string().trim().optional(),
  tags: z.array(z.string().trim()).optional().default([]),
  isAvailable: z.boolean().optional().default(true)
});

export const createMenuItemSchema = baseMenuSchema;
export const updateMenuItemSchema = baseMenuSchema.partial();

export const createReviewSchema = z.object({
  menuItemId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
  orderId: z.string().trim().optional()
});

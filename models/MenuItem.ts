import mongoose, { Schema, Model, InferSchemaType } from 'mongoose';

/**
 * MenuItem
 * - Represents a single dish in the restaurant menu.
 * - Keep fields lean; computed popularity comes from Orders aggregation.
 */
const MenuItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: '' },
    category: { type: String, default: '' }, // e.g., 'Starters', 'Mains', 'Desserts'
    tags: { type: [String], default: [] },   // e.g., ['veg', 'spicy']
    isAvailable: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Helpful indexes for searching/filtering in future
MenuItemSchema.index({ name: 1 });
MenuItemSchema.index({ category: 1, isAvailable: 1 });

export type MenuItemDoc = InferSchemaType<typeof MenuItemSchema>;

const MenuItem: Model<MenuItemDoc> =
  (mongoose.models.MenuItem as Model<MenuItemDoc>) ||
  mongoose.model<MenuItemDoc>('MenuItem', MenuItemSchema);

export default MenuItem;

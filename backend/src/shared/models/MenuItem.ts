import mongoose, { Schema, Model, InferSchemaType } from 'mongoose';

const MenuItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: '' },
    category: { type: String, default: '' },
    tags: { type: [String], default: [] },
    isAvailable: { type: Boolean, default: true },
    stock: { type: Number, min: 0, default: null },
    lowStockThreshold: { type: Number, min: 0, default: null }
  },
  { timestamps: true }
);

MenuItemSchema.index({ name: 1 });
MenuItemSchema.index({ category: 1, isAvailable: 1 });

export type MenuItemDoc = InferSchemaType<typeof MenuItemSchema>;

const MenuItem: Model<MenuItemDoc> =
  (mongoose.models.MenuItem as Model<MenuItemDoc>) ||
  mongoose.model<MenuItemDoc>('MenuItem', MenuItemSchema);

export default MenuItem;


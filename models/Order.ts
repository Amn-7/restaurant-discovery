import mongoose, { Schema, Model, InferSchemaType } from 'mongoose';

/**
 * Order
 * - One order per submission from a table.
 * - Items are denormalized with name/image to power the live feed quickly.
 */

const OrderItemSchema = new Schema(
  {
    menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: '' },
    quantity: { type: Number, default: 1, min: 1 }
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    tableNumber: { type: String, required: true, trim: true },
    items: { type: [OrderItemSchema], default: [] },
    source: {
      type: String,
      enum: ['staff', 'table', 'kiosk', 'other'],
      default: 'staff'
    },
    status: {
      type: String,
      enum: ['ordered', 'preparing', 'served'],
      default: 'ordered',
      index: true
    },
    servedAt: { type: Date }
  },
  { timestamps: true }
);

// Useful indexes for querying recent/active orders
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof OrderSchema>;

const Order: Model<OrderDoc> =
  (mongoose.models.Order as Model<OrderDoc>) ||
  mongoose.model<OrderDoc>('Order', OrderSchema);

export default Order;

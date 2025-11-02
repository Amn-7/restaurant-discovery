import mongoose, { Schema, Model, InferSchemaType } from 'mongoose';

/**
 * Review
 * - A quick 1–5 rating with an optional short comment.
 * - Linked to a MenuItem, optionally to an Order.
 */
const ReviewSchema = new Schema(
  {
    menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true, index: true },
    order:    { type: Schema.Types.ObjectId, ref: 'Order' },
    rating:   { type: Number, required: true, min: 1, max: 5 },
    comment:  { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

// Helpful compound index for per-item recency queries
ReviewSchema.index({ menuItem: 1, createdAt: -1 });

export type ReviewDoc = InferSchemaType<typeof ReviewSchema>;

const Review: Model<ReviewDoc> =
  (mongoose.models.Review as Model<ReviewDoc>) ||
  mongoose.model<ReviewDoc>('Review', ReviewSchema);

export default Review;

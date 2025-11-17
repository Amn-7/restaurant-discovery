import mongoose, { Schema, Model, InferSchemaType } from 'mongoose';

const ReviewSchema = new Schema(
  {
    menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

ReviewSchema.index({ menuItem: 1, createdAt: -1 });

export type ReviewDoc = InferSchemaType<typeof ReviewSchema>;

const Review: Model<ReviewDoc> =
  (mongoose.models.Review as Model<ReviewDoc>) ||
  mongoose.model<ReviewDoc>('Review', ReviewSchema);

export default Review;


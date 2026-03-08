import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    images: [String],
    videos: [String],
    isVerified: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
}, { timestamps: true })

export const ReviewModel = mongoose.model("Review", reviewSchema);

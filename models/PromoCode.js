import mongoose from 'mongoose';

const promoCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productTitle: { type: String, required: true },
    organization: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    canReview: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('PromoCode', promoCodeSchema);

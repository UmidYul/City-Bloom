import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    organization: { type: String, default: '' },
    validDays: { type: Number, default: 30 },
    quantity: { type: Number, default: 0 },
    category: { type: String, default: 'other' },
    icon: { type: String }
}, { timestamps: true });

export default mongoose.model('Product', productSchema);

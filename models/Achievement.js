import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    icon: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    condition: {
        type: { type: String, enum: ['plantings', 'trust', 'spent', 'plant-types'], required: true },
        value: { type: Number, required: true }
    },
    points: { type: Number, default: 0 }
});

export default mongoose.model('Achievement', achievementSchema);

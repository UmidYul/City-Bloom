import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    city: { type: String, default: 'Unknown' },
    points: { type: Number, default: 0 },
    trustRating: { type: Number, default: 5, min: 0, max: 10 },
    declinedCount: { type: Number, default: 0 },
    lastTrustRecovery: { type: Date, default: Date.now },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActivityDate: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('User', userSchema);

import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    plantType: { type: String, default: 'Tree' },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },
    description: { type: String, default: '' },
    beforeVideo: { type: String },
    afterVideo: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
    adminComment: { type: String, default: null },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pointsAwarded: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Submission', submissionSchema);

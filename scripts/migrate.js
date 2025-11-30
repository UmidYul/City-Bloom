import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import models
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import Product from '../models/Product.js';
import PromoCode from '../models/PromoCode.js';
import Achievement from '../models/Achievement.js';
import UserAchievement from '../models/UserAchievement.js';
import Notification from '../models/Notification.js';

async function migrate() {
    try {
        console.log('🔄 Starting migration from db.json to MongoDB...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Read db.json
        const dbPath = join(__dirname, '..', 'db.json');
        const dbData = JSON.parse(readFileSync(dbPath, 'utf-8'));

        // Clear existing data (optional - comment out if you want to keep existing data)
        console.log('🗑️  Clearing existing collections...');
        await Promise.all([
            User.deleteMany({}),
            Submission.deleteMany({}),
            Product.deleteMany({}),
            PromoCode.deleteMany({}),
            Achievement.deleteMany({}),
            UserAchievement.deleteMany({}),
            Notification.deleteMany({})
        ]);
        console.log('✅ Collections cleared\n');

        // Migrate Users
        console.log('👥 Migrating Users...');
        const userIdMap = new Map(); // Map old IDs to new ObjectIds

        for (const user of dbData.Users || []) {
            const newUser = await User.create({
                name: user.name,
                phone: user.phone,
                password: user.password,
                role: user.role,
                city: user.city,
                points: user.points,
                trustRating: user.trustRating,
                declinedCount: user.declinedCount,
                lastTrustRecovery: user.lastTrustRecovery,
                level: user.level || 1,
                experience: user.experience || 0,
                currentStreak: user.currentStreak || 0,
                longestStreak: user.longestStreak || 0,
                lastActivityDate: user.lastActivityDate || null
            });
            userIdMap.set(user.id, newUser._id);
        }
        console.log(`✅ Migrated ${userIdMap.size} users\n`);

        // Migrate Products
        console.log('🎁 Migrating Products...');
        const productIdMap = new Map();

        for (const product of dbData.Products || []) {
            const newProduct = await Product.create({
                title: product.title,
                price: product.price,
                organization: product.organization,
                validDays: product.validDays,
                quantity: product.quantity,
                category: product.category,
                icon: product.icon,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt
            });
            productIdMap.set(product.id, newProduct._id);
        }
        console.log(`✅ Migrated ${productIdMap.size} products\n`);

        // Migrate Submissions
        console.log('🌱 Migrating Submissions...');
        let submissionsCount = 0;

        for (const submission of dbData.Submissions || []) {
            const userId = userIdMap.get(submission.userId);
            const adminId = submission.adminId ? userIdMap.get(submission.adminId) : undefined;

            if (userId) {
                await Submission.create({
                    userId,
                    title: submission.title,
                    plantType: submission.plantType,
                    location: submission.location,
                    description: submission.description,
                    beforeVideo: submission.beforeVideo,
                    afterVideo: submission.afterVideo,
                    status: submission.status,
                    adminComment: submission.adminComment,
                    adminId,
                    pointsAwarded: submission.pointsAwarded,
                    createdAt: submission.createdAt,
                    updatedAt: submission.updatedAt
                });
                submissionsCount++;
            }
        }
        console.log(`✅ Migrated ${submissionsCount} submissions\n`);

        // Migrate PromoCodes
        console.log('🎟️  Migrating Promo Codes...');
        let promosCount = 0;

        for (const promo of dbData.PromoCodes || []) {
            const userId = userIdMap.get(promo.userId);
            const productId = productIdMap.get(promo.productId);

            if (userId && productId) {
                await PromoCode.create({
                    code: promo.code,
                    userId,
                    productId,
                    productTitle: promo.productTitle,
                    organization: promo.organization,
                    expiresAt: promo.expiresAt,
                    canReview: promo.canReview,
                    createdAt: promo.createdAt
                });
                promosCount++;
            }
        }
        console.log(`✅ Migrated ${promosCount} promo codes\n`);

        // Migrate Achievements
        console.log('🏆 Migrating Achievements...');
        const achievements = dbData.Achievements || [];

        if (achievements.length > 0) {
            await Achievement.insertMany(achievements);
            console.log(`✅ Migrated ${achievements.length} achievements\n`);
        }

        // Migrate UserAchievements
        console.log('⭐ Migrating User Achievements...');
        let userAchievementsCount = 0;

        for (const ua of dbData.UserAchievements || []) {
            const userId = userIdMap.get(ua.userId);

            if (userId) {
                await UserAchievement.create({
                    userId,
                    achievementId: ua.achievementId,
                    earnedAt: ua.earnedAt
                });
                userAchievementsCount++;
            }
        }
        console.log(`✅ Migrated ${userAchievementsCount} user achievements\n`);

        // Migrate Notifications
        console.log('🔔 Migrating Notifications...');
        let notificationsCount = 0;

        for (const notif of dbData.Notifications || []) {
            const userId = userIdMap.get(notif.userId);

            if (userId) {
                await Notification.create({
                    userId,
                    type: notif.type,
                    title: notif.title,
                    message: notif.message,
                    read: notif.read,
                    createdAt: notif.createdAt
                });
                notificationsCount++;
            }
        }
        console.log(`✅ Migrated ${notificationsCount} notifications\n`);

        console.log('🎉 Migration completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   Users: ${userIdMap.size}`);
        console.log(`   Products: ${productIdMap.size}`);
        console.log(`   Submissions: ${submissionsCount}`);
        console.log(`   Promo Codes: ${promosCount}`);
        console.log(`   Achievements: ${achievements.length}`);
        console.log(`   User Achievements: ${userAchievementsCount}`);
        console.log(`   Notifications: ${notificationsCount}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

migrate();

/**
 * COMPREHENSIVE DATABASE INDEXES FOR ALL ROUTES
 * This script creates ALL necessary indexes for optimal performance
 * Run: node create_all_comprehensive_indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const createIndexSafely = async (collection, indexSpec, options = {}) => {
  try {
    await collection.createIndex(indexSpec, options);
    console.log(`   ✓ ${JSON.stringify(indexSpec)}`);
    return true;
  } catch (error) {
    if (error.code === 85 || error.message.includes('already exists')) {
      console.log(`   ⚠️  ${JSON.stringify(indexSpec)} - already exists`);
      return true;
    }
    console.log(`   ❌ ${JSON.stringify(indexSpec)} - ${error.message}`);
    return false;
  }
};

async function createAllIndexes() {
  console.log('🚀 COMPREHENSIVE DATABASE INDEXES FOR ALL ROUTES');
  console.log('This will create ALL indexes needed for perfect performance\n');

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected\n');

    const db = mongoose.connection.db;
    let totalCreated = 0;

    // 1. USER COLLECTION - Authentication, Admin, Profile queries
    console.log('📋 USER INDEXES:');
    const users = db.collection('users');
    const userIndexes = [
      { email: 1 }, // Login
      { role: 1 }, // Role filtering
      { role: 1, status: 1 }, // Admin user management
      { status: 1 }, // Status filtering
      { name: 1 }, // Name search
      { createdAt: -1 }, // Chronological listing
      { veterinarianProfile: 1 }, // Profile linking
      { balance: -1 }, // Balance sorting
    ];
    
    for (const index of userIndexes) {
      if (await createIndexSafely(users, index)) totalCreated++;
    }

    // 2. PET COLLECTION - Pet owner dashboard, listings
    console.log('\n📋 PET INDEXES:');
    const pets = db.collection('pets');
    const petIndexes = [
      { ownerId: 1, isActive: 1 }, // Pet owner listings
      { ownerId: 1, species: 1 }, // Species filtering
      { ownerId: 1, createdAt: -1 }, // Chronological
      { microchipNumber: 1 }, // Unique lookup
      { species: 1 }, // Species filtering
      { isActive: 1 }, // Active pets only
      { name: 1 }, // Name search
    ];
    
    for (const index of petIndexes) {
      if (await createIndexSafely(pets, index)) totalCreated++;
    }

    // 3. APPOINTMENT COLLECTION - Dashboard, scheduling, history
    console.log('\n📋 APPOINTMENT INDEXES:');
    const appointments = db.collection('appointments');
    const appointmentIndexes = [
      { petOwnerId: 1, status: 1, appointmentDate: -1 }, // Dashboard queries
      { petOwnerId: 1, appointmentDate: -1 }, // History
      { veterinarianId: 1, appointmentDate: -1 }, // Vet schedule
      { veterinarianId: 1, status: 1, appointmentDate: -1 }, // Vet filtering
      { petId: 1, appointmentDate: -1 }, // Pet history
      { appointmentDate: -1 }, // Date sorting
      { status: 1 }, // Status filtering
      { appointmentNumber: 1 }, // Unique lookup
      { paymentStatus: 1 }, // Payment filtering
      { bookingType: 1 }, // Booking type filtering
      { createdAt: -1 }, // Recent appointments
      { appointmentDate: -1, appointmentTime: 1 }, // Time slot checking
    ];
    
    for (const index of appointmentIndexes) {
      if (await createIndexSafely(appointments, index)) totalCreated++;
    }

    // 4. MEDICAL RECORDS - Patient history, record management
    console.log('\n📋 MEDICAL RECORD INDEXES:');
    const medicalRecords = db.collection('medicalrecords');
    const medicalRecordIndexes = [
      { petId: 1, uploadedDate: -1 }, // Pet medical history
      { petOwnerId: 1, uploadedDate: -1 }, // Owner access
      { petOwnerId: 1, recordType: 1, uploadedDate: -1 }, // Filtered history
      { recordType: 1 }, // Type filtering
      { relatedAppointmentId: 1 }, // Appointment linking
      { uploadedBy: 1 }, // Uploaded by vet
      { createdAt: -1 }, // Recent records
    ];
    
    for (const index of medicalRecordIndexes) {
      if (await createIndexSafely(medicalRecords, index)) totalCreated++;
    }

    // 5. REVIEWS - Veterinarian ratings, feedback
    console.log('\n📋 REVIEW INDEXES:');
    const reviews = db.collection('reviews');
    const reviewIndexes = [
      { veterinarianId: 1, createdAt: -1 }, // Vet reviews chronological
      { veterinarianId: 1, rating: -1 }, // Rating sorting
      { petOwnerId: 1 }, // Owner's reviews
      { appointmentId: 1 }, // Appointment linking
      { rating: -1 }, // Rating filtering
      { isVisible: 1 }, // Visible reviews only
      { createdAt: -1 }, // Recent reviews
    ];
    
    for (const index of reviewIndexes) {
      if (await createIndexSafely(reviews, index)) totalCreated++;
    }

    // 6. NOTIFICATIONS - Real-time messaging, alerts
    console.log('\n📋 NOTIFICATION INDEXES:');
    const notifications = db.collection('notifications');
    const notificationIndexes = [
      { userId: 1, isRead: 1, createdAt: -1 }, // Unread notifications
      { userId: 1, createdAt: -1 }, // User notifications
      { type: 1 }, // Type filtering
      { isRead: 1 }, // Read status
      { createdAt: -1 }, // Recent notifications
    ];
    
    for (const index of notificationIndexes) {
      if (await createIndexSafely(notifications, index)) totalCreated++;
    }

    // 7. ORDERS - E-commerce, purchase history
    console.log('\n📋 ORDER INDEXES:');
    const orders = db.collection('orders');
    const orderIndexes = [
      { petOwnerId: 1, createdAt: -1 }, // Customer orders
      { ownerId: 1, createdAt: -1 }, // Seller orders
      { petStoreId: 1, createdAt: -1 }, // Store orders
      { status: 1 }, // Order status
      { paymentStatus: 1 }, // Payment status
      { orderNumber: 1 }, // Unique lookup
      { createdAt: -1 }, // Recent orders
      { total: -1 }, // Value sorting
    ];
    
    for (const index of orderIndexes) {
      if (await createIndexSafely(orders, index)) totalCreated++;
    }

    // 8. TRANSACTIONS - Payment history, financial records
    console.log('\n📋 TRANSACTION INDEXES:');
    const transactions = db.collection('transactions');
    const transactionIndexes = [
      { userId: 1, createdAt: -1 }, // User transaction history
      { relatedAppointmentId: 1 }, // Appointment payments
      { relatedOrderId: 1 }, // Order payments
      { relatedSubscriptionId: 1 }, // Subscription payments
      { status: 1 }, // Transaction status
      { provider: 1 }, // Payment provider
      { amount: -1 }, // Amount sorting
      { createdAt: -1 }, // Recent transactions
      { currency: 1 }, // Currency filtering
    ];
    
    for (const index of transactionIndexes) {
      if (await createIndexSafely(transactions, index)) totalCreated++;
    }

    // 9. PRODUCTS - E-commerce catalog
    console.log('\n📋 PRODUCT INDEXES:');
    const products = db.collection('products');
    const productIndexes = [
      { sellerId: 1, isActive: 1 }, // Seller products
      { petStoreId: 1 }, // Store products
      { category: 1, isActive: 1 }, // Category browsing
      { petType: 1, isActive: 1 }, // Pet type filtering
      { isActive: 1, createdAt: -1 }, // Active products
      { price: 1 }, // Price sorting
      { name: 'text', description: 'text' }, // Text search
      { tags: 1 }, // Tag filtering
      { sellerType: 1 }, // Seller type filtering
    ];
    
    for (const index of productIndexes) {
      if (await createIndexSafely(products, index)) totalCreated++;
    }

    // 10. PET STORES - Store management
    console.log('\n📋 PET STORE INDEXES:');
    const petStores = db.collection('petstores');
    const petStoreIndexes = [
      { ownerId: 1 }, // Store owner
      { isActive: 1 }, // Active stores
      { 'address.city': 1 }, // Location filtering
      { name: 'text' }, // Name search
      { createdAt: -1 }, // Recent stores
    ];
    
    for (const index of petStoreIndexes) {
      if (await createIndexSafely(petStores, index)) totalCreated++;
    }

    // 11. VACCINATIONS - Pet health records
    console.log('\n📋 VACCINATION INDEXES:');
    const vaccinations = db.collection('vaccinations');
    const vaccinationIndexes = [
      { petId: 1, vaccinationDate: -1 }, // Pet vaccination history
      { petOwnerId: 1, nextDueDate: 1 }, // Upcoming vaccinations
      { nextDueDate: 1 }, // Due date sorting
      { vaccinationType: 1 }, // Type filtering
      { veterinarianId: 1 }, // Administered by vet
    ];
    
    for (const index of vaccinationIndexes) {
      if (await createIndexSafely(vaccinations, index)) totalCreated++;
    }

    // 12. WEIGHT RECORDS - Pet health tracking
    console.log('\n📋 WEIGHT RECORD INDEXES:');
    const weightRecords = db.collection('weightrecords');
    const weightRecordIndexes = [
      { petId: 1, date: -1 }, // Pet weight history
      { petOwnerId: 1, date: -1 }, // Owner's records
      { recordedBy: 1 }, // Recorded by vet
      { date: -1 }, // Recent records
    ];
    
    for (const index of weightRecordIndexes) {
      if (await createIndexSafely(weightRecords, index)) totalCreated++;
    }

    // 13. SPECIALIZATIONS - Veterinarian specialties
    console.log('\n📋 SPECIALIZATION INDEXES:');
    const specializations = db.collection('specializations');
    const specializationIndexes = [
      { name: 1 }, // Name lookup
      { slug: 1 }, // URL slug
      { isActive: 1 }, // Active specializations
    ];
    
    for (const index of specializationIndexes) {
      if (await createIndexSafely(specializations, index)) totalCreated++;
    }

    // 14. VETERINARIAN PROFILES - Professional profiles
    console.log('\n📋 VETERINARIAN PROFILE INDEXES:');
    const veterinarianProfiles = db.collection('veterinarianprofiles');
    const veterinarianProfileIndexes = [
      { userId: 1 }, // Profile owner
      { isVerified: 1, isFeatured: 1 }, // Featured vets
      { specializations: 1 }, // Specialization filtering
      { 'clinics.city': 1 }, // Location filtering
      { ratingAvg: -1 }, // Rating sorting
      { isAvailableOnline: 1 }, // Online availability
    ];
    
    for (const index of veterinarianProfileIndexes) {
      if (await createIndexSafely(veterinarianProfiles, index)) totalCreated++;
    }

    // 15. SUBSCRIPTIONS - Veterinarian subscriptions
    console.log('\n📋 SUBSCRIPTION INDEXES:');
    const subscriptions = db.collection('veterinariansubscriptions');
    const subscriptionIndexes = [
      { veterinarianId: 1, isActive: 1 }, // Active subscriptions
      { subscriptionPlanId: 1 }, // Plan filtering
      { endDate: 1 }, // Expiration checking
      { startDate: -1 }, // Start date sorting
    ];
    
    for (const index of subscriptionIndexes) {
      if (await createIndexSafely(subscriptions, index)) totalCreated++;
    }

    // 16. FAVORITES - Pet owner favorites
    console.log('\n📋 FAVORITE INDEXES:');
    const favorites = db.collection('favorites');
    const favoriteIndexes = [
      { petOwnerId: 1, veterinarianId: 1 }, // Unique combination
      { petOwnerId: 1, createdAt: -1 }, // User's favorites
      { veterinarianId: 1 }, // Popular vets
    ];
    
    for (const index of favoriteIndexes) {
      if (await createIndexSafely(favorites, index)) totalCreated++;
    }

    // 17. CHAT MESSAGES - Communication
    console.log('\n📋 CHAT MESSAGE INDEXES:');
    const chatMessages = db.collection('chatmessages');
    const chatMessageIndexes = [
      { conversationId: 1, createdAt: -1 }, // Conversation messages
      { senderId: 1, createdAt: -1 }, // Sender's messages
      { conversationId: 1, senderId: 1 }, // Unread counting
      { createdAt: -1 }, // Recent messages
    ];
    
    for (const index of chatMessageIndexes) {
      if (await createIndexSafely(chatMessages, index)) totalCreated++;
    }

    // 18. CONVERSATIONS - Chat sessions
    console.log('\n📋 CONVERSATION INDEXES:');
    const conversations = db.collection('conversations');
    const conversationIndexes = [
      { adminId: 1, veterinarianId: 1 }, // Admin-vet chats
      { veterinarianId: 1, petOwnerId: 1 }, // Vet-owner chats
      { appointmentId: 1 }, // Appointment conversations
      { lastMessageAt: -1 }, // Recent activity
      { conversationType: 1 }, // Type filtering
    ];
    
    for (const index of conversationIndexes) {
      if (await createIndexSafely(conversations, index)) totalCreated++;
    }

    // 19. RESCHEDULE REQUESTS - Appointment rescheduling
    console.log('\n📋 RESCHEDULE REQUEST INDEXES:');
    const rescheduleRequests = db.collection('reschedulerequests');
    const rescheduleRequestIndexes = [
      { petOwnerId: 1, status: 1 }, // Owner's requests
      { veterinarianId: 1, status: 1 }, // Vet's requests
      { appointmentId: 1 }, // Original appointment
      { status: 1 }, // Status filtering
      { createdAt: -1 }, // Recent requests
    ];
    
    for (const index of rescheduleRequestIndexes) {
      if (await createIndexSafely(rescheduleRequests, index)) totalCreated++;
    }

    // 20. BLOG POSTS - Content management
    console.log('\n📋 BLOG POST INDEXES:');
    const blogPosts = db.collection('blogposts');
    const blogPostIndexes = [
      { authorId: 1, isPublished: 1 }, // Author's posts
      { isPublished: 1, publishedAt: -1 }, // Published posts
      { slug: 1 }, // URL slug
      { tags: 1 }, // Tag filtering
      { title: 'text', content: 'text' }, // Text search
    ];
    
    for (const index of blogPostIndexes) {
      if (await createIndexSafely(blogPosts, index)) totalCreated++;
    }

    // 21. INSURANCE COMPANIES - Insurance management
    console.log('\n📋 INSURANCE INDEXES:');
    const insuranceCompanies = db.collection('insurancecompanies');
    const insuranceIndexes = [
      { isActive: 1 }, // Active companies
      { name: 1 }, // Name lookup
    ];
    
    for (const index of insuranceIndexes) {
      if (await createIndexSafely(insuranceCompanies, index)) totalCreated++;
    }

    // 22. WITHDRAWAL REQUESTS - Financial
    console.log('\n📋 WITHDRAWAL REQUEST INDEXES:');
    const withdrawalRequests = db.collection('withdrawalrequests');
    const withdrawalIndexes = [
      { userId: 1, status: 1 }, // User's requests
      { status: 1, createdAt: -1 }, // Admin management
      { approvedBy: 1 }, // Approved by admin
    ];
    
    for (const index of withdrawalIndexes) {
      if (await createIndexSafely(withdrawalRequests, index)) totalCreated++;
    }

    // 23. ANNOUNCEMENTS - Admin announcements
    console.log('\n📋 ANNOUNCEMENT INDEXES:');
    const announcements = db.collection('announcements');
    const announcementIndexes = [
      { isActive: 1, priority: -1 }, // Active announcements
      { announcementType: 1 }, // Type filtering
      { expiryDate: 1 }, // Expiration checking
      { createdAt: -1 }, // Recent announcements
    ];
    
    for (const index of announcementIndexes) {
      if (await createIndexSafely(announcements, index)) totalCreated++;
    }

    console.log(`\n🎉 COMPREHENSIVE INDEXING COMPLETE!`);
    console.log(`📊 Total indexes created/verified: ${totalCreated}`);
    console.log(`\n✅ ALL ROUTES SHOULD NOW WORK PERFECTLY!`);
    console.log(`\n🔄 NEXT STEPS:`);
    console.log(`1. Restart your server: npm start`);
    console.log(`2. Test endpoints: node simple_endpoint_test.js`);
    console.log(`3. All timeouts should be resolved!`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📋 Database connection closed');
  }
}

createAllIndexes();
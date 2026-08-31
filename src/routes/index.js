const express = require('express');
const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Mount all route modules
router.use('/auth', require('./auth.routes'));
router.use('/pets', require('./pet.routes'));
router.use('/pet-owners', require('./petOwner.routes'));
router.use('/veterinarians', require('./veterinarian.routes'));
router.use('/appointments', require('./appointment.routes'));
router.use('/prescriptions', require('./prescription.routes'));
router.use('/medical-records', require('./medicalRecord.routes'));
router.use('/vaccinations', require('./vaccination.routes'));
router.use('/vaccines', require('./vaccine.routes'));
router.use('/weight-records', require('./weightRecord.routes'));
router.use('/products', require('./product.routes'));
router.use('/product-prescription-requests', require('./productPrescriptionRequest.routes'));
router.use('/pet-stores', require('./petStore.routes'));
router.use('/orders', require('./order.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/subscriptions', require('./subscription.routes'));
router.use('/subscription-plans', require('./subscriptionPlan.routes'));
router.use('/chat', require('./chat.routes'));
router.use('/video', require('./videoSession.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/upload', require('./upload.routes'));
router.use('/specializations', require('./specialization.routes'));
router.use('/availability', require('./availability.routes'));
router.use('/weekly-schedule', require('./weeklySchedule.routes'));
router.use('/balance', require('./balance.routes'));
router.use('/payment', require('./payment.routes'));
router.use('/transaction', require('./transaction.routes'));
router.use('/favorite', require('./favorite.routes'));
router.use('/reschedule-request', require('./rescheduleRequest.routes'));
router.use('/insurance', require('./insurance.routes'));
router.use('/blog', require('./blog.routes'));
router.use('/users', require('./user.routes'));
router.use('/mapping', require('./mapping.routes'));
router.use('/crm', require('./crm.routes'));
router.use('/announcements', require('./announcement.routes'));
router.use('/support-tickets', require('./supportTicket.routes'));

module.exports = router;

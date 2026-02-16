const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');

/**
 * Get comprehensive CRM data for external CRM system
 * Returns all pet owners, appointments, orders, and statistics
 */
const getCrmData = async (filters = {}) => {
  try {
    // Extract filters
    const {
      startDate,
      endDate,
      petOwnerId,
      veterinarianId,
      orderStatus,
      appointmentStatus
    } = filters;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all appointments with populated veterinarian and pet owner
    const appointmentFilter = { ...dateFilter };
    if (veterinarianId) appointmentFilter.veterinarianId = veterinarianId;
    if (petOwnerId) appointmentFilter.petOwnerId = petOwnerId;
    if (appointmentStatus) appointmentFilter.status = appointmentStatus;

    const appointments = await Appointment.find(appointmentFilter)
      .populate('veterinarianId', 'name email phone profileImage fullName')
      .populate('petOwnerId', 'name email phone profileImage fullName')
      .populate('petId', 'name species breed')
      .sort({ createdAt: -1 })
      .lean();

    const scopedPetOwnerIds = veterinarianId
      ? [...new Set(appointments.map((a) => a?.petOwnerId?._id?.toString?.() || a?.petOwnerId?.toString?.()).filter(Boolean))]
      : [];

    // Get all pet owners
    const petOwnerFilter = { role: 'PET_OWNER' };
    if (petOwnerId) {
      petOwnerFilter._id = petOwnerId;
    } else if (veterinarianId) {
      petOwnerFilter._id = { $in: scopedPetOwnerIds };
    }
    
    const petOwners = await User.find(petOwnerFilter)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Get all orders with populated pet owner, pet store, and owner
    const orderFilter = { ...dateFilter };
    if (petOwnerId) {
      orderFilter.petOwnerId = petOwnerId;
    } else if (veterinarianId) {
      orderFilter.petOwnerId = { $in: scopedPetOwnerIds };
    }
    if (orderStatus) orderFilter.status = orderStatus;

    const orders = await Order.find(orderFilter)
      .populate('petOwnerId', 'name email phone fullName')
      .populate('petStoreId', 'name logo')
      .populate('ownerId', 'name email fullName')
      .populate('items.productId', 'name images price discountPrice')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const stats = {
      petOwners: {
        total: petOwners.length,
        active: petOwners.filter(p => p.status === 'APPROVED').length,
        pending: petOwners.filter(p => p.status === 'PENDING').length,
        blocked: petOwners.filter(p => p.status === 'BLOCKED').length
      },
      appointments: {
        total: appointments.length,
        pending: appointments.filter(a => a.status === 'PENDING').length,
        confirmed: appointments.filter(a => a.status === 'CONFIRMED').length,
        completed: appointments.filter(a => a.status === 'COMPLETED').length,
        cancelled: appointments.filter(a => a.status === 'CANCELLED').length,
        byType: {
          visit: appointments.filter(a => a.bookingType === 'VISIT').length,
          online: appointments.filter(a => a.bookingType === 'ONLINE').length
        },
        byPaymentStatus: {
          unpaid: appointments.filter(a => a.paymentStatus === 'UNPAID').length,
          paid: appointments.filter(a => a.paymentStatus === 'PAID').length,
          refunded: appointments.filter(a => a.paymentStatus === 'REFUNDED').length
        }
      },
      orders: {
        total: orders.length,
        totalRevenue: orders
          .filter(o => o.paymentStatus === 'PAID')
          .reduce((sum, o) => sum + (o.total || 0), 0),
        byStatus: {
          pending: orders.filter(o => o.status === 'PENDING').length,
          confirmed: orders.filter(o => o.status === 'CONFIRMED').length,
          processing: orders.filter(o => o.status === 'PROCESSING').length,
          shipped: orders.filter(o => o.status === 'SHIPPED').length,
          delivered: orders.filter(o => o.status === 'DELIVERED').length,
          cancelled: orders.filter(o => o.status === 'CANCELLED').length,
          refunded: orders.filter(o => o.status === 'REFUNDED').length
        },
        byPaymentStatus: {
          unpaid: orders.filter(o => o.paymentStatus === 'UNPAID').length,
          paid: orders.filter(o => o.paymentStatus === 'PAID').length,
          partial: orders.filter(o => o.paymentStatus === 'PARTIAL').length,
          refunded: orders.filter(o => o.paymentStatus === 'REFUNDED').length
        },
        averageOrderValue: orders.length > 0
          ? orders.reduce((sum, o) => sum + (o.total || 0), 0) / orders.length
          : 0
      },
      recentActivity: {
        newPetOwnersLast30Days: petOwners.filter(p => {
          const daysAgo = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length,
        newAppointmentsLast30Days: appointments.filter(a => {
          const daysAgo = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length,
        newOrdersLast30Days: orders.filter(o => {
          const daysAgo = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length
      }
    };

    return {
      petOwners,
      appointments,
      orders,
      stats,
      generatedAt: new Date().toISOString(),
      filters: filters
    };
  } catch (error) {
    console.error('Error fetching CRM data:', error);
    throw error;
  }
};

module.exports = {
  getCrmData
};

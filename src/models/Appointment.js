const mongoose = require('mongoose');
const { APPOINTMENT_STATUS, APPOINTMENT_TYPE, PAYMENT_STATUS } = require('../types/enums');

const appointmentSchema = new mongoose.Schema({
  veterinarianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  petOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  petId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true
  },
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  appointmentDuration: {
    type: Number,
    default: 30, // Default 30 minutes
    min: 15,
    max: 120
  },
  appointmentEndTime: {
    type: String,
    default: null
  },
  consultationFee: {
    type: Number,
    default: null,
    min: 0
  },
  timezone: {
    type: String,
    default: null
  },
  timezoneOffset: {
    type: Number,
    default: null
  },
  bookingType: {
    type: String,
    enum: Object.values(APPOINTMENT_TYPE),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(APPOINTMENT_STATUS),
    default: APPOINTMENT_STATUS.PENDING
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.UNPAID
  },
  paymentMethod: {
    type: String,
    default: null
  },
  appointmentNumber: {
    type: String,
    default: null,
    unique: true,
    sparse: true
  },
  reason: {
    type: String,
    default: null // e.g., "Annual checkup", "Vaccination", "Surgery"
  },
  petSymptoms: {
    type: String,
    default: null
  },
  clinicName: {
    type: String,
    default: null
  },
  videoCallLink: {
    type: String,
    default: null
  },
  videoSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VideoSession',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notes: {
    type: String,
    default: null
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  emergencyPriority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: null
  },
  emergencyDescription: {
    type: String,
    default: null
  },
  rescheduleRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RescheduleRequest',
    default: null
  },
  isRescheduled: {
    type: Boolean,
    default: false
  },
  originalAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  rescheduleFee: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Generate unique appointment number before saving
appointmentSchema.pre('save', async function(next) {
  if (!this.appointmentNumber) {
    let appointmentNumber;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      appointmentNumber = `APT-${timestamp}-${random}`;
      
      const existingAppointment = await this.constructor.findOne({ appointmentNumber });
      if (!existingAppointment) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      const timestamp = Date.now();
      const random1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const random2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      appointmentNumber = `APT-${timestamp}-${random1}-${random2}`;
    }
    
    this.appointmentNumber = appointmentNumber;
  }
  next();
});

// Indexes - Optimized for dashboard queries
appointmentSchema.index({ veterinarianId: 1, appointmentDate: 1 });
appointmentSchema.index({ petOwnerId: 1, appointmentDate: -1 });
appointmentSchema.index({ petOwnerId: 1, status: 1, appointmentDate: -1 }); // Compound index for dashboard
appointmentSchema.index({ petId: 1, appointmentDate: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ appointmentNumber: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);

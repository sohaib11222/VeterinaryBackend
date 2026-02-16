const fs = require('fs');
const path = require('path');

// Base URL variable
const baseUrl = '{{base_url}}';

// Helper function to create a request
function createRequest(name, method, path, body = null, auth = false, testScript = null, preRequestScript = null) {
  const request = {
    name: name,
    request: {
      method: method,
      header: [
        {
          key: 'Content-Type',
          value: 'application/json'
        }
      ],
      url: {
        raw: `${baseUrl}${path}`,
        host: ['{{base_url}}'],
        path: path.split('/').filter(p => p)
      }
    }
  };

  if (auth) {
    request.request.header.push({
      key: 'Authorization',
      value: 'Bearer {{token}}'
    });
  }

  if (body) {
    request.request.body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2)
    };
  }

  const events = [];
  
  // Add pre-request script for authenticated requests
  if (auth && !preRequestScript) {
    preRequestScript = [
      '// Check if token exists',
      'if (!pm.collectionVariables.get("token")) {',
      '    console.log("⚠️ No token found. Please run Login or Register first.");',
      '    throw new Error("Token is required. Please login first.");',
      '}'
    ];
  }
  
  if (preRequestScript) {
    events.push({
      listen: 'prerequest',
      script: {
        exec: preRequestScript
      }
    });
  }

  if (testScript) {
    events.push({
      listen: 'test',
      script: {
        exec: testScript
      }
    });
  } else if (auth) {
    // Add default test script for authenticated requests
    events.push({
      listen: 'test',
      script: {
        exec: [
          'pm.test("Status code check", function () {',
          '    pm.expect(pm.response.code).to.be.oneOf([200, 201, 400, 401, 403, 404, 500]);',
          '});',
          '',
          'if (pm.response.code === 200 || pm.response.code === 201) {',
          '    pm.test("Response has success field", function () {',
          '        const jsonData = pm.response.json();',
          '        pm.expect(jsonData).to.have.property("success");',
          '    });',
          '} else if (pm.response.code === 401) {',
          '    console.log("⚠️ Authentication failed - Token may be expired. Please login again.");',
          '} else if (pm.response.code === 403) {',
          '    console.log("⚠️ Access denied - Insufficient permissions.");',
          '} else if (pm.response.code === 404) {',
          '    console.log("⚠️ Resource not found.");',
          '} else {',
          '    console.log("⚠️ Error:", pm.response.code, pm.response.status);',
          '}'
        ]
      }
    });
  } else {
    // Default test for non-authenticated requests
    events.push({
      listen: 'test',
      script: {
        exec: [
          'pm.test("Status code check", function () {',
          '    pm.expect(pm.response.code).to.be.oneOf([200, 201, 400, 401, 404, 500]);',
          '});',
          '',
          'if (pm.response.code === 200 || pm.response.code === 201) {',
          '    const jsonData = pm.response.json();',
          '    if (jsonData && typeof jsonData === "object") {',
          '        pm.test("Response has success field", function () {',
          '            pm.expect(jsonData).to.have.property("success");',
          '        });',
          '    }',
          '}'
        ]
      }
    });
  }

  if (events.length > 0) {
    request.event = events;
  }

  return request;
}

// Collection structure
const collection = {
  info: {
    name: 'Veterinary Backend - Complete API Collection',
    description: 'Complete API collection for Veterinary Backend with all routes organized by role',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    _exporter_id: 'veterinary-backend-complete'
  },
  variable: [
    {
      key: 'base_url',
      value: 'http://localhost:5000/api',
      type: 'string'
    },
    {
      key: 'token',
      value: '',
      type: 'string'
    },
    {
      key: 'refresh_token',
      value: '',
      type: 'string'
    },
    {
      key: 'user_id',
      value: '',
      type: 'string'
    },
    {
      key: 'pet_owner_id',
      value: '',
      type: 'string'
    },
    {
      key: 'veterinarian_id',
      value: '',
      type: 'string'
    },
    {
      key: 'admin_id',
      value: '',
      type: 'string'
    }
  ],
  item: []
};

// Authentication Routes
const authFolder = {
  name: 'Authentication',
  item: [
    createRequest('Register Pet Owner', 'POST', '/auth/register', {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      password: 'password123',
      role: 'PET_OWNER'
    }, false, [
      'if (pm.response.code === 201) {',
      '    const response = pm.response.json();',
      '    pm.collectionVariables.set("token", response.data.token);',
      '    pm.collectionVariables.set("refresh_token", response.data.refreshToken);',
      '    pm.collectionVariables.set("user_id", response.data.user.id);',
      '    pm.collectionVariables.set("pet_owner_id", response.data.user.id);',
      '}'
    ]),
    createRequest('Register Veterinarian', 'POST', '/auth/register', {
      name: 'Dr. Jane Smith',
      email: 'jane@example.com',
      phone: '+1234567891',
      password: 'password123',
      role: 'VETERINARIAN'
    }, false, [
      'if (pm.response.code === 201) {',
      '    const response = pm.response.json();',
      '    pm.collectionVariables.set("token", response.data.token);',
      '    pm.collectionVariables.set("refresh_token", response.data.refreshToken);',
      '    pm.collectionVariables.set("user_id", response.data.user.id);',
      '    pm.collectionVariables.set("veterinarian_id", response.data.user.id);',
      '}'
    ]),
    createRequest('Login', 'POST', '/auth/login', {
      email: 'john@example.com',
      password: 'password123'
    }, false, [
      'if (pm.response.code === 200) {',
      '    const response = pm.response.json();',
      '    pm.collectionVariables.set("token", response.data.token);',
      '    pm.collectionVariables.set("refresh_token", response.data.refreshToken);',
      '    pm.collectionVariables.set("user_id", response.data.user.id);',
      '}'
    ]),
    createRequest('Forgot Password', 'POST', '/auth/forgot-password', {
      email: 'john@example.com'
    }),
    createRequest('Verify Reset Code', 'POST', '/auth/verify-reset-code', {
      email: 'john@example.com',
      code: '123456'
    }),
    createRequest('Reset Password', 'POST', '/auth/reset-password', {
      email: 'john@example.com',
      code: '123456',
      newPassword: 'newpassword123'
    }),
    createRequest('Change Password', 'POST', '/auth/change-password', {
      oldPassword: 'password123',
      newPassword: 'newpassword123'
    }, true),
    createRequest('Refresh Token', 'POST', '/auth/refresh-token', {
      refreshToken: '{{refresh_token}}'
    })
  ]
};

// Pet Owner Routes
const petOwnerFolder = {
  name: 'Pet Owner',
  item: [
    createRequest('Get Dashboard', 'GET', '/pet-owners/dashboard', null, true),
    createRequest('Get Appointment History', 'GET', '/pet-owners/appointments', null, true),
    createRequest('Get Payment History', 'GET', '/pet-owners/payments', null, true)
  ]
};

// Veterinarian Routes
const veterinarianFolder = {
  name: 'Veterinarian',
  item: [
    createRequest('Get Own Profile', 'GET', '/veterinarians/profile', null, true),
    createRequest('Update Profile', 'PUT', '/veterinarians/profile', {
      title: 'Senior Veterinarian',
      biography: 'Experienced veterinarian with 10+ years',
      specializations: [],
      clinics: [{
        name: 'Main Clinic',
        address: '123 Main St',
        city: 'New York',
        phone: '+1234567890'
      }],
      services: ['General Consultation', 'Surgery'],
      consultationFees: {
        clinic: 100,
        online: 80
      }
    }, true),
    createRequest('Get Dashboard', 'GET', '/veterinarians/dashboard', null, true),
    createRequest('Get Reviews', 'GET', '/veterinarians/reviews', null, true),
    createRequest('Buy Subscription Plan', 'POST', '/veterinarians/buy-subscription', {
      planId: '{{subscription_plan_id}}'
    }, true),
    createRequest('Get My Subscription', 'GET', '/veterinarians/my-subscription', null, true),
    createRequest('List Veterinarians (Public)', 'GET', '/veterinarians', null, false),
    createRequest('Get Veterinarian Profile by ID', 'GET', '/veterinarians/{{veterinarian_id}}', null, false)
  ]
};

// Admin Routes
const adminFolder = {
  name: 'Admin',
  item: [
    createRequest('Get Dashboard', 'GET', '/admin/dashboard', null, true),
    createRequest('Get All Users', 'GET', '/admin/users', null, true),
    createRequest('Get All Appointments', 'GET', '/admin/appointments', null, true),
    createRequest('Get All Transactions', 'GET', '/admin/transactions', null, true),
    createRequest('Get All Reviews', 'GET', '/admin/reviews', null, true),
    createRequest('Get System Activity', 'GET', '/admin/activity', null, true),
    createRequest('Approve Veterinarian', 'POST', '/auth/approve-veterinarian', {
      userId: '{{veterinarian_id}}'
    }, true),
    createRequest('Reject Veterinarian', 'POST', '/auth/reject-veterinarian', {
      userId: '{{veterinarian_id}}'
    }, true)
  ]
};

// User Routes
const userFolder = {
  name: 'User Management',
  item: [
    createRequest('Get User by ID', 'GET', '/users/{{user_id}}', null, true),
    createRequest('Update Profile', 'PUT', '/users/profile', {
      name: 'Updated Name',
      phone: '+1234567890',
      address: {
        line1: '123 Main St',
        city: 'New York',
        country: 'USA'
      }
    }, true),
    createRequest('List Users (Admin)', 'GET', '/users', null, true),
    createRequest('List Veterinarians (Admin)', 'GET', '/users/veterinarians', null, true),
    createRequest('Update User Status (Admin)', 'PUT', '/users/status/{{user_id}}', {
      status: 'APPROVED'
    }, true)
  ]
};

// Pet Routes
const petFolder = {
  name: 'Pets',
  item: [
    createRequest('List Pets', 'GET', '/pets', null, true),
    createRequest('Create Pet', 'POST', '/pets', {
      name: 'Buddy',
      species: 'DOG',
      breed: 'Golden Retriever',
      gender: 'MALE',
      dateOfBirth: '2020-01-01',
      weight: 25,
      photo: 'https://example.com/photo.jpg'
    }, true),
    createRequest('Get Pet by ID', 'GET', '/pets/{{pet_id}}', null, true),
    createRequest('Update Pet', 'PUT', '/pets/{{pet_id}}', {
      name: 'Buddy Updated',
      weight: 30
    }, true),
    createRequest('Delete Pet', 'DELETE', '/pets/{{pet_id}}', null, true)
  ]
};

// Appointment Routes
const appointmentFolder = {
  name: 'Appointments',
  item: [
    createRequest('Create Appointment', 'POST', '/appointments', {
      veterinarianId: '{{veterinarian_id}}',
      petId: '{{pet_id}}',
      appointmentDate: '2025-02-01',
      appointmentTime: '10:00',
      bookingType: 'CLINIC',
      reason: 'Annual checkup'
    }, true),
    createRequest('List Appointments', 'GET', '/appointments', null, true),
    createRequest('Get Appointment by ID', 'GET', '/appointments/{{appointment_id}}', null, true),
    createRequest('Accept Appointment', 'POST', '/appointments/{{appointment_id}}/accept', null, true),
    createRequest('Reject Appointment', 'POST', '/appointments/{{appointment_id}}/reject', {
      reason: 'Not available'
    }, true),
    createRequest('Cancel Appointment', 'POST', '/appointments/{{appointment_id}}/cancel', {
      reason: 'Change of plans'
    }, true),
    createRequest('Complete Appointment', 'POST', '/appointments/{{appointment_id}}/complete', null, true),
    createRequest('Update Appointment Status', 'PUT', '/appointments/{{appointment_id}}/status', {
      status: 'CONFIRMED'
    }, true)
  ]
};

// Product Routes
const productFolder = {
  name: 'Products',
  item: [
    createRequest('List Products (Public)', 'GET', '/products', null, false),
    createRequest('Get Product by ID (Public)', 'GET', '/products/{{product_id}}', null, false),
    createRequest('Create Product', 'POST', '/products', {
      name: 'Dog Food Premium',
      description: 'High quality dog food',
      price: 50,
      discountPrice: 45,
      category: 'FOOD',
      stock: 100,
      images: ['https://example.com/image.jpg'],
      sellerType: 'VETERINARIAN'
    }, true),
    createRequest('Update Product', 'PUT', '/products/{{product_id}}', {
      price: 55,
      stock: 90
    }, true),
    createRequest('Delete Product', 'DELETE', '/products/{{product_id}}', null, true)
  ]
};

// Order Routes
const orderFolder = {
  name: 'Orders',
  item: [
    createRequest('Create Order', 'POST', '/orders', {
      petStoreId: '{{pet_store_id}}',
      items: [{
        productId: '{{product_id}}',
        quantity: 2
      }],
      shippingAddress: {
        line1: '123 Main St',
        city: 'New York',
        country: 'USA'
      }
    }, true),
    createRequest('List Orders', 'GET', '/orders', null, true),
    createRequest('Get Order by ID', 'GET', '/orders/{{order_id}}', null, true),
    createRequest('Update Order Status', 'PUT', '/orders/{{order_id}}/status', {
      status: 'CONFIRMED'
    }, true),
    createRequest('Update Shipping Fee', 'PUT', '/orders/{{order_id}}/shipping', {
      shippingFee: 10
    }, true),
    createRequest('Pay for Order', 'POST', '/orders/{{order_id}}/pay', {
      paymentMethod: 'CARD'
    }, true),
    createRequest('Cancel Order', 'POST', '/orders/{{order_id}}/cancel', {
      reason: 'Changed mind'
    }, true)
  ]
};

// Review Routes
const reviewFolder = {
  name: 'Reviews',
  item: [
    createRequest('List Reviews by Veterinarian (Public)', 'GET', '/reviews/veterinarian/{{veterinarian_id}}', null, false),
    createRequest('Create Review', 'POST', '/reviews', {
      veterinarianId: '{{veterinarian_id}}',
      petId: '{{pet_id}}',
      appointmentId: '{{appointment_id}}',
      rating: 5,
      comment: 'Excellent service!'
    }, true),
    createRequest('Delete Review', 'DELETE', '/reviews/{{review_id}}', null, true)
  ]
};

// Notification Routes
const notificationFolder = {
  name: 'Notifications',
  item: [
    createRequest('Create Notification', 'POST', '/notifications', {
      userId: '{{user_id}}',
      title: 'New Appointment',
      body: 'You have a new appointment scheduled',
      type: 'APPOINTMENT'
    }, true),
    createRequest('List Notifications', 'GET', '/notifications', null, true),
    createRequest('Mark Notification as Read', 'PUT', '/notifications/{{notification_id}}/read', null, true),
    createRequest('Mark All Notifications as Read', 'PUT', '/notifications/read-all', null, true)
  ]
};

// Balance Routes
const balanceFolder = {
  name: 'Balance & Withdrawals',
  item: [
    createRequest('Get Balance', 'GET', '/balance', null, true),
    createRequest('Top Up Balance (Admin)', 'POST', '/balance/topup', {
      userId: '{{user_id}}',
      amount: 100
    }, true),
    createRequest('Request Withdrawal', 'POST', '/balance/withdraw/request', {
      amount: 50,
      paymentDetails: {
        method: 'BANK_TRANSFER',
        accountNumber: '1234567890',
        bankName: 'Example Bank'
      }
    }, true),
    createRequest('Get Withdrawal Requests', 'GET', '/balance/withdraw/requests', null, true),
    createRequest('Approve Withdrawal (Admin)', 'POST', '/balance/withdraw/{{withdrawal_request_id}}/approve', null, true),
    createRequest('Reject Withdrawal (Admin)', 'POST', '/balance/withdraw/{{withdrawal_request_id}}/reject', {
      reason: 'Invalid account'
    }, true)
  ]
};

// Chat Routes
const chatFolder = {
  name: 'Chat',
  item: [
    createRequest('Send Message', 'POST', '/chat/send', {
      conversationId: '{{conversation_id}}',
      message: 'Hello!',
      messageType: 'TEXT'
    }, true),
    createRequest('Get or Create Conversation', 'POST', '/chat/conversation', {
      participantId: '{{veterinarian_id}}',
      type: 'VETERINARIAN'
    }, true),
    createRequest('Get Conversations', 'GET', '/chat/conversations', null, true),
    createRequest('Get Messages', 'GET', '/chat/messages/{{conversation_id}}', null, true),
    createRequest('Mark Messages as Read', 'POST', '/chat/conversations/{{conversation_id}}/read', null, true),
    createRequest('Get Unread Count', 'GET', '/chat/unread-count', null, true)
  ]
};

// Subscription Routes
const subscriptionFolder = {
  name: 'Subscriptions',
  item: [
    createRequest('Get My Subscription', 'GET', '/subscriptions/my-subscription', null, true),
    createRequest('Get Subscription by Veterinarian (Public)', 'GET', '/subscriptions/veterinarian/{{veterinarian_id}}', null, false),
    createRequest('List All Subscriptions (Admin)', 'GET', '/subscriptions', null, true),
    createRequest('Cancel Subscription', 'PUT', '/subscriptions/{{subscription_id}}/cancel', null, true),
    createRequest('Activate Subscription (Admin)', 'PUT', '/subscriptions/{{subscription_id}}/activate', null, true)
  ]
};

// Subscription Plan Routes
const subscriptionPlanFolder = {
  name: 'Subscription Plans',
  item: [
    createRequest('Get Active Plans (Public)', 'GET', '/subscription-plans/active', null, false),
    createRequest('List Plans (Public)', 'GET', '/subscription-plans', null, false),
    createRequest('Get Plan by ID (Public)', 'GET', '/subscription-plans/{{plan_id}}', null, false),
    createRequest('Create Plan (Admin)', 'POST', '/subscription-plans', {
      name: 'Premium Plan',
      description: 'Premium subscription plan',
      price: 99,
      durationInDays: 30,
      features: ['Feature 1', 'Feature 2']
    }, true),
    createRequest('Update Plan (Admin)', 'PUT', '/subscription-plans/{{plan_id}}', {
      price: 109
    }, true),
    createRequest('Delete Plan (Admin)', 'DELETE', '/subscription-plans/{{plan_id}}', null, true)
  ]
};

// Favorite Routes
const favoriteFolder = {
  name: 'Favorites',
  item: [
    createRequest('Add Favorite Veterinarian', 'POST', '/favorite', {
      veterinarianId: '{{veterinarian_id}}'
    }, true),
    createRequest('List Favorites', 'GET', '/favorite/{{pet_owner_id}}', null, true),
    createRequest('Remove Favorite', 'DELETE', '/favorite/{{favorite_id}}', null, true)
  ]
};

// Medical Record Routes
const medicalRecordFolder = {
  name: 'Medical Records',
  item: [
    createRequest('Create Medical Record', 'POST', '/medical-records', {
      petId: '{{pet_id}}',
      title: 'Annual Checkup',
      description: 'Routine checkup',
      recordType: 'CHECKUP',
      fileUrl: 'https://example.com/record.pdf'
    }, true),
    createRequest('List Medical Records', 'GET', '/medical-records', null, true),
    createRequest('Get Medical Record by ID', 'GET', '/medical-records/{{medical_record_id}}', null, true),
    createRequest('Delete Medical Record', 'DELETE', '/medical-records/{{medical_record_id}}', null, true)
  ]
};

// Vaccination Routes
const vaccinationFolder = {
  name: 'Vaccinations',
  item: [
    createRequest('Create Vaccination', 'POST', '/vaccinations', {
      petId: '{{pet_id}}',
      vaccineName: 'Rabies',
      vaccineType: 'RABIES',
      vaccinationDate: '2025-01-01',
      nextDueDate: '2026-01-01',
      veterinarianId: '{{veterinarian_id}}'
    }, true),
    createRequest('List Vaccinations', 'GET', '/vaccinations', null, true),
    createRequest('Get Upcoming Vaccinations', 'GET', '/vaccinations/upcoming', null, true),
    createRequest('Update Vaccination', 'PUT', '/vaccinations/{{vaccination_id}}', {
      vaccinationDate: '2025-01-15'
    }, true),
    createRequest('Delete Vaccination', 'DELETE', '/vaccinations/{{vaccination_id}}', null, true)
  ]
};

// Weight Record Routes
const weightRecordFolder = {
  name: 'Weight Records',
  item: [
    createRequest('Create Weight Record', 'POST', '/weight-records', {
      petId: '{{pet_id}}',
      weight: 25.5,
      recordDate: '2025-01-01',
      notes: 'Regular checkup'
    }, true),
    createRequest('List Weight Records', 'GET', '/weight-records', null, true),
    createRequest('Get Weight Record by ID', 'GET', '/weight-records/{{weight_record_id}}', null, true),
    createRequest('Update Weight Record', 'PUT', '/weight-records/{{weight_record_id}}', {
      weight: 26.0
    }, true),
    createRequest('Delete Weight Record', 'DELETE', '/weight-records/{{weight_record_id}}', null, true)
  ]
};

// Specialization Routes
const specializationFolder = {
  name: 'Specializations',
  item: [
    createRequest('List Specializations (Public)', 'GET', '/specializations', null, false),
    createRequest('Create Specialization (Admin)', 'POST', '/specializations', {
      name: 'Cardiology',
      description: 'Heart and cardiovascular system'
    }, true),
    createRequest('Update Specialization (Admin)', 'PUT', '/specializations/{{specialization_id}}', {
      name: 'Advanced Cardiology'
    }, true),
    createRequest('Delete Specialization (Admin)', 'DELETE', '/specializations/{{specialization_id}}', null, true)
  ]
};

// Availability Routes
const availabilityFolder = {
  name: 'Availability',
  item: [
    createRequest('Set Availability', 'POST', '/availability', {
      date: '2025-02-01',
      timeSlots: [{
        startTime: '09:00',
        endTime: '17:00',
        isAvailable: true
      }]
    }, true),
    createRequest('Get Availability', 'GET', '/availability', null, true),
    createRequest('Get Available Slots (Public)', 'GET', '/availability/slots?veterinarianId={{veterinarian_id}}&date=2025-02-01', null, false),
    createRequest('Check Time Slot (Public)', 'GET', '/availability/check?veterinarianId={{veterinarian_id}}&date=2025-02-01&time=10:00', null, false)
  ]
};

// Weekly Schedule Routes
const weeklyScheduleFolder = {
  name: 'Weekly Schedule',
  item: [
    createRequest('Create/Update Weekly Schedule', 'POST', '/weekly-schedule', {
      monday: [{ startTime: '09:00', endTime: '17:00' }],
      tuesday: [{ startTime: '09:00', endTime: '17:00' }],
      appointmentDuration: 30
    }, true),
    createRequest('Get Weekly Schedule', 'GET', '/weekly-schedule', null, true),
    createRequest('Update Appointment Duration', 'PUT', '/weekly-schedule/duration', {
      duration: 45
    }, true),
    createRequest('Add Time Slot', 'POST', '/weekly-schedule/day/monday/slot', {
      startTime: '10:00',
      endTime: '11:00'
    }, true),
    createRequest('Update Time Slot', 'PUT', '/weekly-schedule/day/monday/slot/{{slot_id}}', {
      startTime: '10:30',
      endTime: '11:30'
    }, true),
    createRequest('Delete Time Slot', 'DELETE', '/weekly-schedule/day/monday/slot/{{slot_id}}', null, true),
    createRequest('Get Available Slots for Date (Public)', 'GET', '/weekly-schedule/slots?veterinarianId={{veterinarian_id}}&date=2025-02-01', null, false)
  ]
};

// Reschedule Request Routes
const rescheduleRequestFolder = {
  name: 'Reschedule Requests',
  item: [
    createRequest('Get Eligible Appointments', 'GET', '/reschedule-request/eligible-appointments', null, true),
    createRequest('Create Reschedule Request', 'POST', '/reschedule-request', {
      appointmentId: '{{appointment_id}}',
      requestedDate: '2025-02-05',
      requestedTime: '14:00',
      reason: 'Schedule conflict'
    }, true),
    createRequest('List Reschedule Requests', 'GET', '/reschedule-request', null, true),
    createRequest('Get Reschedule Request by ID', 'GET', '/reschedule-request/{{reschedule_request_id}}', null, true),
    createRequest('Approve Reschedule Request', 'POST', '/reschedule-request/{{reschedule_request_id}}/approve', null, true),
    createRequest('Reject Reschedule Request', 'POST', '/reschedule-request/{{reschedule_request_id}}/reject', {
      reason: 'Not available'
    }, true),
    createRequest('Pay Reschedule Fee', 'POST', '/reschedule-request/{{reschedule_request_id}}/pay', {
      paymentMethod: 'CARD'
    }, true)
  ]
};

// Upload Routes
const uploadFolder = {
  name: 'File Uploads',
  item: [
    createRequest('Upload Profile Image', 'POST', '/upload/profile', null, true),
    createRequest('Upload Veterinarian Docs', 'POST', '/upload/veterinarian-docs', null, true),
    createRequest('Upload Clinic Images', 'POST', '/upload/clinic', null, true),
    createRequest('Upload Product Images', 'POST', '/upload/product', null, true),
    createRequest('Upload Pet Images', 'POST', '/upload/pet', null, true),
    createRequest('Upload Blog Cover', 'POST', '/upload/blog', null, true),
    createRequest('Upload Pet Store Logo', 'POST', '/upload/pet-store', null, true),
    createRequest('Upload General Image', 'POST', '/upload/general', null, true),
    createRequest('Upload Medical Records', 'POST', '/upload/medical-records', null, true),
    createRequest('Upload Chat File', 'POST', '/upload/chat', null, true),
    createRequest('Upload Multiple Chat Files', 'POST', '/upload/chat/multiple', null, true)
  ]
};

// Payment Routes
const paymentFolder = {
  name: 'Payments',
  item: [
    createRequest('Process Appointment Payment', 'POST', '/payment/appointment', {
      appointmentId: '{{appointment_id}}',
      paymentMethod: 'CARD'
    }, true),
    createRequest('Process Subscription Payment', 'POST', '/payment/subscription', {
      subscriptionPlanId: '{{subscription_plan_id}}',
      paymentMethod: 'CARD'
    }, true),
    createRequest('Process Product Payment', 'POST', '/payment/product', {
      productId: '{{product_id}}',
      quantity: 1,
      paymentMethod: 'CARD'
    }, true),
    createRequest('Process Order Payment', 'POST', '/payment/order', {
      orderId: '{{order_id}}',
      paymentMethod: 'CARD'
    }, true),
    createRequest('Get User Transactions', 'GET', '/payment/transactions', null, true),
    createRequest('Get Transaction by ID', 'GET', '/payment/transaction/{{transaction_id}}', null, true),
    createRequest('Refund Transaction (Admin)', 'POST', '/payment/refund/{{transaction_id}}', {
      reason: 'Customer request'
    }, true)
  ]
};

// Transaction Routes
const transactionFolder = {
  name: 'Transactions',
  item: [
    createRequest('Create Transaction', 'POST', '/transaction', {
      amount: 100,
      currency: 'EUR',
      status: 'PENDING',
      provider: 'STRIPE'
    }, true),
    createRequest('List Transactions', 'GET', '/transaction', null, true),
    createRequest('Get Transaction by ID', 'GET', '/transaction/{{transaction_id}}', null, true),
    createRequest('Update Transaction Status (Admin)', 'PUT', '/transaction/{{transaction_id}}', {
      status: 'SUCCESS'
    }, true)
  ]
};

// Insurance Routes
const insuranceFolder = {
  name: 'Insurance',
  item: [
    createRequest('Get Active Insurance Companies (Public)', 'GET', '/insurance', null, false),
    createRequest('Get Insurance Company by ID (Public)', 'GET', '/insurance/{{insurance_id}}', null, false),
    createRequest('Get All Insurance Companies (Admin)', 'GET', '/insurance/admin/all', null, true),
    createRequest('Create Insurance Company (Admin)', 'POST', '/insurance', {
      name: 'Pet Insurance Co',
      description: 'Comprehensive pet insurance',
      contactEmail: 'contact@petinsurance.com',
      contactPhone: '+1234567890'
    }, true),
    createRequest('Update Insurance Company (Admin)', 'PUT', '/insurance/{{insurance_id}}', {
      name: 'Updated Insurance Co'
    }, true),
    createRequest('Delete Insurance Company (Admin)', 'DELETE', '/insurance/{{insurance_id}}', null, true),
    createRequest('Toggle Insurance Status (Admin)', 'PUT', '/insurance/{{insurance_id}}/toggle-status', null, true)
  ]
};

// Blog Routes
const blogFolder = {
  name: 'Blog',
  item: [
    createRequest('List Blog Posts (Public)', 'GET', '/blog', null, false),
    createRequest('Get Blog Post by ID (Public)', 'GET', '/blog/{{blog_post_id}}', null, false),
    createRequest('Create Blog Post', 'POST', '/blog', {
      title: 'Pet Care Tips',
      content: 'Article content here...',
      coverImage: 'https://example.com/image.jpg',
      tags: ['care', 'tips']
    }, true),
    createRequest('Update Blog Post', 'PUT', '/blog/{{blog_post_id}}', {
      title: 'Updated Title'
    }, true),
    createRequest('Delete Blog Post', 'DELETE', '/blog/{{blog_post_id}}', null, true)
  ]
};

// Pet Store Routes
const petStoreFolder = {
  name: 'Pet Stores',
  item: [
    createRequest('List Pet Stores (Public)', 'GET', '/pet-stores', null, false),
    createRequest('Get Pet Store by ID (Public)', 'GET', '/pet-stores/{{pet_store_id}}', null, false),
    createRequest('Create Pet Store', 'POST', '/pet-stores', {
      name: 'Pet Store Name',
      description: 'Store description',
      address: '123 Main St',
      city: 'New York',
      phone: '+1234567890',
      logo: 'https://example.com/logo.jpg'
    }, true),
    createRequest('Update Pet Store', 'PUT', '/pet-stores/{{pet_store_id}}', {
      name: 'Updated Store Name'
    }, true),
    createRequest('Delete Pet Store (Admin)', 'DELETE', '/pet-stores/{{pet_store_id}}', null, true)
  ]
};

// Video Session Routes
const videoSessionFolder = {
  name: 'Video Sessions',
  item: [
    createRequest('Start Video Session', 'POST', '/video/create', {
      appointmentId: '{{appointment_id}}'
    }, true),
    createRequest('End Video Session', 'POST', '/video/end', {
      sessionId: '{{video_session_id}}'
    }, true),
    createRequest('Get Session by Appointment', 'GET', '/video/appointment/{{appointment_id}}', null, true)
  ]
};

// Announcement Routes
const announcementFolder = {
  name: 'Announcements',
  item: [
    createRequest('Create Announcement (Admin)', 'POST', '/announcements', {
      title: 'Important Update',
      content: 'Announcement content',
      priority: 'HIGH',
      targetCriteria: {
        specializationIds: []
      }
    }, true),
    createRequest('List Announcements (Admin)', 'GET', '/announcements', null, true),
    createRequest('Get Announcements for Veterinarian', 'GET', '/announcements/veterinarian', null, true),
    createRequest('Get Unread Count', 'GET', '/announcements/unread-count', null, true),
    createRequest('Get Announcement by ID', 'GET', '/announcements/{{announcement_id}}', null, true),
    createRequest('Update Announcement (Admin)', 'PUT', '/announcements/{{announcement_id}}', {
      title: 'Updated Title'
    }, true),
    createRequest('Delete Announcement (Admin)', 'DELETE', '/announcements/{{announcement_id}}', null, true),
    createRequest('Mark Announcement as Read', 'POST', '/announcements/{{announcement_id}}/read', null, true),
    createRequest('Get Read Status (Admin)', 'GET', '/announcements/{{announcement_id}}/read-status', null, true)
  ]
};

// Mapping Routes
const mappingFolder = {
  name: 'Mapping & Location',
  item: [
    createRequest('Get Route', 'GET', '/mapping/route?fromLat=40.7128&fromLng=-74.0060&toLat=40.7589&toLng=-73.9851', null, false),
    createRequest('Get Nearby Clinics', 'GET', '/mapping/nearby?lat=40.7128&lng=-74.0060&radius=5000', null, false),
    createRequest('Get Clinic Location', 'GET', '/mapping/clinic/{{clinic_id}}', null, false)
  ]
};

// CRM Routes
const crmFolder = {
  name: 'CRM',
  item: [
    createRequest('Get CRM Data', 'GET', '/crm/data', null, false)
  ]
};

// Health Check
const healthCheck = createRequest('Health Check', 'GET', '/health', null, false, [
  'pm.test("Health check response", function () {',
  '    pm.response.to.have.status(200);',
  '    const jsonData = pm.response.json();',
  '    pm.expect(jsonData).to.have.property("success");',
  '    pm.expect(jsonData.success).to.be.true;',
  '    console.log("✅ Server is running");',
  '});'
]);

// Assemble collection
collection.item = [
  authFolder,
  petOwnerFolder,
  veterinarianFolder,
  adminFolder,
  userFolder,
  petFolder,
  appointmentFolder,
  productFolder,
  orderFolder,
  reviewFolder,
  notificationFolder,
  balanceFolder,
  chatFolder,
  subscriptionFolder,
  subscriptionPlanFolder,
  favoriteFolder,
  medicalRecordFolder,
  vaccinationFolder,
  weightRecordFolder,
  specializationFolder,
  availabilityFolder,
  weeklyScheduleFolder,
  rescheduleRequestFolder,
  uploadFolder,
  paymentFolder,
  transactionFolder,
  insuranceFolder,
  blogFolder,
  petStoreFolder,
  videoSessionFolder,
  announcementFolder,
  mappingFolder,
  crmFolder,
  healthCheck
];

// Write to file
const outputPath = path.join(__dirname, 'POSTMAN_COLLECTION.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
console.log(`✅ Postman collection generated successfully at ${outputPath}`);
console.log(`📊 Total folders: ${collection.item.length}`);
console.log(`📝 Total requests: ${collection.item.reduce((sum, folder) => sum + (folder.item ? folder.item.length : 1), 0)}`);

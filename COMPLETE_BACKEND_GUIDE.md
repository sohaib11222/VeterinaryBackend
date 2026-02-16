# 🐾 Veterinary Backend - Complete Developer Guide

**Version**: 1.0.0  
**Last Updated**: January 24, 2026

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Environment Setup](#environment-setup)
4. [Database Configuration](#database-configuration)
5. [Dependency Installation](#dependency-installation)
6. [API Reference](#api-reference)
7. [Postman Testing Guide](#postman-testing-guide)
8. [Development Workflow](#development-workflow)
9. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### Technology Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js 4.x
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Validation**: Zod
- **Video Calls**: Stream.io (optional)
- **Queue System**: BullMQ with Redis (optional)
- **Email**: Nodemailer (optional)

### Architecture Pattern

The backend follows a **layered architecture** pattern:

```
Request → Routes → Middleware → Controllers → Services → Models → Database
                ↓
            Validators
                ↓
            Error Handler → Response
```

### Key Design Principles

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **DRY (Don't Repeat Yourself)**: Reusable utilities and middleware
3. **Single Responsibility**: Each service/controller handles one domain
4. **RESTful API**: Standard HTTP methods and status codes
5. **Pet-Centric Design**: All features revolve around pets, not owners

---

## 📁 Project Structure

```
VeterinaryBackend/
├── src/
│   ├── config/                    # Configuration files
│   │   ├── database.js           # MongoDB connection
│   │   ├── env.js                 # Environment variables
│   │   └── upload.js              # Multer configuration
│   │
│   ├── controllers/               # Route controllers (Request handlers)
│   │   ├── auth.controller.js     ✅ Implemented
│   │   ├── pet.controller.js      ✅ Implemented
│   │   ├── appointment.controller.js ⏳ Pending
│   │   ├── veterinarian.controller.js ⏳ Pending
│   │   └── ... (28 more controllers)
│   │
│   ├── services/                  # Business logic layer
│   │   ├── auth.service.js       ✅ Implemented
│   │   ├── pet.service.js        ✅ Implemented
│   │   ├── appointment.service.js ⏳ Pending
│   │   └── ... (28 more services)
│   │
│   ├── models/                    # Mongoose models (Database schemas)
│   │   ├── User.js                ✅ Complete
│   │   ├── Pet.js                 ✅ Complete
│   │   ├── Appointment.js         ✅ Complete
│   │   ├── VeterinarianProfile.js ✅ Complete
│   │   ├── MedicalRecord.js       ✅ Complete
│   │   ├── Vaccination.js         ✅ Complete
│   │   ├── WeightRecord.js        ✅ Complete
│   │   ├── Product.js             ✅ Complete
│   │   ├── PetStore.js            ✅ Complete
│   │   ├── Order.js               ✅ Complete
│   │   ├── Review.js              ✅ Complete
│   │   ├── SubscriptionPlan.js   ✅ Complete
│   │   ├── VeterinarianSubscription.js ✅ Complete
│   │   ├── Specialization.js      ✅ Complete
│   │   └── InsuranceCompany.js   ✅ Complete
│   │
│   ├── routes/                    # Express routes
│   │   ├── index.js               ✅ All routes registered
│   │   ├── auth.routes.js         ✅ Complete
│   │   ├── pet.routes.js          ✅ Complete
│   │   ├── appointment.routes.js  ⏳ Placeholder
│   │   └── ... (20+ route files)
│   │
│   ├── middleware/                # Custom middleware
│   │   ├── authGuard.js           ✅ Complete
│   │   ├── asyncHandler.js        ✅ Complete
│   │   ├── errorHandler.js        ✅ Complete
│   │   ├── validate.js            ✅ Complete
│   │   └── requestLogger.js       ✅ Complete
│   │
│   ├── validators/                # Zod validation schemas
│   │   └── ... (⏳ To be implemented)
│   │
│   ├── utils/                     # Utility functions
│   │   ├── jwt.js                 ✅ Complete
│   │   └── response.js            ✅ Complete
│   │
│   ├── types/                      # Type definitions & Enums
│   │   └── enums.js               ✅ Complete
│   │
│   ├── workers/                   # Background job workers
│   │   └── ... (⏳ To be implemented)
│   │
│   ├── seeders/                   # Database seeders
│   │   └── ... (⏳ To be implemented)
│   │
│   ├── app.js                     # Express app configuration
│   └── server.js                  # Server entry point
│
├── uploads/                       # File uploads directory
│   ├── profiles/
│   ├── pets/
│   ├── veterinarian-docs/
│   ├── clinics/
│   ├── products/
│   ├── medical-records/
│   └── ...
│
├── .env                           # Environment variables (not in git)
├── .env.example                   # Environment template
├── .gitignore                     # Git ignore rules
├── package.json                   # Dependencies
├── README.md                      # Project overview
├── SETUP_GUIDE.md                 # Setup instructions
├── ARCHITECTURE_VERIFICATION.md   # Feature parity report
└── COMPLETE_BACKEND_GUIDE.md      # This file
```

---

## ⚙️ Environment Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **MongoDB**: v6.0 or higher
- **npm**: v9.0 or higher (or yarn)
- **Git**: For version control

### Step 1: Clone/Download Project

```bash
cd e:\Doctor_Overall\VeterinaryBackend
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all dependencies listed in `package.json`:
- express, mongoose, jsonwebtoken, bcryptjs
- cors, multer, dotenv, zod
- getstream, nodemailer, bullmq (optional)

### Step 3: Environment Configuration

1. Copy the example environment file:
```bash
cp env.example .env
```

2. Edit `.env` file with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/veterinary_db

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_very_secure_refresh_token_secret_minimum_32_characters
REFRESH_TOKEN_EXPIRES_IN=30d

# File Upload Directories (auto-created)
UPLOAD_PROFILE=uploads/profiles
UPLOAD_VETERINARIAN_DOCS=uploads/veterinarian-docs
UPLOAD_CLINIC=uploads/clinics
UPLOAD_PRODUCT=uploads/products
UPLOAD_PET=uploads/pets
UPLOAD_BLOG=uploads/blogs
UPLOAD_PET_STORE=uploads/pet-stores
UPLOAD_GENERAL=uploads/general
UPLOAD_MEDICAL_RECORDS=uploads/medical-records

# Email Configuration (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Payment Configuration (Optional)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret

# Stream Video SDK (Optional - for video consultations)
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret

# Redis (Optional - for BullMQ queues)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Step 4: Start MongoDB

**Windows:**
```bash
net start MongoDB
```

**macOS/Linux:**
```bash
sudo systemctl start mongod
# or
mongod
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Step 5: Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT).

---

## 🗄️ Database Configuration

### MongoDB Connection

The database connection is configured in `src/config/database.js`:

```javascript
const mongoose = require('mongoose');
const config = require('./env');

const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(config.MONGO_URI);
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('✗ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDatabase;
```

### Connection String Formats

**Local MongoDB:**
```
MONGO_URI=mongodb://localhost:27017/veterinary_db
```

**MongoDB Atlas (Cloud):**
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/veterinary_db?retryWrites=true&w=majority
```

**MongoDB with Authentication:**
```
MONGO_URI=mongodb://username:password@localhost:27017/veterinary_db?authSource=admin
```

### Database Collections

The following collections are automatically created when models are used:

- `users` - User accounts
- `pets` - Pet profiles
- `veterinarianprofiles` - Veterinarian profiles
- `appointments` - Appointments
- `medicalrecords` - Medical records
- `vaccinations` - Vaccination records
- `weightrecords` - Weight tracking
- `products` - Products
- `petstores` - Pet stores
- `orders` - Orders
- `reviews` - Reviews
- `subscriptionplans` - Subscription plans
- `veterinariansubscriptions` - Veterinarian subscriptions
- `specializations` - Specializations
- `insurancecompanies` - Insurance companies

---

## 📦 Dependency Installation

### Core Dependencies

```json
{
  "express": "^4.22.1",           // Web framework
  "mongoose": "^8.20.2",          // MongoDB ODM
  "jsonwebtoken": "^9.0.3",       // JWT authentication
  "bcryptjs": "^2.4.3",           // Password hashing
  "cors": "^2.8.5",               // CORS middleware
  "dotenv": "^16.6.1",             // Environment variables
  "multer": "^1.4.5-lts.1",       // File uploads
  "zod": "^3.23.8"                 // Schema validation
}
```

### Optional Dependencies

```json
{
  "getstream": "^8.8.0",          // Stream.io for video calls
  "nodemailer": "^7.0.12",        // Email sending
  "bullmq": "^5.65.1",             // Background jobs
  "ioredis": "^5.3.2",             // Redis client
  "socket.io": "^4.7.5"            // Real-time communication
}
```

### Development Dependencies

```json
{
  "nodemon": "^3.1.7"              // Auto-reload in development
}
```

### Installation Commands

```bash
# Install all dependencies
npm install

# Install specific dependency
npm install <package-name>

# Install development dependency
npm install --save-dev <package-name>

# Update dependencies
npm update
```

---

## 📚 API Reference

### Base URL

```
http://localhost:5000/api
```

### Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ]  // Optional validation errors
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 🔐 Authentication Endpoints

### 1. Register User

**Endpoint:** `POST /api/auth/register`

**Description:** Register a new pet owner or veterinarian

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "password123",
  "role": "PET_OWNER"  // or "VETERINARIAN"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "role": "PET_OWNER",
      "status": "APPROVED"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Notes:**
- Pet owners are auto-approved (status: APPROVED)
- Veterinarians require admin approval (status: PENDING)

---

### 2. Login

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate user and get JWT token

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "PET_OWNER",
      "status": "APPROVED"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 3. Change Password

**Endpoint:** `POST /api/auth/change-password`

**Description:** Change password for authenticated user

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "oldPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 4. Refresh Token

**Endpoint:** `POST /api/auth/refresh-token`

**Description:** Get new access token using refresh token

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 5. Approve Veterinarian (Admin Only)

**Endpoint:** `POST /api/auth/approve-veterinarian`

**Description:** Approve a pending veterinarian

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "veterinarianId": "507f1f77bcf86cd799439011"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Veterinarian approved successfully"
}
```

---

## 🐾 Pet Management Endpoints

### 1. Create Pet

**Endpoint:** `POST /api/pets`

**Description:** Create a new pet profile

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Buddy",
  "species": "DOG",
  "breed": "Golden Retriever",
  "dateOfBirth": "2020-01-15",
  "gender": "MALE",
  "weight": {
    "value": 25,
    "unit": "kg"
  },
  "color": "Golden",
  "microchipNumber": "123456789012345",
  "spayNeuterStatus": "NEUTERED",
  "medicalConditions": ["None"],
  "allergies": ["None"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Pet created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "ownerId": "507f1f77bcf86cd799439012",
    "name": "Buddy",
    "species": "DOG",
    "breed": "Golden Retriever",
    "dateOfBirth": "2020-01-15T00:00:00.000Z",
    "gender": "MALE",
    "weight": {
      "value": 25,
      "unit": "kg"
    },
    "isActive": true,
    "createdAt": "2026-01-24T10:00:00.000Z",
    "updatedAt": "2026-01-24T10:00:00.000Z"
  }
}
```

**Available Species:**
- `DOG`, `CAT`, `BIRD`, `RABBIT`, `REPTILE`, `FISH`, `HAMSTER`, `GUINEA_PIG`, `FERRET`, `HORSE`, `OTHER`

**Available Genders:**
- `MALE`, `FEMALE`, `NEUTERED`, `SPAYED`, `UNKNOWN`

---

### 2. Get Pet

**Endpoint:** `GET /api/pets/:id`

**Description:** Get pet details by ID

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "ownerId": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "name": "Buddy",
    "species": "DOG",
    "breed": "Golden Retriever",
    ...
  }
}
```

---

### 3. List Pets

**Endpoint:** `GET /api/pets`

**Description:** Get all pets for the authenticated pet owner

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `species` (optional) - Filter by species (DOG, CAT, etc.)
- `isActive` (optional) - Filter by active status (default: true)

**Example:**
```
GET /api/pets?species=DOG&isActive=true
```

**Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Buddy",
      "species": "DOG",
      ...
    },
    ...
  ]
}
```

---

### 4. Update Pet

**Endpoint:** `PUT /api/pets/:id`

**Description:** Update pet information

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:** (Same as create, all fields optional)

**Response (200):**
```json
{
  "success": true,
  "message": "Pet updated successfully",
  "data": { ... }
}
```

---

### 5. Delete Pet

**Endpoint:** `DELETE /api/pets/:id`

**Description:** Soft delete a pet (sets isActive to false)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Pet deleted successfully"
}
```

---

## 📋 Additional Endpoints (Placeholder Status)

The following endpoints have route definitions but need full implementation:

- `/api/appointments` - Appointment management
- `/api/veterinarians` - Veterinarian operations
- `/api/pet-owners` - Pet owner dashboard
- `/api/medical-records` - Medical records
- `/api/vaccinations` - Vaccination management
- `/api/weight-records` - Weight tracking
- `/api/products` - Product management
- `/api/orders` - Order management
- `/api/reviews` - Reviews and ratings
- `/api/subscriptions` - Subscription management
- `/api/chat` - Chat system
- `/api/video` - Video consultations
- `/api/admin` - Admin operations

See `ARCHITECTURE_VERIFICATION.md` for implementation status.

---

## 🧪 Postman Testing Guide

### Step 1: Import Postman Collection

1. Open Postman
2. Click "Import" button
3. Create a new collection: "Veterinary Backend API"
4. Add environment: "Veterinary Local"

### Step 2: Set Up Environment Variables

Create a Postman environment with these variables:

| Variable | Initial Value | Current Value |
|----------|--------------|----------------|
| `base_url` | `http://localhost:5000/api` | `http://localhost:5000/api` |
| `token` | (empty) | (will be set after login) |
| `refresh_token` | (empty) | (will be set after login) |
| `pet_id` | (empty) | (will be set after creating pet) |
| `user_id` | (empty) | (will be set after registration) |

### Step 3: Test Authentication Flow

#### 3.1 Register Pet Owner

**Request:**
- Method: `POST`
- URL: `{{base_url}}/auth/register`
- Headers:
  ```
  Content-Type: application/json
  ```
- Body (raw JSON):
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "password123",
  "role": "PET_OWNER"
}
```

**Tests Tab (to save token):**
```javascript
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("token", response.data.token);
    pm.environment.set("refresh_token", response.data.refreshToken);
    pm.environment.set("user_id", response.data.user.id);
}
```

#### 3.2 Login

**Request:**
- Method: `POST`
- URL: `{{base_url}}/auth/login`
- Headers:
  ```
  Content-Type: application/json
  ```
- Body (raw JSON):
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Tests Tab:**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("token", response.data.token);
    pm.environment.set("refresh_token", response.data.refreshToken);
}
```

### Step 4: Test Pet Management

#### 4.1 Create Pet

**Request:**
- Method: `POST`
- URL: `{{base_url}}/pets`
- Headers:
  ```
  Content-Type: application/json
  Authorization: Bearer {{token}}
  ```
- Body (raw JSON):
```json
{
  "name": "Buddy",
  "species": "DOG",
  "breed": "Golden Retriever",
  "dateOfBirth": "2020-01-15",
  "gender": "MALE",
  "weight": {
    "value": 25,
    "unit": "kg"
  }
}
```

**Tests Tab:**
```javascript
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("pet_id", response.data._id);
}
```

#### 4.2 Get Pet

**Request:**
- Method: `GET`
- URL: `{{base_url}}/pets/{{pet_id}}`
- Headers:
  ```
  Authorization: Bearer {{token}}
  ```

#### 4.3 List Pets

**Request:**
- Method: `GET`
- URL: `{{base_url}}/pets`
- Headers:
  ```
  Authorization: Bearer {{token}}
  ```

#### 4.4 Update Pet

**Request:**
- Method: `PUT`
- URL: `{{base_url}}/pets/{{pet_id}}`
- Headers:
  ```
  Content-Type: application/json
  Authorization: Bearer {{token}}
  ```
- Body (raw JSON):
```json
{
  "weight": {
    "value": 27,
    "unit": "kg"
  }
}
```

#### 4.5 Delete Pet

**Request:**
- Method: `DELETE`
- URL: `{{base_url}}/pets/{{pet_id}}`
- Headers:
  ```
  Authorization: Bearer {{token}}
  ```

### Step 5: Test Health Check

**Request:**
- Method: `GET`
- URL: `{{base_url}}/health`
- No authentication required

**Expected Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-01-24T10:00:00.000Z"
}
```

### Postman Collection Structure

Organize your collection like this:

```
Veterinary Backend API
├── Authentication
│   ├── Register Pet Owner
│   ├── Register Veterinarian
│   ├── Login
│   ├── Change Password
│   └── Refresh Token
├── Pet Management
│   ├── Create Pet
│   ├── Get Pet
│   ├── List Pets
│   ├── Update Pet
│   └── Delete Pet
├── Appointments (⏳ Pending)
├── Medical Records (⏳ Pending)
└── ... (Other endpoints as implemented)
```

---

## 🔄 Development Workflow

### 1. Start Development Server

```bash
npm run dev
```

This uses `nodemon` to auto-reload on file changes.

### 2. Code Structure

When adding new features:

1. **Create Model** (`src/models/`)
2. **Create Service** (`src/services/`)
3. **Create Controller** (`src/controllers/`)
4. **Create Routes** (`src/routes/`)
5. **Add Validators** (`src/validators/`)
6. **Register Routes** (`src/routes/index.js`)

### 3. Testing

```bash
# Run tests (when implemented)
npm test

# Test specific endpoint with curl
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### 4. Database Seeding

```bash
# Seed admin user (when implemented)
npm run seed:admin
```

---

## 🐛 Troubleshooting

### MongoDB Connection Error

**Error:** `MongoDB connection error`

**Solutions:**
1. Ensure MongoDB is running: `mongod` or `net start MongoDB`
2. Check `MONGO_URI` in `.env` file
3. Verify MongoDB port (default: 27017)
4. Check firewall settings

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::5000`

**Solutions:**
1. Change `PORT` in `.env` file
2. Kill process using port:
   ```bash
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   
   # Linux/Mac
   lsof -ti:5000 | xargs kill
   ```

### JWT Token Errors

**Error:** `Not authorized, token failed`

**Solutions:**
1. Ensure token is in `Authorization: Bearer <token>` format
2. Check token hasn't expired (default: 7 days)
3. Verify `JWT_SECRET` in `.env` matches the one used to create token
4. Use refresh token to get new access token

### File Upload Errors

**Error:** `Invalid file type` or `File too large`

**Solutions:**
1. Check file type (allowed: images, PDFs, documents)
2. Check file size (max: 10MB)
3. Ensure upload directory exists
4. Check file permissions

### Validation Errors

**Error:** `Validation error`

**Solutions:**
1. Check request body matches expected schema
2. Verify required fields are provided
3. Check data types (string, number, date, etc.)
4. Review enum values (species, gender, etc.)

---

## 📝 Next Steps

1. **Implement Remaining Controllers**: Follow the pattern in existing controllers
2. **Add Validators**: Use Zod for request validation
3. **Implement Services**: Add business logic for all features
4. **Add Background Workers**: For notifications and scheduled tasks
5. **Set Up Email Service**: For notifications and password reset
6. **Integrate Payment**: Stripe/PayPal integration
7. **Add Video Calls**: Stream.io integration
8. **Complete API Documentation**: Add all endpoints to this guide

---

## 📚 Additional Resources

- **MongoDB Documentation**: https://docs.mongodb.com/
- **Express.js Guide**: https://expressjs.com/en/guide/routing.html
- **Mongoose Documentation**: https://mongoosejs.com/docs/
- **JWT Guide**: https://jwt.io/introduction
- **Zod Documentation**: https://zod.dev/

---

**Last Updated**: January 24, 2026  
**Maintained By**: Development Team

# 🐾 Veterinary Backend Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- npm or yarn

## Installation Steps

### 1. Install Dependencies

```bash
cd VeterinaryBackend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp env.example .env
```

Update the `.env` file with your configuration:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/veterinary_db
JWT_SECRET=your_very_secure_jwt_secret_key_here
REFRESH_TOKEN_SECRET=your_very_secure_refresh_token_secret_here
```

### 3. Create Upload Directories

The upload directories will be created automatically when the server starts, but you can create them manually:

```bash
mkdir -p uploads/profiles
mkdir -p uploads/veterinarian-docs
mkdir -p uploads/clinics
mkdir -p uploads/products
mkdir -p uploads/pets
mkdir -p uploads/blogs
mkdir -p uploads/pet-stores
mkdir -p uploads/general
mkdir -p uploads/medical-records
```

### 4. Start MongoDB

Make sure MongoDB is running on your system:

```bash
# On Windows
net start MongoDB

# On macOS/Linux
sudo systemctl start mongod
# or
mongod
```

### 5. Start the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000` (or the PORT specified in .env)

## Testing the API

### Health Check

```bash
curl http://localhost:5000/api/health
```

### Register a Pet Owner

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "password": "password123",
    "role": "PET_OWNER"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Create a Pet (requires authentication)

```bash
curl -X POST http://localhost:5000/api/pets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Buddy",
    "species": "DOG",
    "breed": "Golden Retriever",
    "gender": "MALE",
    "dateOfBirth": "2020-01-15"
  }'
```

## Project Structure

```
VeterinaryBackend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.js
│   │   ├── env.js
│   │   └── upload.js
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   ├── services/        # Business logic
│   ├── types/           # Enums and types
│   ├── utils/           # Utility functions
│   ├── app.js           # Express app
│   └── server.js        # Server entry point
├── uploads/             # File uploads
├── package.json
└── README.md
```

## Next Steps

1. Implement remaining controllers and services
2. Add validation schemas using Zod
3. Set up email service for notifications
4. Integrate payment gateways (Stripe/PayPal)
5. Set up Stream.io for video consultations
6. Add Redis for BullMQ queues (optional)

## Troubleshooting

### MongoDB Connection Error

- Ensure MongoDB is running
- Check MONGO_URI in .env file
- Verify MongoDB connection string format

### Port Already in Use

- Change PORT in .env file
- Or kill the process using the port

### JWT Errors

- Ensure JWT_SECRET and REFRESH_TOKEN_SECRET are set in .env
- Use strong, unique secrets in production

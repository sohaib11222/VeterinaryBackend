# 📮 Postman Usage Guide - Veterinary Backend API

**Complete guide to testing the Veterinary Backend API using Postman**

---

## 📋 Table of Contents

1. [Import Postman Collection](#import-postman-collection)
2. [Set Up Environment Variables](#set-up-environment-variables)
3. [Authentication Flow](#authentication-flow)
4. [Testing Different Roles](#testing-different-roles)
5. [Testing Protected Routes](#testing-protected-routes)
6. [Validating Role Permissions](#validating-role-permissions)
7. [Confirming Database Changes](#confirming-database-changes)
8. [Common Testing Scenarios](#common-testing-scenarios)
9. [Troubleshooting](#troubleshooting)

---

## Import Postman Collection

### Step 1: Download Collection File

The collection file is located at:
```
VeterinaryBackend/COMPLETE_POSTMAN_COLLECTION.json
```

### Step 2: Import into Postman

1. **Open Postman**
2. **Click "Import" button** (top left)
3. **Select "File" tab**
4. **Click "Upload Files"**
5. **Select `COMPLETE_POSTMAN_COLLECTION.json`**
6. **Click "Import"**

You should now see "Veterinary Backend - Complete API Collection" in your collections.

### Step 3: Verify Collection Structure

The collection should be organized into folders:
- 🔐 Authentication
- 🐾 Pet Management
- 👤 Pet Owner
- 👨‍⚕️ Veterinarian
- 📅 Appointments
- 🏥 Medical Records
- 💉 Vaccinations
- ⚖️ Weight Records
- 🛍️ Products
- 🛒 Orders
- ⭐ Reviews
- 💬 Chat
- 📹 Video Sessions
- 🔔 Notifications
- 👑 Admin
- 📤 File Upload
- 🏥 Specializations
- 💳 Subscriptions
- 🏪 Pet Stores
- 🔍 System Utilities

---

## Set Up Environment Variables

### Create Environment

1. **Click "Environments"** (left sidebar)
2. **Click "+" button** to create new environment
3. **Name it**: "Veterinary Local" (or "Veterinary Production")
4. **Add Variables:**

| Variable | Initial Value | Current Value |
|----------|--------------|---------------|
| `base_url` | `http://localhost:5000/api` | `http://localhost:5000/api` |
| `pet_owner_token` | (empty) | (will be set automatically) |
| `pet_owner_refresh_token` | (empty) | (will be set automatically) |
| `veterinarian_token` | (empty) | (will be set automatically) |
| `veterinarian_refresh_token` | (empty) | (will be set automatically) |
| `admin_token` | (empty) | (will be set automatically) |
| `pet_id` | (empty) | (will be set automatically) |
| `appointment_id` | (empty) | (will be set automatically) |
| `veterinarian_id` | (empty) | (will be set automatically) |
| `order_id` | (empty) | (will be set automatically) |
| `product_id` | (empty) | (will be set automatically) |
| `pet_store_id` | (empty) | (will be set automatically) |
| `subscription_plan_id` | (empty) | (will be set automatically) |

5. **Click "Save"**

### Select Environment

1. **Click dropdown** (top right, next to "Environments")
2. **Select "Veterinary Local"**

---

## Authentication Flow

### Step 1: Register Pet Owner

1. **Navigate to**: `🔐 Authentication` → `Register Pet Owner`
2. **Click "Send"**
3. **Check Response:**
   - Status: `201 Created`
   - Response body should contain `token` and `refreshToken`
4. **Verify Environment Variables:**
   - `pet_owner_token` should be set automatically
   - `pet_owner_refresh_token` should be set automatically
   - `pet_owner_id` should be set automatically

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration successful",
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

### Step 2: Register Veterinarian

1. **Navigate to**: `🔐 Authentication` → `Register Veterinarian`
2. **Update Request Body:**
   ```json
   {
     "name": "Dr. Jane Smith",
     "email": "jane@example.com",
     "phone": "+1234567891",
     "password": "password123",
     "role": "VETERINARIAN"
   }
   ```
3. **Click "Send"**
4. **Note**: Veterinarian status will be `PENDING` (requires admin approval)

### Step 3: Login

1. **Navigate to**: `🔐 Authentication` → `Login`
2. **Update Request Body** with registered email:
   ```json
   {
     "email": "john@example.com",
     "password": "password123"
   }
   ```
3. **Click "Send"**
4. **Verify**: Token should be saved automatically based on user role

---

## Testing Different Roles

### Test as Pet Owner

1. **Ensure you're logged in as Pet Owner**
   - Token should be in `pet_owner_token` environment variable

2. **Test Pet Owner Routes:**
   - ✅ `GET /pet-owners/dashboard` - Should work
   - ✅ `POST /pets` - Should work
   - ✅ `GET /pets` - Should work
   - ❌ `GET /veterinarians/dashboard` - Should fail (403 Forbidden)
   - ❌ `POST /admin/dashboard` - Should fail (403 Forbidden)

### Test as Veterinarian

1. **Login as Veterinarian:**
   - Use veterinarian email/password
   - Token saved to `veterinarian_token`

2. **Test Veterinarian Routes:**
   - ✅ `GET /veterinarians/dashboard` - Should work
   - ✅ `GET /veterinarians/profile` - Should work
   - ✅ `POST /appointments/:id/accept` - Should work
   - ❌ `GET /pet-owners/dashboard` - Should fail (403 Forbidden)
   - ❌ `POST /admin/dashboard` - Should fail (403 Forbidden)

### Test as Admin

1. **Create Admin User** (via database or seeder):
   ```javascript
   // In MongoDB
   db.users.insertOne({
     name: "Admin User",
     email: "admin@example.com",
     password: "$2a$10$...", // hashed password
     role: "ADMIN",
     status: "APPROVED"
   })
   ```

2. **Login as Admin:**
   - Use admin email/password
   - Token saved to `admin_token`

3. **Test Admin Routes:**
   - ✅ `GET /admin/dashboard` - Should work
   - ✅ `POST /auth/approve-veterinarian` - Should work
   - ✅ `GET /admin/users` - Should work
   - ❌ `POST /pets` - Should fail (403 Forbidden - wrong role)

---

## Testing Protected Routes

### Understanding Authentication

**Protected routes require:**
- `Authorization` header
- Format: `Bearer <token>`
- Token obtained from login/register

### Example: Create Pet (Protected Route)

1. **Navigate to**: `🐾 Pet Management` → `Create Pet`
2. **Check Headers:**
   - Should have: `Authorization: Bearer {{pet_owner_token}}`
3. **Update Request Body:**
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
4. **Click "Send"**
5. **Expected Response:**
   - Status: `201 Created`
   - `pet_id` should be saved automatically

### Test Without Token (Should Fail)

1. **Remove Authorization Header:**
   - Click on "Headers" tab
   - Delete the `Authorization` header
2. **Click "Send"**
3. **Expected Response:**
   - Status: `401 Unauthorized`
   - Message: "Not authorized, no token"

### Test With Invalid Token (Should Fail)

1. **Set Invalid Token:**
   - In environment, set `pet_owner_token` to "invalid_token"
2. **Click "Send"**
3. **Expected Response:**
   - Status: `401 Unauthorized`
   - Message: "Not authorized, token failed"

---

## Validating Role Permissions

### Test 1: Pet Owner Cannot Access Veterinarian Routes

1. **Set Token:**
   - Use `pet_owner_token` in environment

2. **Try Veterinarian Route:**
   - `GET /veterinarians/dashboard`
   - Headers: `Authorization: Bearer {{pet_owner_token}}`

3. **Expected Response:**
   ```json
   {
     "success": false,
     "message": "Access denied. Insufficient permissions"
   }
   ```
   - Status: `403 Forbidden`

### Test 2: Veterinarian Cannot Access Admin Routes

1. **Set Token:**
   - Use `veterinarian_token` in environment

2. **Try Admin Route:**
   - `GET /admin/dashboard`
   - Headers: `Authorization: Bearer {{veterinarian_token}}`

3. **Expected Response:**
   - Status: `403 Forbidden`
   - Message: "Access denied. Insufficient permissions"

### Test 3: Public Routes (No Authentication)

1. **Remove Authorization Header**
2. **Test Public Routes:**
   - ✅ `GET /api/health` - Should work
   - ✅ `GET /veterinarians` - Should work (list veterinarians)
   - ✅ `GET /products` - Should work
   - ✅ `GET /specializations` - Should work

---

## Confirming Database Changes

### Method 1: Using MongoDB Compass

1. **Connect to MongoDB:**
   - Local: `mongodb://localhost:27017`
   - Atlas: Your connection string

2. **Navigate to Database:**
   - Database: `veterinary_db`
   - Collection: `users`, `pets`, `appointments`, etc.

3. **Verify Data:**
   - After creating a pet, check `pets` collection
   - After creating appointment, check `appointments` collection

### Method 2: Using MongoDB Shell

```bash
# Connect to MongoDB
mongosh

# Or for Atlas
mongosh "your_connection_string"

# Switch to database
use veterinary_db

# View collections
show collections

# Query users
db.users.find().pretty()

# Query pets
db.pets.find().pretty()

# Query appointments
db.appointments.find().pretty()

# Count documents
db.pets.countDocuments()
```

### Method 3: Using Postman Response

1. **Check Response Data:**
   - After `POST /pets`, response contains created pet with `_id`
   - Save `_id` to environment variable

2. **Verify with GET Request:**
   - Use saved `pet_id` in `GET /pets/:id`
   - Should return the same pet

### Example Workflow

1. **Create Pet:**
   ```
   POST /pets
   Response: { "_id": "507f1f77bcf86cd799439011", ... }
   → pet_id saved to environment
   ```

2. **Get Pet:**
   ```
   GET /pets/{{pet_id}}
   Response: { "_id": "507f1f77bcf86cd799439011", ... }
   → Verify it matches created pet
   ```

3. **Check Database:**
   ```bash
   mongosh
   use veterinary_db
   db.pets.findOne({ _id: ObjectId("507f1f77bcf86cd799439011") })
   ```

---

## Common Testing Scenarios

### Scenario 1: Complete Pet Owner Flow

1. **Register Pet Owner** → Get token
2. **Create Pet** → Get pet_id
3. **List Pets** → Verify pet appears
4. **Update Pet** → Verify changes
5. **Create Appointment** → Get appointment_id
6. **List Appointments** → Verify appointment appears

### Scenario 2: Complete Veterinarian Flow

1. **Register Veterinarian** → Status: PENDING
2. **Login as Admin** → Approve veterinarian
3. **Login as Veterinarian** → Get token
4. **Update Profile** → Add specializations
5. **List Appointments** → See pending appointments
6. **Accept Appointment** → Change status to CONFIRMED

### Scenario 3: Complete Appointment Flow

1. **Pet Owner Creates Appointment** → Status: PENDING
2. **Veterinarian Lists Appointments** → Sees pending appointment
3. **Veterinarian Accepts Appointment** → Status: CONFIRMED
4. **Pet Owner Views Appointment** → Status: CONFIRMED
5. **Veterinarian Completes Appointment** → Status: COMPLETED
6. **Pet Owner Creates Review** → Review linked to appointment

### Scenario 4: Product Order Flow

1. **Veterinarian Creates Product** → Product created
2. **Pet Owner Views Products** → Sees product
3. **Pet Owner Creates Order** → Order: PENDING
4. **Pet Store Owner Updates Order** → Order: CONFIRMED
5. **Pet Store Owner Ships Order** → Order: SHIPPED
6. **Pet Owner Receives Order** → Order: DELIVERED

---

## Troubleshooting

### Issue: "Token not found" Error

**Solution:**
1. Check environment is selected (top right)
2. Verify token variable name matches
3. Run login/register request first
4. Check "Tests" tab - token should be saved automatically

### Issue: "401 Unauthorized" on Protected Routes

**Checklist:**
1. ✅ Is Authorization header present?
2. ✅ Is token format correct? (`Bearer <token>`)
3. ✅ Is token expired? (Try refresh token)
4. ✅ Is environment variable set correctly?

### Issue: "403 Forbidden" Error

**Solution:**
- You're using wrong role's token
- Use correct token for the route:
  - Pet Owner routes → `pet_owner_token`
  - Veterinarian routes → `veterinarian_token`
  - Admin routes → `admin_token`

### Issue: Environment Variables Not Updating

**Solution:**
1. Check "Tests" tab in request
2. Verify script is saving to environment:
   ```javascript
   pm.environment.set("pet_owner_token", response.data.token);
   ```
3. Manually set in environment if needed

### Issue: Request Returns "Coming soon"

**Solution:**
- This endpoint is not yet implemented
- Check `IMPLEMENTATION_STATUS.md` for implementation status
- Only implemented endpoints will return actual data

### Issue: CORS Error

**Solution:**
- Ensure backend server is running
- Check `base_url` in environment matches server URL
- Verify CORS is configured in backend (should allow all origins in dev)

---

## Best Practices

1. **Always Test in Order:**
   - Register → Login → Use token → Test routes

2. **Save IDs Automatically:**
   - Use "Tests" tab to save IDs from responses
   - Makes subsequent requests easier

3. **Use Environment Variables:**
   - Don't hardcode tokens or IDs
   - Use `{{variable_name}}` syntax

4. **Verify Responses:**
   - Check status codes
   - Verify response structure
   - Confirm data matches expectations

5. **Test Error Cases:**
   - Invalid tokens
   - Missing required fields
   - Wrong role permissions
   - Invalid data formats

---

## Quick Reference

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

### Common Headers
- `Content-Type: application/json` - For POST/PUT requests
- `Authorization: Bearer <token>` - For protected routes

### Environment Variables
- `{{base_url}}` - API base URL
- `{{pet_owner_token}}` - Pet owner JWT token
- `{{veterinarian_token}}` - Veterinarian JWT token
- `{{admin_token}}` - Admin JWT token
- `{{pet_id}}` - Pet ID (set after creating pet)
- `{{appointment_id}}` - Appointment ID (set after creating appointment)

---

**Happy Testing!** 🚀

Use this guide to test all backend functionality end-to-end using Postman.

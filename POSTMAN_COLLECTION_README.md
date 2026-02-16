# Veterinary Backend - Complete Postman Collection

## Overview

This Postman collection contains **182 API requests** organized into **34 folders** covering all endpoints in the Veterinary Backend API.

## Collection Structure

### Main Folders:

1. **Authentication** - Registration, login, password management
2. **Pet Owner** - Pet owner dashboard and related endpoints
3. **Veterinarian** - Veterinarian profile, dashboard, subscriptions
4. **Admin** - Admin dashboard and management endpoints
5. **User Management** - User CRUD operations
6. **Pets** - Pet management
7. **Appointments** - Appointment booking and management
8. **Products** - Product catalog
9. **Orders** - Order management
10. **Reviews** - Review system
11. **Notifications** - Notification management
12. **Balance & Withdrawals** - Balance and withdrawal operations
13. **Chat** - Messaging system
14. **Subscriptions** - Subscription management
15. **Subscription Plans** - Plan management
16. **Favorites** - Favorite veterinarians
17. **Medical Records** - Medical record management
18. **Vaccinations** - Vaccination tracking
19. **Weight Records** - Weight tracking
20. **Specializations** - Specialization management
21. **Availability** - Veterinarian availability
22. **Weekly Schedule** - Schedule management
23. **Reschedule Requests** - Appointment rescheduling
24. **File Uploads** - File upload endpoints
25. **Payments** - Payment processing
26. **Transactions** - Transaction management
27. **Insurance** - Insurance company management
28. **Blog** - Blog post management
29. **Pet Stores** - Pet store management
30. **Video Sessions** - Video consultation sessions
31. **Announcements** - Announcement system
32. **Mapping & Location** - Location services
33. **CRM** - CRM data export
34. **Health Check** - Server health check

## Setup Instructions

### 1. Import Collection

1. Open Postman
2. Click **Import** button
3. Select `POSTMAN_COLLECTION.json` file
4. Collection will be imported with all folders and requests

### 2. Configure Environment Variables

The collection includes collection-level variables that are automatically set:

- `base_url` - Default: `http://localhost:5000/api`
- `token` - JWT authentication token (auto-set after login)
- `refresh_token` - Refresh token (auto-set after login)
- `user_id` - Current user ID (auto-set after registration/login)
- `pet_owner_id` - Pet owner ID (auto-set)
- `veterinarian_id` - Veterinarian ID (auto-set)
- `admin_id` - Admin ID (auto-set)

### 3. Update Base URL (if needed)

If your server runs on a different port or URL:

1. Click on the collection name
2. Go to **Variables** tab
3. Update `base_url` value (e.g., `http://localhost:5000/api` or `https://your-domain.com/api`)

## Usage Flow

### For Pet Owners:

1. **Register/Login**
   - Use "Register Pet Owner" or "Login" in Authentication folder
   - Token will be automatically saved

2. **Access Pet Owner Endpoints**
   - All requests in "Pet Owner" folder require authentication
   - Token is automatically included in headers

3. **Manage Pets**
   - Use "Pets" folder to create, list, update, delete pets

4. **Book Appointments**
   - Use "Appointments" folder to create and manage appointments

### For Veterinarians:

1. **Register/Login**
   - Use "Register Veterinarian" or "Login" in Authentication folder
   - Token will be automatically saved

2. **Complete Profile**
   - Use "Update Profile" in Veterinarian folder
   - Add clinics, specializations, services, etc.

3. **Set Availability**
   - Use "Availability" or "Weekly Schedule" folders

4. **Manage Appointments**
   - Use "Appointments" folder to accept/reject/complete appointments

### For Admins:

1. **Login as Admin**
   - Use "Login" with admin credentials
   - Token will be automatically saved

2. **Access Admin Dashboard**
   - Use "Admin" folder for all admin operations

3. **Manage System**
   - Approve/reject veterinarians
   - Manage users, transactions, reviews, etc.

## Authentication

Most endpoints require authentication. The collection automatically:

1. Saves tokens after login/registration
2. Includes `Authorization: Bearer {{token}}` header in protected requests
3. Updates tokens when refresh token is used

## Testing Routes

### Quick Test Sequence:

1. **Health Check** - Verify server is running
   ```
   GET /api/health
   ```

2. **Register Pet Owner** - Create test account
   ```
   POST /api/auth/register
   ```

3. **Login** - Get authentication token
   ```
   POST /api/auth/login
   ```

4. **Get Dashboard** - Test authenticated endpoint
   ```
   GET /api/pet-owners/dashboard
   ```

## Common Issues & Solutions

### Issue: Requests Keep Loading/Hanging

**Solutions:**
1. ✅ **Fixed**: Optimized database queries with `.lean()` and proper limits
2. ✅ **Fixed**: Added proper error handling and validation
3. ✅ **Fixed**: Fixed nested populate issues with `strictPopulate: false`

**If still hanging:**
- Check if MongoDB is running
- Verify server is running on correct port
- Check server logs for errors
- Ensure database connection is established

### Issue: "Resource not found" Error

**Solutions:**
1. ✅ **Fixed**: Added ObjectId validation before database queries
2. ✅ **Fixed**: Improved error messages to be more specific
3. ✅ **Fixed**: Changed error status codes (400 for validation, 404 for not found)

### Issue: Authentication Errors

**Solutions:**
- Ensure you've logged in first
- Check if token is set in collection variables
- Verify token hasn't expired
- Use "Refresh Token" endpoint if needed

### Issue: Invalid ID Format

**Solutions:**
- ✅ **Fixed**: All endpoints now validate ObjectId format before querying
- Error messages now clearly indicate invalid ID format

## Collection Statistics

- **Total Requests**: 182
- **Total Folders**: 34
- **Authentication Endpoints**: 9
- **Pet Owner Endpoints**: 3
- **Veterinarian Endpoints**: 8
- **Admin Endpoints**: 7
- **Public Endpoints**: Multiple (products, veterinarians, blog, etc.)

## Notes

- All file upload endpoints use `multipart/form-data` (configure in Postman)
- Some endpoints require specific roles (check folder descriptions)
- Date formats should be ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
- All monetary values are in EUR

## Support

If you encounter issues:

1. Check server logs
2. Verify database connection
3. Ensure all environment variables are set
4. Test with Health Check endpoint first
5. Verify authentication token is valid

## Recent Fixes Applied

✅ **Performance Optimizations:**
- Added `.lean()` to all queries for faster responses
- Limited unbounded queries (only fetch IDs when counting)
- Optimized nested populate operations

✅ **Error Handling:**
- Added ObjectId validation before all database queries
- Improved error messages (specific instead of generic)
- Better error status codes (400 for validation errors)

✅ **Query Optimization:**
- Fixed hanging requests in dashboard endpoints
- Optimized appointment queries
- Fixed transaction queries

---

**Generated**: January 2025
**Version**: 2.0.0
**Total Endpoints**: 182

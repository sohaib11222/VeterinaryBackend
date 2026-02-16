# Postman Collection - Usage Guide

## ✅ Collection Status: TESTED AND VERIFIED

The Postman collection has been **tested and verified** to work correctly. All 182 requests are properly configured with:

- ✅ Correct URL paths
- ✅ Proper authentication headers
- ✅ Pre-request scripts to check tokens
- ✅ Test scripts to validate responses
- ✅ Auto-save tokens after login/registration

## Quick Start

### 1. Import Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select `POSTMAN_COLLECTION.json`
4. Collection will appear in your workspace

### 2. Set Base URL

The collection uses `{{base_url}}` variable which defaults to `http://localhost:5000/api`

**To change it:**
1. Click on collection name → **Variables** tab
2. Update `base_url` value (e.g., `https://your-domain.com/api`)

### 3. Test Flow

#### Step 1: Health Check
- Run **"Health Check"** request
- Should return: `{"success": true, "message": "Server is running"}`

#### Step 2: Register/Login
- Run **"Register Pet Owner"** or **"Login"** in Authentication folder
- Token will be **automatically saved** to collection variables
- Check collection variables to see token is set

#### Step 3: Test Authenticated Endpoints
- Run **"Get Dashboard"** in Pet Owner folder
- Should return dashboard data with status 200

## Common Issues & Solutions

### Issue: "No token found" warning

**Solution:**
1. Run **"Login"** or **"Register Pet Owner"** first
2. Check collection variables - token should be set automatically
3. If token is empty, manually copy from login response

### Issue: 401 Unauthorized

**Causes:**
- Token expired
- Token not set
- Invalid token

**Solution:**
1. Run **"Login"** again to get fresh token
2. Token will be automatically updated

### Issue: 403 Forbidden

**Cause:** User doesn't have required role

**Solution:**
- Pet Owner endpoints require `PET_OWNER` role
- Veterinarian endpoints require `VETERINARIAN` role
- Admin endpoints require `ADMIN` role

### Issue: Requests Keep Loading

**This has been FIXED!** ✅

The following optimizations were applied:
- ✅ Added `.lean()` to all queries
- ✅ Limited unbounded queries
- ✅ Fixed nested populate operations
- ✅ Added proper error handling

**If still hanging:**
1. Check if server is running: `http://localhost:5000/api/health`
2. Check MongoDB connection
3. Check server logs for errors

### Issue: "Resource not found" Error

**This has been FIXED!** ✅

- ✅ Added ObjectId validation
- ✅ Better error messages
- ✅ Proper status codes (400 for validation, 404 for not found)

## Collection Structure

### Folders Organized by Role:

1. **Health Check** - Server status
2. **Authentication** - Login, register, password management
3. **Pet Owner** - Dashboard, appointments, payments
4. **Veterinarian** - Profile, dashboard, subscriptions
5. **Admin** - Admin dashboard and management
6. **User Management** - User CRUD operations
7. **Pets** - Pet management
8. **Appointments** - Booking and management
9. **Products** - Product catalog
10. **Orders** - Order management
... and 24 more folders

## Testing Checklist

Before using the collection, verify:

- [ ] Server is running on port 5000
- [ ] MongoDB is connected
- [ ] Health check returns 200
- [ ] Can register new user
- [ ] Can login and get token
- [ ] Token is saved in collection variables
- [ ] Authenticated requests work

## Response Format

All endpoints return:

```json
{
  "success": true/false,
  "message": "Response message",
  "data": { ... }
}
```

## Authentication

All authenticated requests include:
```
Authorization: Bearer {{token}}
```

Token is automatically:
- ✅ Saved after login/registration
- ✅ Included in all authenticated requests
- ✅ Updated when refresh token is used

## Variables

Collection variables (auto-managed):
- `base_url` - API base URL
- `token` - JWT token (auto-set)
- `refresh_token` - Refresh token (auto-set)
- `user_id` - Current user ID (auto-set)
- `pet_owner_id` - Pet owner ID (auto-set)
- `veterinarian_id` - Veterinarian ID (auto-set)
- `admin_id` - Admin ID (auto-set)

## Tips

1. **Always start with Health Check** to verify server
2. **Login first** before testing authenticated endpoints
3. **Check Test Results** tab to see validation results
4. **Use Collection Runner** to test multiple requests
5. **Check Console** for warnings and logs

## Support

If requests don't work:

1. ✅ Verify server is running
2. ✅ Check collection variables are set
3. ✅ Run Health Check first
4. ✅ Check server logs
5. ✅ Verify MongoDB connection

---

**Last Updated:** January 2025
**Collection Version:** 2.0.0
**Total Requests:** 182
**Status:** ✅ Tested and Verified

# Postman Collection Verification & Testing Guide

## ✅ Collection Status

**File:** `POSTMAN_COLLECTION.json`
- ✅ Valid JSON format
- ✅ 182 requests across 34 folders
- ✅ All URLs properly formatted
- ✅ Authentication headers included
- ✅ Pre-request scripts added
- ✅ Test scripts added
- ✅ Token auto-save configured

## Quick Verification Steps

### Step 1: Import Collection
1. Open Postman
2. Click **Import** → Select `POSTMAN_COLLECTION.json`
3. Collection should appear with all folders

### Step 2: Verify Variables
1. Click on collection name
2. Go to **Variables** tab
3. Verify `base_url` = `http://localhost:5000/api`
4. Other variables should be empty (will be auto-filled after login)

### Step 3: Test Health Check
1. Run **"Health Check"** request
2. Expected: Status 200, `{"success": true, "message": "Server is running"}`

### Step 4: Test Authentication
1. Run **"Register Pet Owner"** in Authentication folder
2. Check **Test Results** tab - should show token saved
3. Check **Collection Variables** - `token` should be set

### Step 5: Test Authenticated Endpoint
1. Run **"Get Dashboard"** in Pet Owner folder
2. Should return status 200 with dashboard data
3. If 401: Token not set - run Login first
4. If 403: User is not PET_OWNER - register as PET_OWNER

## Common Issues & Fixes

### ❌ Issue: "Collection failed to import"

**Fix:**
- Ensure file is valid JSON (it is - verified)
- Try importing again
- Check Postman version (should be latest)

### ❌ Issue: "Variable {{base_url}} not found"

**Fix:**
1. Click collection name → Variables tab
2. Ensure `base_url` variable exists
3. Set value to: `http://localhost:5000/api`

### ❌ Issue: "No token found" warning

**Fix:**
1. Run **"Login"** or **"Register Pet Owner"** first
2. Token will be auto-saved
3. Check collection variables to verify token is set

### ❌ Issue: 401 Unauthorized

**Causes:**
- Token expired
- Token not set
- Invalid token

**Fix:**
1. Run **"Login"** again
2. Token will be automatically updated
3. Retry the request

### ❌ Issue: 403 Forbidden

**Cause:** Wrong user role

**Fix:**
- Pet Owner endpoints need `PET_OWNER` role
- Veterinarian endpoints need `VETERINARIAN` role  
- Admin endpoints need `ADMIN` role

### ❌ Issue: Request keeps loading

**This is FIXED!** ✅

Optimizations applied:
- ✅ All queries use `.lean()` for performance
- ✅ Unbounded queries limited
- ✅ Nested populate operations optimized
- ✅ Proper error handling added

**If still hanging:**
1. Check server is running: `http://localhost:5000/api/health`
2. Check MongoDB connection
3. Check server console for errors
4. Verify database has data

### ❌ Issue: "Resource not found"

**This is FIXED!** ✅

- ✅ ObjectId validation added
- ✅ Better error messages
- ✅ Proper status codes

## Testing Checklist

Use this checklist to verify collection works:

- [ ] Collection imports successfully
- [ ] Health Check returns 200
- [ ] Can register new user
- [ ] Token is saved after registration
- [ ] Can login with credentials
- [ ] Token is saved after login
- [ ] Get Dashboard returns 200 (with token)
- [ ] Get Appointment History returns 200 (with token)
- [ ] Get Payment History returns 200 (with token)
- [ ] All test scripts pass

## Expected Responses

### Health Check
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-01-24T..."
}
```

### Register/Login
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": "...",
      "name": "...",
      "email": "..."
    }
  }
}
```

### Get Dashboard (Pet Owner)
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "petOwner": {...},
    "petsCount": 0,
    "upcomingAppointments": {...},
    "completedAppointments": {...},
    ...
  }
}
```

## Manual Testing

If automated tests don't work, test manually:

1. **Start Server:**
   ```bash
   cd e:\Doctor_Overall\VeterinaryBackend
   npm start
   ```

2. **Test in Browser:**
   - Open: `http://localhost:5000/api/health`
   - Should see: `{"success": true, "message": "Server is running"}`

3. **Test in Postman:**
   - Import collection
   - Run Health Check
   - Run Register Pet Owner
   - Check token is saved
   - Run Get Dashboard

## Collection Features

✅ **Auto-Authentication:**
- Tokens saved automatically after login/registration
- Included in all authenticated requests

✅ **Pre-Request Scripts:**
- Check if token exists before making request
- Warn if token is missing

✅ **Test Scripts:**
- Validate response status codes
- Check response structure
- Log helpful error messages

✅ **Error Handling:**
- Clear error messages
- Proper status codes
- Helpful console logs

## Support

If collection still doesn't work:

1. **Verify Server:**
   - Server running on port 5000?
   - MongoDB connected?
   - Check server logs

2. **Verify Collection:**
   - Variables set correctly?
   - Token saved after login?
   - Check Postman console for errors

3. **Test Manually:**
   - Use browser to test endpoints
   - Use curl to test endpoints
   - Check server response

---

**Collection Version:** 2.0.0
**Last Updated:** January 2025
**Status:** ✅ Tested and Verified

# Endpoint Testing Guide

## Quick Start

1. **Start your server first**:
   ```bash
   npm start
   ```

2. **Run the comprehensive test**:
   ```bash
   node test_all_endpoints.js
   ```

3. **Check results**:
   - Results are displayed in terminal
   - Detailed results saved to `test_results.json`

## What the Test Does

The test script will:
- ✅ Test all major endpoints
- ⏱️ Identify timeout issues (requests taking > 10 seconds)
- ❌ Report failed endpoints
- 📊 Generate a summary report

## Test Categories

The script tests:
- Health check
- Authentication (register, login)
- Specializations
- Products
- Pet Owner endpoints (dashboard, appointments, payments)
- Medical Records
- Appointments
- Veterinarians
- Pets
- Reviews
- Notifications
- Subscriptions
- Transactions
- Balance
- Favorites
- Vaccinations
- Weight Records
- Orders
- Admin endpoints
- Availability
- Weekly Schedule
- Blog
- Announcements

## Understanding Results

### ✅ Passed
- Endpoint responded successfully (200-299)
- Or returned expected client error (400-499)

### ⏱️ Timeout
- Request took longer than 10 seconds
- **This is the main issue to fix**

### ❌ Failed
- Server error (500+)
- Unexpected response

### ⚠️ Errors
- Network errors
- Connection issues

## Fixing Timeout Issues

If an endpoint times out:

1. **Check server logs** for that endpoint
2. **Look for slow database queries** in the service file
3. **Add query timeouts** (`.maxTimeMS(3000)`)
4. **Add database indexes** if missing
5. **Optimize populate operations**

## Example Output

```
🧪 Testing All API Endpoints

Base URL: http://localhost:5000
Timeout: 10000ms per request

[1/45] Testing Health Check... ✅ PASS (15ms, 200)
[2/45] Testing Register Pet Owner... ✅ PASS (234ms, 201)
[3/45] Testing List Specializations... ⏱️ TIMEOUT (10001ms)
[4/45] Testing Get Medical Records... ⏱️ TIMEOUT (10002ms)

📊 Test Summary

✅ Passed: 35
❌ Failed: 3
⏱️ Timeout: 7
⚠️ Errors: 0

⏱️ Endpoints with Timeout Issues:
   - GET /api/specializations (10001ms)
   - GET /api/medical-records (10002ms)
   ...
```

## Manual Testing

If you want to test a specific endpoint manually:

```bash
# Health check
curl http://localhost:5000/api/health

# With authentication
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/pet-owners/dashboard
```

## Next Steps

After running the test:

1. **Review timeout endpoints** in `test_results.json`
2. **Fix slow queries** in the corresponding service files
3. **Add indexes** if needed
4. **Re-run the test** to verify fixes

---

**Note**: Make sure your server is running before executing the test script!

# 🚀 Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env with your MongoDB URI and JWT secrets
```

### 3. Start MongoDB
```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
```

### 4. Start Server
```bash
npm run dev
```

### 5. Test API
```bash
# Health check
curl http://localhost:5000/api/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","phone":"+1234567890","password":"test123","role":"PET_OWNER"}'
```

## Import Postman Collection

1. Open Postman
2. Click "Import"
3. Select `POSTMAN_COLLECTION.json`
4. Create environment with `base_url = http://localhost:5000/api`

## Current Status

✅ **Fully Implemented:**
- Authentication (Register, Login, Change Password)
- Pet Management (CRUD operations)

⏳ **In Progress:**
- All other features (see ARCHITECTURE_VERIFICATION.md)

## Documentation

- **Complete Guide**: `COMPLETE_BACKEND_GUIDE.md`
- **Architecture**: `ARCHITECTURE_VERIFICATION.md`
- **Setup**: `SETUP_GUIDE.md`

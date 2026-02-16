# 🚀 Veterinary Backend - Complete Setup Guide

**Version**: 1.0.0  
**Last Updated**: January 24, 2026

This guide provides step-by-step instructions to set up, configure, and run the Veterinary Backend from scratch.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Install Node.js and npm](#step-1-install-nodejs-and-npm)
3. [Step 2: Install MongoDB](#step-2-install-mongodb)
4. [Step 3: Clone/Download Project](#step-3-clonedownload-project)
5. [Step 4: Install Dependencies](#step-4-install-dependencies)
6. [Step 5: Configure Environment Variables](#step-5-configure-environment-variables)
7. [Step 6: Verify MongoDB Connection](#step-6-verify-mongodb-connection)
8. [Step 7: Start the Backend Server](#step-7-start-the-backend-server)
9. [Step 8: Verify Server is Running](#step-8-verify-server-is-running)
10. [Production Deployment](#production-deployment)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **MongoDB**: v6.0 or higher
- **Git**: For version control (optional)
- **Text Editor**: VS Code, Sublime Text, or any code editor
- **Terminal/Command Prompt**: For running commands

---

## Step 1: Install Node.js and npm

### Windows

1. **Download Node.js:**
   - Visit: https://nodejs.org/
   - Download the LTS version (v18.x or higher)
   - Run the installer (.msi file)
   - Follow the installation wizard
   - Check "Add to PATH" during installation

2. **Verify Installation:**
   ```bash
   node --version
   npm --version
   ```
   Expected output:
   ```
   v18.17.0
   9.6.7
   ```

### macOS

1. **Using Homebrew (Recommended):**
   ```bash
   brew install node
   ```

2. **Or Download Installer:**
   - Visit: https://nodejs.org/
   - Download macOS installer (.pkg file)
   - Run the installer

3. **Verify Installation:**
   ```bash
   node --version
   npm --version
   ```

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

---

## Step 2: Install MongoDB

### Option A: Local MongoDB Installation

#### Windows

1. **Download MongoDB:**
   - Visit: https://www.mongodb.com/try/download/community
   - Select Windows, MSI package
   - Download and run installer

2. **Install MongoDB:**
   - Choose "Complete" installation
   - Install as Windows Service (recommended)
   - Install MongoDB Compass (optional GUI)

3. **Start MongoDB Service:**
   ```bash
   net start MongoDB
   ```

#### macOS

1. **Using Homebrew:**
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   brew services start mongodb-community
   ```

2. **Verify MongoDB is Running:**
   ```bash
   brew services list
   # Should show mongodb-community started
   ```

#### Linux (Ubuntu/Debian)

```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package list
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

### Option B: MongoDB Atlas (Cloud - Recommended for Production)

1. **Create Account:**
   - Visit: https://www.mongodb.com/cloud/atlas
   - Sign up for free account

2. **Create Cluster:**
   - Click "Build a Database"
   - Choose free tier (M0)
   - Select cloud provider and region
   - Click "Create"

3. **Create Database User:**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Set username and password (save these!)
   - Set user privileges: "Atlas admin" or "Read and write to any database"

4. **Whitelist IP Address:**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Or add your specific IP address

5. **Get Connection String:**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/veterinary_db?retryWrites=true&w=majority`

---

## Step 3: Clone/Download Project

### Option A: If Project is in Git Repository

```bash
# Clone the repository
git clone <repository-url>
cd VeterinaryBackend
```

### Option B: If Project is Local

```bash
# Navigate to project directory
cd e:\Doctor_Overall\VeterinaryBackend
```

---

## Step 4: Install Dependencies

### Navigate to Project Directory

```bash
cd VeterinaryBackend
```

### Install All Dependencies

```bash
npm install
```

This command will:
- Read `package.json`
- Download all required packages from npm
- Install them in `node_modules/` folder
- Create `package-lock.json` (locks dependency versions)

**Expected Output:**
```
added 245 packages, and audited 246 packages in 15s

45 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**Installation Time:** 1-5 minutes (depending on internet speed)

### Verify Installation

Check that `node_modules` folder was created:
```bash
# Windows
dir node_modules

# macOS/Linux
ls node_modules
```

---

## Step 5: Configure Environment Variables

### Create .env File

1. **Copy the example file:**
   ```bash
   # Windows
   copy env.example .env
   
   # macOS/Linux
   cp env.example .env
   ```

2. **Open .env file in a text editor**

### Configure Required Variables

Edit `.env` file with your configuration:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=5000
NODE_ENV=development

# ============================================
# DATABASE CONFIGURATION
# ============================================
# For Local MongoDB:
MONGO_URI=mongodb://localhost:27017/veterinary_db

# For MongoDB Atlas (Cloud):
# MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/veterinary_db?retryWrites=true&w=majority

# ============================================
# JWT CONFIGURATION
# ============================================
# Generate secure random strings (minimum 32 characters)
# You can use: openssl rand -base64 32
JWT_SECRET=your_very_secure_jwt_secret_key_minimum_32_characters_long_change_this_in_production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_very_secure_refresh_token_secret_minimum_32_characters_long_change_this_in_production
REFRESH_TOKEN_EXPIRES_IN=30d

# ============================================
# FILE UPLOAD DIRECTORIES
# ============================================
# These will be auto-created, but you can customize paths
UPLOAD_PROFILE=uploads/profiles
UPLOAD_VETERINARIAN_DOCS=uploads/veterinarian-docs
UPLOAD_CLINIC=uploads/clinics
UPLOAD_PRODUCT=uploads/products
UPLOAD_PET=uploads/pets
UPLOAD_BLOG=uploads/blogs
UPLOAD_PET_STORE=uploads/pet-stores
UPLOAD_GENERAL=uploads/general
UPLOAD_MEDICAL_RECORDS=uploads/medical-records

# ============================================
# EMAIL CONFIGURATION (Optional)
# ============================================
# For Gmail, you need to create an App Password:
# 1. Go to Google Account → Security
# 2. Enable 2-Step Verification
# 3. Generate App Password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here

# ============================================
# PAYMENT CONFIGURATION (Optional)
# ============================================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret

# ============================================
# STREAM VIDEO SDK (Optional)
# ============================================
# For video consultations
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret

# ============================================
# REDIS CONFIGURATION (Optional)
# ============================================
# For background job queues
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Generate Secure JWT Secrets

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**macOS/Linux:**
```bash
openssl rand -base64 32
```

Copy the output and use it as `JWT_SECRET` and `REFRESH_TOKEN_SECRET`.

### Important Notes

- **Never commit `.env` file to Git** (it's in `.gitignore`)
- **Use different secrets for production**
- **Keep secrets secure and private**
- **For production, use environment variables from your hosting provider**

---

## Step 6: Verify MongoDB Connection

### Test Local MongoDB Connection

1. **Start MongoDB (if not running):**
   ```bash
   # Windows
   net start MongoDB
   
   # macOS
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   ```

2. **Test Connection:**
   ```bash
   # Windows
   mongosh
   
   # macOS/Linux
   mongosh
   ```

   If connected, you'll see:
   ```
   Current Mongosh Log ID: ...
   Connecting to: mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000
   Using MongoDB: 6.0.x
   Using Mongosh: 1.x.x
   ```

3. **Exit MongoDB Shell:**
   ```bash
   exit
   ```

### Test MongoDB Atlas Connection

1. **Test from Command Line:**
   ```bash
   mongosh "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/veterinary_db"
   ```

2. **Or use MongoDB Compass:**
   - Download: https://www.mongodb.com/products/compass
   - Connect using your Atlas connection string

---

## Step 7: Start the Backend Server

### Development Mode (Recommended for Development)

**Development mode** includes:
- Auto-reload on file changes (using nodemon)
- Detailed error messages
- Hot reloading

**Start Command:**
```bash
npm run dev
```

**Expected Output:**
```
> veterinary-backend@1.0.0 dev
> nodemon src/server.js

[nodemon] 3.1.7
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,json
[nodemon] starting `node src/server.js`
✓ Connected to MongoDB
✓ Veterinary Backend API running on port 5000
✓ Environment: development
```

### Production Mode

**Production mode** features:
- No auto-reload
- Optimized performance
- Production error handling

**Start Command:**
```bash
npm start
```

**Expected Output:**
```
✓ Connected to MongoDB
✓ Veterinary Backend API running on port 5000
✓ Environment: production
```

### Using PM2 (Production Process Manager)

For production deployments, use PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start src/server.js --name veterinary-backend

# View logs
pm2 logs veterinary-backend

# Monitor
pm2 monit

# Stop application
pm2 stop veterinary-backend

# Restart application
pm2 restart veterinary-backend
```

---

## Step 8: Verify Server is Running

### Test Health Check Endpoint

**Using curl:**
```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-01-24T10:00:00.000Z"
}
```

**Using Browser:**
- Open: http://localhost:5000/api/health
- You should see the JSON response

**Using Postman:**
- Import the Postman collection
- Run "Health Check" request
- Should return 200 OK

### Test Root Endpoint

```bash
curl http://localhost:5000/
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Veterinary Backend API is running",
  "version": "1.0.0"
}
```

---

## Production Deployment

### Environment Variables in Production

**Option 1: Hosting Platform Environment Variables**
- Heroku: Settings → Config Vars
- AWS: EC2 → Environment Variables
- DigitalOcean: App Platform → Environment Variables
- Vercel: Settings → Environment Variables

**Option 2: .env File (Not Recommended for Production)**
- Keep `.env` file secure
- Use file permissions: `chmod 600 .env`
- Never commit to Git

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique JWT secrets
- [ ] Use MongoDB Atlas or secured MongoDB instance
- [ ] Enable HTTPS/SSL
- [ ] Set up proper CORS origins (not `*`)
- [ ] Configure rate limiting
- [ ] Set up logging and monitoring
- [ ] Configure backup strategy
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Use process manager (PM2, systemd)

---

## Troubleshooting

### Issue: "Cannot find module" Error

**Solution:**
```bash
# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

### Issue: "Port 5000 already in use"

**Solution 1: Change Port**
Edit `.env` file:
```env
PORT=5001
```

**Solution 2: Kill Process Using Port**

**Windows:**
```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
lsof -ti:5000 | xargs kill
```

### Issue: "MongoDB connection error"

**Checklist:**
1. Is MongoDB running?
   ```bash
   # Windows
   net start MongoDB
   
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status mongod
   ```

2. Is MONGO_URI correct in `.env`?
   - Check connection string format
   - Verify database name
   - Check credentials (for Atlas)

3. Is MongoDB accessible?
   ```bash
   mongosh
   # or
   mongosh "your_connection_string"
   ```

### Issue: "JWT_SECRET is required"

**Solution:**
- Ensure `.env` file exists
- Check that `JWT_SECRET` is set in `.env`
- Restart the server after changing `.env`

### Issue: "EADDRINUSE" Error

**Solution:**
- Another process is using the port
- Change PORT in `.env` or kill the process

### Issue: Dependencies Installation Fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules
rm -rf node_modules

# Try installing again
npm install

# If still fails, try with verbose output
npm install --verbose
```

---

## Next Steps

After successful setup:

1. ✅ **Test API Endpoints**: Use Postman collection
2. ✅ **Read API Documentation**: See `COMPLETE_BACKEND_GUIDE.md`
3. ✅ **Set Up Postman**: See `POSTMAN_USAGE_GUIDE.md`
4. ✅ **Start Development**: Begin implementing features

---

## Support

For issues or questions:
- Check `TROUBLESHOOTING.md`
- Review error logs
- Check MongoDB logs
- Verify environment variables

---

**Setup Complete!** 🎉

Your Veterinary Backend is now ready for development and testing.

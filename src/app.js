const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");
const timeout = require("./middleware/timeout");

require("./config/env"); // load ENV

const app = express();

// General API requests should fail quickly, but chat uploads can legitimately
// take longer on mobile connections (each file may be up to 50 MB).
app.use((req, res, next) => {
  const requestTimeout = req.path.startsWith('/api/upload/') || req.path.startsWith('/api/support-tickets/attachments') ? 120000 : 30000;
  return timeout(requestTimeout)(req, res, next);
});

// CORS configuration - Allow all origins
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  credentials: false,
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging
app.use(requestLogger);

const uploadsDir = path.join(__dirname, "..", "uploads");

// Ticket evidence contains private patient information. It must be retrieved
// through the authenticated support-ticket download route, never as a public
// static upload.
app.use(['/uploads/support-tickets', '/api/uploads/support-tickets'], (req, res) => {
  res.status(404).json({ success: false, message: 'File not found' });
});

// Serve static files from uploads directory
app.use("/uploads", express.static(uploadsDir, {
  setHeaders: (res, path) => {
    // Set explicit browser-safe headers for images and verification PDFs.
    if (path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    if (path.match(/\.pdf$/i)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }
}));

app.use("/api/uploads", express.static(uploadsDir, {
  setHeaders: (res, path) => {
    if (path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    if (path.match(/\.pdf$/i)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }
}));

// Mount all API routes
app.use("/api", routes);

// Root path handler
app.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "Veterinary Backend API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Catch-all for non-API routes
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    next();
  } else {
    res.status(404).json({
      success: false,
      message: "Route not found",
      path: req.path
    });
  }
});

// Global error handler (last)
app.use(errorHandler);

module.exports = app;

const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");
const timeout = require("./middleware/timeout");

require("./config/env"); // load ENV

const app = express();

// Set request timeout (30 seconds)
app.use(timeout(30000));

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

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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

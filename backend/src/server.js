require('dotenv').config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");   // registration / login / forgot-password
const sendOtpRoutes = require("./routes/auth");        // send-otp
const { testConnection } = require("./config/database");
const userRoutes = require("./routes/users");
const pollRoutes = require("./routes/polls");
const locationRoutes = require("./routes/locations");
const prayerRoutes = require("./routes/prayers");

const app = express();

// Allow all origins in development; lock down via CORS_ORIGIN env var in production
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Sehri backend is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/auth", sendOtpRoutes);
app.use("/api/users", userRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/locations", locationRoutes);   // public — used by registration screen
app.use("/api/prayers", prayerRoutes);

const PORT = process.env.PORT || 5000;

testConnection()
  .then(() => {
    // Bind to 0.0.0.0 so phones on the same network (or via ngrok) can reach the server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to the database:", err.message);
    process.exit(1);
  });

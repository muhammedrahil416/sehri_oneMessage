require('dotenv').config();
const express = require("express");
const authRoutes = require("./routes/authRoutes");   // teammate's registration route (unchanged)
const sendOtpRoutes = require("./routes/auth");        // your OTP route
const { testConnection } = require("./config/database"); // your DB connection

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  console.log("Request received!");
  res.send("Sehri backend is running");
});

app.use("/api/auth", authRoutes);      // handles /api/auth/register (their code)
app.use("/api/auth", sendOtpRoutes);   // handles /api/auth/send-otp (your code)

const PORT = process.env.PORT || 5000;

// Confirm the DB is reachable before accepting any requests
testConnection()
  .then(() => {
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`Server running at http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to the database:", err.message);
    process.exit(1);
  });

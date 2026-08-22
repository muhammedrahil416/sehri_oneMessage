const express = require("express");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  console.log("Request received!");
  res.send("Sehri backend is running");
});

app.use("/api/auth", authRoutes);

const PORT = 5000;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
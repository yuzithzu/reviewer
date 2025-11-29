const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public")); // serve frontend files

const DB_FILE = path.join(__dirname, "users.json");

// Load users database
function loadUsers() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

// Save users database
function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// Login route
app.post("/api/login", (req, res) => {
  const { username, password, deviceHash } = req.body;
  const users = loadUsers();
  const user = users[username.toLowerCase()];

  if (!user || user.pass !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (user.isBlocked) {
    return res.status(403).json({ message: "Account blocked" });
  }
  // Check device hash binding
  if (!user.deviceHash) {
    user.deviceHash = deviceHash;
    saveUsers(users);
  } else if (user.deviceHash !== deviceHash) {
    return res.status(403).json({ message: "Device mismatch. Access denied." });
  }
  return res.json({ success: true, role: user.role });
});

// Admin routes (add/block/unblock/reset)
app.post("/api/admin/addUser", (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ message: "Missing fields" });
  const users = loadUsers();
  if (users[username.toLowerCase()]) {
    return res.status(400).json({ message: "User already exists" });
  }
  users[username.toLowerCase()] = { pass: password, role, isBlocked: false };
  saveUsers(users);
  return res.json({ success: true });
});

app.post("/api/admin/blockUser", (req, res) => {
  const { username, block } = req.body;
  const users = loadUsers();
  const user = users[username.toLowerCase()];
  if (!user) return res.status(404).json({ message: "User not found" });
  user.isBlocked = Boolean(block);
  saveUsers(users);
  return res.json({ success: true });
});

app.post("/api/admin/resetDevice", (req, res) => {
  const { username } = req.body;
  const users = loadUsers();
  const user = users[username.toLowerCase()];
  if (!user) return res.status(404).json({ message: "User not found" });
  delete user.deviceHash;
  saveUsers(users);
  return res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

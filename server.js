const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, "users.json");

app.use(cors());
app.use(express.json());

// Load users from file
function loadUsers() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

// Save users to file
function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// Public user data (without password)
function publicUsers(users) {
  return Object.entries(users).reduce((acc, [uname, data]) => {
    acc[uname] = {
      role: data.role,
      isBlocked: data.isBlocked || false,
      deviceHash: data.deviceHash || null,
    };
    return acc;
  }, {});
}

// LOGIN: Validate user + device hash binding
app.post("/api/login", (req, res) => {
  const { username, password, deviceHash } = req.body;
  if (!username || !password || !deviceHash) {
    return res.status(400).json({ message: "Missing fields" });
  }
  const users = loadUsers();
  const user = users[username.toLowerCase()];
  if (!user || user.pass !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (user.isBlocked) {
    return res.status(403).json({ message: "Account blocked" });
  }
  // Device binding
  if (!user.deviceHash) {
    user.deviceHash = deviceHash; // Bind device on first login
    saveUsers(users);
  } else if (user.deviceHash !== deviceHash) {
    return res.status(403).json({ message: "Device mismatch. Access denied." });
  }
  return res.json({ success: true, role: user.role });
});

// GET USERS (admin only)
app.get("/api/admin/users", (req, res) => {
  const users = loadUsers();
  res.json(publicUsers(users));
});

// ADD USER (admin only)
app.post("/api/admin/addUser", (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: "Missing fields" });
  }
  const users = loadUsers();
  const uname = username.toLowerCase();
  if (users[uname]) {
    return res.status(400).json({ message: "User already exists" });
  }
  users[uname] = { pass: password, role, isBlocked: false };
  saveUsers(users);
  res.json({ success: true });
});

// BLOCK / UNBLOCK USER
app.post("/api/admin/blockUser", (req, res) => {
  const { username, block } = req.body;
  if (!username || typeof block !== "boolean") {
    return res.status(400).json({ message: "Missing or invalid parameters" });
  }
  const users = loadUsers();
  const user = users[username.toLowerCase()];
  if (!user) return res.status(404).json({ message: "User not found" });
  user.isBlocked = block;
  saveUsers(users);
  res.json({ success: true });
});

// RESET DEVICE BINDING
app.post("/api/admin/resetDevice", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: "Missing username" });
  const users = loadUsers();
  const user = users[username.toLowerCase()];
  if (!user) return res.status(404).json({ message: "User not found" });
  delete user.deviceHash;
  saveUsers(users);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

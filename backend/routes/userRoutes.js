const express = require("express");

const router = express.Router();

const {
  getMe,
  updateMe,
  changePassword,
  getUserByUsername,
  getUserById,
} = require("../controllers/userController");

// NOTE: authMiddleware is already applied in server.js
// (app.use("/api/users", authMiddleware, userRoutes)),
// so req.user is always available here.


// ---------- Self-service profile ----------
// IMPORTANT: these must be declared BEFORE "/:id",
// otherwise "me" would be treated as an id.

// GET /api/users/me
router.get("/me", getMe);

// PUT /api/users/me
router.put("/me", updateMe);

// PUT /api/users/me/password
router.put("/me/password", changePassword);


// ---------- Owner / admin only (checked in controller) ----------

// GET /api/users/username/:username
router.get("/username/:username", getUserByUsername);

// GET /api/users/:id
router.get("/:id", getUserById);


module.exports = router;

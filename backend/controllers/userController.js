const User = require("../models/userModel");
const {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
} = require("../helpers/hashPassword");


// ======================================================
// Failed password-attempt limiter (in memory, per user)
// ======================================================
const MAX_FAILED_ATTEMPTS = 5;               // failures allowed
const LOCK_TIME_MS = 15 * 60 * 1000;         // 15 minutes

// userId -> { count, lockedUntil }
const failedAttempts = new Map();

const getLockSecondsLeft = (userId) => {
  const record = failedAttempts.get(userId);

  if (!record || !record.lockedUntil) {
    return 0;
  }

  const msLeft = record.lockedUntil - Date.now();

  if (msLeft <= 0) {
    // Lock finished - start fresh
    failedAttempts.delete(userId);
    return 0;
  }

  return Math.ceil(msLeft / 1000);
};

const registerFailedAttempt = (userId) => {
  const record = failedAttempts.get(userId) || { count: 0, lockedUntil: null };

  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_TIME_MS;
  }

  failedAttempts.set(userId, record);
};

const clearFailedAttempts = (userId) => {
  failedAttempts.delete(userId);
};


// ======================================================
// Helpers
// ======================================================
const toProfile = (user) => ({
  id: user.id,
  username: user.username,
  full_name: user.full_name,
  role: user.role,
});

// Account owner or admin?
const canAccessUser = (requester, targetId) => {
  return requester.role === "admin" || requester.id === targetId;
};


// ======================================================
// GET /api/users/me
// ======================================================
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile loaded",
      user: toProfile(user),
    });

  } catch (error) {
    console.error("Error loading profile:", error.message);

    res.status(500).json({ message: "Internal server error" });
  }
};


// ======================================================
// PUT /api/users/me   (only full_name can change)
// ======================================================
const updateMe = async (req, res) => {
  try {
    const body = req.body || {};

    // Reject attempts to change protected fields
    const forbidden = ["username", "role"].filter((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    );

    if (forbidden.length > 0) {
      return res.status(400).json({
        message: "Username and role cannot be changed",
        errors: Object.fromEntries(
          forbidden.map((field) => [field, `${field} cannot be changed`])
        ),
      });
    }

    // Validate full name
    if (typeof body.full_name !== "string") {
      return res.status(400).json({
        message: "Validation failed",
        errors: { full_name: "Full name is required" },
      });
    }

    const fullName = body.full_name.trim();

    if (fullName.length === 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: { full_name: "Full name cannot be blank" },
      });
    }

    if (fullName.length < 3 || fullName.length > 100) {
      return res.status(400).json({
        message: "Validation failed",
        errors: { full_name: "Full name must be between 3 and 100 characters" },
      });
    }

    await User.updateFullName(req.user.id, fullName);

    const user = await User.findById(req.user.id);

    res.status(200).json({
      message: "Profile updated successfully",
      user: toProfile(user),
    });

  } catch (error) {
    console.error("Error updating profile:", error.message);

    res.status(500).json({ message: "Internal server error" });
  }
};


// ======================================================
// PUT /api/users/me/password
// ======================================================
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Too many failed attempts? -> 429
    const secondsLeft = getLockSecondsLeft(userId);

    if (secondsLeft > 0) {
      res.set("Retry-After", String(secondsLeft));

      return res.status(429).json({
        message: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: secondsLeft,
      });
    }

    // 2) Validate input -> 400
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    const errors = {};

    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      errors.currentPassword = "Current password is required";
    }

    if (typeof newPassword !== "string" || newPassword.length === 0) {
      errors.newPassword = "New password is required";
    } else {
      const strengthError = validatePasswordStrength(newPassword);

      if (strengthError) {
        errors.newPassword = strengthError;
      }
    }

    if (typeof confirmPassword !== "string" || confirmPassword.length === 0) {
      errors.confirmPassword = "Please confirm the new password";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    // 3) Verify current password with bcrypt -> 401
    const user = await User.findByIdWithPassword(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentValid = await comparePassword(currentPassword, user.password);

    if (!isCurrentValid) {
      registerFailedAttempt(userId);

      return res.status(401).json({
        message: "Current password is incorrect",
        errors: { currentPassword: "Current password is incorrect" },
      });
    }

    // 4) New password must differ from the old one -> 400
    const isSameAsOld = await comparePassword(newPassword, user.password);

    if (isSameAsOld) {
      return res.status(400).json({
        message: "Validation failed",
        errors: {
          newPassword: "New password must be different from the current password",
        },
      });
    }

    // 5) Hash + save
    const newHash = await hashPassword(newPassword);

    await User.updatePassword(userId, newHash);

    clearFailedAttempts(userId);

    res.status(200).json({ message: "Password changed successfully" });

  } catch (error) {
    // Only the error message is logged - never passwords or hashes
    console.error("Error changing password:", error.message);

    res.status(500).json({ message: "Internal server error" });
  }
};


// ======================================================
// GET /api/users/username/:username  (owner or admin)
// ======================================================
const getUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findPublicByUsername(username);

    // Same 403 whether the user exists or not, so normal users
    // cannot discover which usernames exist.
    if (!user || !canAccessUser(req.user, user.id)) {
      if (!user && req.user.role === "admin") {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(403).json({
        message: "Access denied. You can only view your own account.",
      });
    }

    res.status(200).json({
      message: "User found",
      user: toProfile(user),
    });

  } catch (error) {
    console.error("Error finding user:", error.message);

    res.status(500).json({ message: "Internal server error" });
  }
};


// ======================================================
// GET /api/users/:id  (owner or admin)
// ======================================================
const getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // Authorization BEFORE the database lookup
    if (!canAccessUser(req.user, id)) {
      return res.status(403).json({
        message: "Access denied. You can only view your own account.",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User found",
      user: toProfile(user),
    });

  } catch (error) {
    console.error("Error finding user:", error.message);

    res.status(500).json({ message: "Internal server error" });
  }
};


module.exports = {
  getMe,
  updateMe,
  changePassword,
  getUserByUsername,
  getUserById,
};
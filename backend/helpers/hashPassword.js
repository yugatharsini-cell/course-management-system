const bcrypt = require("bcrypt");

// bcrypt cost factor
const SALT_ROUNDS = 10;

// bcrypt only uses the first 72 BYTES of a password.
// We reject longer passwords instead of silently truncating them.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;


// Hash a plain-text password
const hashPassword = (plainPassword) => {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
};


// Compare a plain-text password with a stored bcrypt hash
const comparePassword = (plainPassword, hash) => {
  return bcrypt.compare(plainPassword, hash);
};


// Returns an error message string, or null if the password is acceptable
const validatePasswordStrength = (password) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `Password must not be longer than ${MAX_PASSWORD_BYTES} bytes`;
  }

  return null;
};


module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
};


// Optional CLI helper (for creating seed hashes):
//   node helpers/hashPassword.js MyPassword123
// Prints only the hash of the password you pass in.
if (require.main === module) {
  const input = process.argv[2];

  if (!input) {
    console.log("Usage: node helpers/hashPassword.js <password>");
  } else {
    hashPassword(input).then((hash) => console.log(hash));
  }
}

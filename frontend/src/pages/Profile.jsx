import { useEffect, useState } from "react";
import { FaIdCard, FaKey, FaSave, FaUserEdit } from "react-icons/fa";

import api from "../services/api";
import { getUser, updateStoredUser } from "../services/auth";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";


// Same rules as the backend (the backend is still the real check)
const validateFullName = (value) => {
  const name = value.trim();

  if (name.length === 0) return "Full name cannot be blank";

  if (name.length < 3 || name.length > 100) {
    return "Full name must be between 3 and 100 characters";
  }

  return "";
};

const validatePasswords = ({ currentPassword, newPassword, confirmPassword }) => {
  const errors = {};

  if (!currentPassword) {
    errors.currentPassword = "Current password is required";
  }

  if (!newPassword) {
    errors.newPassword = "New password is required";
  } else if (newPassword.length < 8) {
    errors.newPassword = "Password must be at least 8 characters";
  } else if (new TextEncoder().encode(newPassword).length > 72) {
    errors.newPassword = "Password must not be longer than 72 bytes";
  } else if (newPassword === currentPassword) {
    errors.newPassword = "New password must be different from the current password";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm the new password";
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
};

const EMPTY_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};


function Profile() {

  // ---------- Profile information ----------
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ---------- Change full name ----------
  const [fullName, setFullName] = useState("");
  const [nameErrors, setNameErrors] = useState({});
  const [nameMessage, setNameMessage] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  // ---------- Change password ----------
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);


  useEffect(() => {

    const loadProfile = async () => {

      try {

        const response = await api.get("/users/me");

        setProfile(response.data.user);
        setFullName(response.data.user.full_name);

      } catch (error) {

        setLoadError(
          error.response?.data?.message ||
          "Failed to load your profile"
        );

      } finally {

        setLoading(false);

      }
    };

    loadProfile();

  }, []);


  // ---------- Save full name ----------
  const handleNameSubmit = async (event) => {

    event.preventDefault();

    setNameMessage("");

    const message = validateFullName(fullName);

    if (message) {
      setNameErrors({ full_name: message });
      return;
    }

    setNameErrors({});
    setNameSaving(true);

    try {

      const response = await api.put("/users/me", {
        full_name: fullName.trim(),
      });

      const updated = response.data.user;

      // Update the user stored in localStorage (Navbar reads it)
      updateStoredUser({ full_name: updated.full_name });

      setProfile(updated);
      setFullName(updated.full_name);
      setNameMessage("Full name updated successfully.");

    } catch (error) {

      const serverErrors = error.response?.data?.errors;

      setNameErrors(
        serverErrors || {
          full_name:
            error.response?.data?.message ||
            "Could not update your name. Please try again.",
        }
      );

    } finally {

      setNameSaving(false);

    }
  };


  // ---------- Change password ----------
  const handlePasswordChange = (event) => {

    const { name, value } = event.target;

    setPasswordForm((previous) => ({ ...previous, [name]: value }));
  };

  const handlePasswordSubmit = async (event) => {

    event.preventDefault();

    setPasswordMessage("");

    const errors = validatePasswords(passwordForm);

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordErrors({});
    setPasswordSaving(true);

    try {

      await api.put("/users/me/password", passwordForm);

      // Clear all password fields after success
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setPasswordMessage("Password changed successfully.");

    } catch (error) {

      const status = error.response?.status;
      const data = error.response?.data;

      if (status === 429) {

        setPasswordErrors({
          form:
            data?.message ||
            "Too many failed attempts. Please try again later.",
        });

      } else if (data?.errors) {

        setPasswordErrors(data.errors);

      } else {

        setPasswordErrors({
          form:
            data?.message ||
            "Could not change your password. Please try again.",
        });

      }

    } finally {

      setPasswordSaving(false);

    }
  };


  const storedUser = getUser();
  const shown = profile || storedUser;


  return (

    <>
      <Navbar />

      <div className="container">

        <div className="page-header">
          <div>
            <h1>My Profile</h1>
            <p className="page-subtitle">
              View your account details and manage your password.
            </p>
          </div>
        </div>


        {loadError && <p className="error">{loadError}</p>}


        {/* ---------- Profile information ---------- */}

        <section className="section-card">

          <div className="section-card-header">
            <h2><FaIdCard /> Profile Information</h2>
          </div>

          {loading && <p className="loading">Loading...</p>}

          {!loading && shown && (
            <dl className="profile-details">

              <div>
                <dt>User ID</dt>
                <dd>{shown.id}</dd>
              </div>

              <div>
                <dt>Username</dt>
                <dd>{shown.username}</dd>
              </div>

              <div>
                <dt>Full Name</dt>
                <dd>{shown.full_name}</dd>
              </div>

              <div>
                <dt>Role</dt>
                <dd><span className="role-badge">{shown.role}</span></dd>
              </div>

            </dl>
          )}

        </section>


        {/* ---------- Change full name ---------- */}

        <section className="section-card">

          <div className="section-card-header">
            <h2><FaUserEdit /> Change Full Name</h2>
          </div>

          <form onSubmit={handleNameSubmit} className="profile-form" noValidate>

            <div className="form-group">
              <label htmlFor="full_name">Full Name</label>

              <input
                id="full_name"
                name="full_name"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={nameSaving || loading}
                autoComplete="name"
              />

              {nameErrors.full_name && (
                <span className="field-error">{nameErrors.full_name}</span>
              )}
            </div>

            {(nameErrors.username || nameErrors.role) && (
              <p className="error">Username and role cannot be changed.</p>
            )}

            {nameMessage && <p className="success">{nameMessage}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={nameSaving || loading}
            >
              <FaSave />
              {nameSaving ? "Saving..." : "Save Name"}
            </button>

          </form>

        </section>


        {/* ---------- Change password ---------- */}

        <section className="section-card">

          <div className="section-card-header">
            <h2><FaKey /> Change Password</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="profile-form" noValidate>

            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>

              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                disabled={passwordSaving}
                autoComplete="current-password"
              />

              {passwordErrors.currentPassword && (
                <span className="field-error">{passwordErrors.currentPassword}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>

              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                disabled={passwordSaving}
                autoComplete="new-password"
              />

              {passwordErrors.newPassword && (
                <span className="field-error">{passwordErrors.newPassword}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                disabled={passwordSaving}
                autoComplete="new-password"
              />

              {passwordErrors.confirmPassword && (
                <span className="field-error">{passwordErrors.confirmPassword}</span>
              )}
            </div>

            {passwordErrors.form && <p className="error">{passwordErrors.form}</p>}

            {passwordMessage && <p className="success">{passwordMessage}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={passwordSaving}
            >
              <FaKey />
              {passwordSaving ? "Changing..." : "Change Password"}
            </button>

          </form>

        </section>

      </div>

      <Footer />
    </>
  );
}


export default Profile;

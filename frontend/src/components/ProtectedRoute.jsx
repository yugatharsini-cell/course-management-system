import { Navigate, useLocation } from "react-router-dom";

import { getUser, getToken } from "../services/auth";


function ProtectedRoute({ children, role }) {

  const location = useLocation();

  const token = getToken();
  const user = getUser();


  if (!token || !user) {

    return (
      <Navigate
        to="/login"
        state={{
          from:
            location.pathname +
            location.search +
            location.hash
        }}
        replace
      />
    );
  }

  // role can be a single role ("admin") or a list (["student", "admin"]).
  // If no role is given, any logged-in user may enter (e.g. /profile).
  const allowedRoles = role
    ? (Array.isArray(role) ? role : [role])
    : null;

  if (allowedRoles && !allowedRoles.includes(user.role)) {

    return (
      <div className="access-denied-container">

        <h2>Access Denied</h2>

        <p>
          Access denied. You do not have permission
          to access this page.
        </p>

      </div>
    );
  }

  return children;
}


export default ProtectedRoute;

import React from 'react';
import { Route, Redirect } from 'react-router-dom';

const RoleBasedRoute = ({ component: Component, allowedRoles, userRoles, ...rest }) => {
  const hasRequiredRole = allowedRoles.some(role => 
    userRoles.includes(`ROLE_${role.toUpperCase()}`)
  );

  return (
    <Route
      {...rest}
      render={props =>
        hasRequiredRole ? (
          <Component {...props} />
        ) : (
          <Redirect to="/unauthorized" />
        )
      }
    />
  );
};

export default RoleBasedRoute;
// pages/FaxDashboardWrapper.js
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import FaxDashboard from './FaxDashboard';

const FaxDashboardWrapper = () => {
  const { user } = useAuth();
  // Pass whatever props your FaxDashboard expects
  return <FaxDashboard userId={user.id} userName={user.name} />;
};
export default FaxDashboardWrapper;

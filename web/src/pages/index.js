/**
 * Page Components
 *
 * This module exports all page-level components used for routing.
 * These components represent different views/screens in the application.
 */

// Main dashboard page (route: /)
export { default as TaskDashboard } from './TaskDashboard.jsx';

// Individual task detail page (route: /tasks/:id)
export { default as TaskDetail } from './TaskDetail.jsx';

// Error pages
export { default as NotFound } from './NotFound.jsx';
export { default as ErrorPage } from './ErrorPage.jsx';

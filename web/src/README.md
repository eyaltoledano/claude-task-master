# Task Master Web Interface - Source Structure

This directory contains the React application source code for the Task Master web interface.

## Directory Structure

```
web/src/
├── api/                 # API service functions
│   ├── index.js        # Main API exports
│   ├── config.js       # API configuration and utilities
│   ├── tasks.js        # Task-related API calls
│   ├── tags.js         # Tag-related API calls
│   ├── analysis.js     # Analysis and research API calls
│   └── websocket.js    # WebSocket connection utilities
├── assets/             # Static assets (images, icons, fonts)
├── components/         # Reusable UI components
│   ├── index.js        # Component exports
│   └── TaskItem.jsx    # Individual task component
├── hooks/              # Custom React hooks
│   ├── index.js        # Hook exports
│   ├── useTasks.js     # TanStack Query hooks for tasks
│   ├── useTags.js      # TanStack Query hooks for tags
│   ├── useAnalysis.js  # Analysis-related hooks
│   ├── useWebSocket.js # WebSocket connection hook
│   ├── useLocalStorage.js # Local storage utilities
│   └── useDebounce.js  # Debouncing utility hook
├── layouts/            # Layout components
│   ├── index.js        # Layout exports
│   ├── AppLayout.jsx   # Main application layout
│   ├── Header.jsx      # Header component
│   ├── Footer.jsx      # Footer component
│   ├── Navigation.jsx  # Navigation component
│   └── LoadingLayout.jsx # Loading state layout
├── pages/              # Page components for routing
│   ├── index.js        # Page exports
│   ├── TaskDashboard.jsx # Main dashboard (/)
│   ├── TaskDetail.jsx  # Task detail page (/tasks/:id)
│   ├── NotFound.jsx    # 404 error page
│   └── ErrorPage.jsx   # General error page
├── utils/              # Utility functions
│   ├── index.js        # Utility exports
│   ├── dateUtils.js    # Date formatting utilities
│   ├── formatUtils.js  # String formatting utilities
│   ├── validation.js   # Validation functions
│   ├── taskUtils.js    # Task-specific utilities
│   └── helpers.js      # General helper functions
├── App.jsx             # Main App component
├── App.css             # App-level styles
├── main.jsx            # React application entry point
├── index.css           # Global styles
└── index.html          # HTML template
```

## Path Aliases

The following Vite aliases are configured for clean imports:

- `@` → `web/src/`
- `@components` → `web/src/components/`
- `@utils` → `web/src/utils/`
- `@api` → `web/src/api/`

## Coding Conventions

### File Naming

- **Components**: PascalCase (e.g., `TaskItem.jsx`, `AppLayout.jsx`)
- **Hooks**: camelCase starting with "use" (e.g., `useTasks.js`, `useWebSocket.js`)
- **Utilities**: camelCase (e.g., `dateUtils.js`, `taskUtils.js`)
- **API services**: camelCase (e.g., `tasks.js`, `config.js`)

### Import/Export Patterns

- Use named exports for utilities and services
- Use default exports for React components
- Use barrel exports (index.js) for clean imports
- Import from barrel files when possible

### Component Structure

```jsx
// Imports
import React from "react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComponentName } from "@components";
import { utilityFunction } from "@utils";
import "./ComponentName.css";

// Component definition
function ComponentName({ prop1, prop2 }) {
  // Hooks
  const [state, setState] = useState();
  const { data, isLoading } = useQuery();

  // Event handlers
  const handleEvent = () => {
    // Implementation
  };

  // Render
  return <div className="component-name">{/* JSX content */}</div>;
}

export default ComponentName;
```

### CSS Organization

- Component-specific styles in `ComponentName.css`
- Global styles in `index.css`
- Use CSS modules for scoped styling when needed
- Follow BEM methodology for class naming

### State Management

- Use TanStack Query for server state
- Use React hooks (useState, useReducer) for local component state
- Create custom hooks for reusable stateful logic

### API Integration

- All API calls should go through the `@api` services
- Use TanStack Query hooks for data fetching
- Handle loading and error states consistently

## Development Workflow

1. **Components**: Create in `components/` directory with accompanying CSS
2. **Pages**: Create route components in `pages/` directory
3. **Hooks**: Create custom hooks in `hooks/` directory
4. **API Services**: Add API functions in appropriate `api/` files
5. **Utilities**: Add helper functions in appropriate `utils/` files

## Build Process

The application uses Vite for building and development:

- **Development**: `npm run dev:web`
- **Build**: `npm run build:web`
- **Preview**: `npm run preview:web`

## Integration with Backend

The React application integrates with the Task Master Express server:

- **API Proxy**: Vite proxies `/api` requests to `http://localhost:3001`
- **WebSocket**: Real-time updates via WebSocket connection
- **REST API**: Full CRUD operations for tasks, tags, and analysis

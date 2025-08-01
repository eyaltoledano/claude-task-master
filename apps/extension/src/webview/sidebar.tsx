import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidebarView } from './components/SidebarView';

const rootElement = document.getElementById('root');

if (!rootElement) {
	console.error('Sidebar: Root element not found');
} else {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<React.StrictMode>
			<SidebarView />
		</React.StrictMode>
	);
}

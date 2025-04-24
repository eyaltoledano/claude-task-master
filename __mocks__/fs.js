// __mocks__/fs.js
const path = require('path');

const mockFs = jest.createMockFromModule('fs');

// In-memory representation of the file system for the mock
let mockFiles = {};
let mockDirectories = new Set(['/']); // Start with root

// Helper to get parent directory
const getParentDir = (filePath) => path.dirname(filePath);

// Mock implementations
mockFs.existsSync = (filePath) => {
	const normalizedPath = path.normalize(filePath);
	return (
		mockFiles.hasOwnProperty(normalizedPath) ||
		mockDirectories.has(normalizedPath)
	);
};

mockFs.mkdirSync = (dirPath, options = {}) => {
	const normalizedPath = path.normalize(dirPath);
	const parentDir = getParentDir(normalizedPath);

	if (!mockDirectories.has(parentDir) && !options.recursive) {
		throw new Error(`ENOENT: no such file or directory, mkdir '${dirPath}'`);
	}

	// Simulate recursive creation if needed
	if (options.recursive) {
		const parts = normalizedPath.split(path.sep).filter(Boolean);
		let currentPath = path.sep === '/' ? '/' : ''; // Handle root correctly
		for (const part of parts) {
			currentPath = path.join(currentPath, part);
			if (!mockDirectories.has(currentPath)) {
				mockDirectories.add(currentPath);
			}
		}
	} else {
		mockDirectories.add(normalizedPath);
	}
	return undefined; // Or return path if needed based on Node version/behavior
};

mockFs.copyFileSync = (src, dest) => {
	const normalizedSrc = path.normalize(src);
	const normalizedDest = path.normalize(dest);
	const destDir = getParentDir(normalizedDest);

	if (!mockFiles.hasOwnProperty(normalizedSrc)) {
		throw new Error(`ENOENT: no such file or directory, copyfile '${src}'`);
	}
	if (!mockDirectories.has(destDir)) {
		throw new Error(`ENOENT: no such file or directory, copyfile '${dest}'`);
	}
	mockFiles[normalizedDest] = mockFiles[normalizedSrc]; // Simulate copy
};

mockFs.writeFileSync = (filePath, data) => {
	const normalizedPath = path.normalize(filePath);
	const parentDir = getParentDir(normalizedPath);
	if (!mockDirectories.has(parentDir)) {
		throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
	}
	mockFiles[normalizedPath] = data;
};

mockFs.readFileSync = (filePath, options) => {
	const normalizedPath = path.normalize(filePath);
	if (!mockFiles.hasOwnProperty(normalizedPath)) {
		throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
	}
	// Basic implementation, might need refinement for encoding etc.
	return mockFiles[normalizedPath];
};

mockFs.readdirSync = (dirPath) => {
	const normalizedPath = path.normalize(dirPath);
	if (!mockDirectories.has(normalizedPath)) {
		throw new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
	}

	const entries = new Set();
	const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}${path.sep}`;

	// Add direct files
	Object.keys(mockFiles).forEach((filePath) => {
		if (getParentDir(filePath) === normalizedPath) {
			entries.add(path.basename(filePath));
		}
	});

	// Add direct subdirectories
	mockDirectories.forEach((dir) => {
		if (dir !== normalizedPath && getParentDir(dir) === normalizedPath) {
			entries.add(path.basename(dir));
		}
	});

	return Array.from(entries);
};

// --- Utility functions for tests to manipulate the mock ---
mockFs.__setMockFiles = (newMockFiles) => {
	mockFiles = { ...newMockFiles };
	// Ensure directories exist for the files
	Object.keys(newMockFiles).forEach((filePath) => {
		let currentPath = '';
		const parts = path.normalize(filePath).split(path.sep).filter(Boolean);
		parts.pop(); // Remove filename
		if (parts.length === 0 && path.sep === '/') {
			mockDirectories.add('/'); // Ensure root exists
			return;
		}
		for (const part of parts) {
			currentPath = path.join(currentPath, part);
			if (path.sep === '/') currentPath = '/' + currentPath; // Handle root for Unix-like paths
			mockDirectories.add(currentPath);
		}
	});
};

mockFs.__setMockDirectories = (newMockDirs) => {
	mockDirectories = new Set(newMockDirs.map((p) => path.normalize(p)));
	if (!mockDirectories.has('/')) {
		mockDirectories.add('/'); // Always ensure root exists
	}
};

mockFs.__clearMock = () => {
	mockFiles = {};
	mockDirectories = new Set(['/']);
};

mockFs.__getMockFiles = () => mockFiles;
mockFs.__getMockDirectories = () => mockDirectories;
// --- End Utility Functions ---

module.exports = mockFs;

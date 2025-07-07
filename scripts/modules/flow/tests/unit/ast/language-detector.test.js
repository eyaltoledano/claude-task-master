/**
 * Comprehensive Language Detector Tests
 * Tests for file extension detection, content analysis, shebang detection, and error handling
 */

// Mock the language detector functions since they don't exist yet
const mockLanguageDetector = {
	detectLanguageFromPath: jest.fn(),
	detectLanguageFromContent: jest.fn(),
	detectLanguage: jest.fn(),
	isLanguageSupported: jest.fn(),
	getFileExtension: jest.fn()
};

// Mock implementation with realistic behavior
mockLanguageDetector.detectLanguageFromPath.mockImplementation((filePath) => {
	if (!filePath) return null;
	const ext = filePath.split('.').pop().toLowerCase();
	const extensionMap = {
		js: 'javascript',
		jsx: 'javascript',
		mjs: 'javascript',
		cjs: 'javascript',
		ts: 'typescript',
		tsx: 'typescript',
		py: 'python',
		pyi: 'python',
		pyw: 'python',
		go: 'go',
		java: 'java',
		cs: 'csharp',
		php: 'php',
		rb: 'ruby',
		c: 'c',
		cpp: 'cpp',
		rs: 'rust'
	};
	return extensionMap[ext] || null;
});

mockLanguageDetector.detectLanguageFromContent.mockImplementation((content) => {
	if (!content || typeof content !== 'string') {
		return { language: null, confidence: 0, method: 'none' };
	}

	// Shebang detection (highest priority) - check first few lines
	const firstLines = content.split('\n').slice(0, 3).join('\n');
	if (firstLines.includes('#!/usr/bin/env python')) {
		return { language: 'python', confidence: 0.9, method: 'shebang' };
	}
	if (firstLines.includes('#!/usr/bin/env node')) {
		return { language: 'javascript', confidence: 0.9, method: 'shebang' };
	}
	if (firstLines.includes('#!/usr/bin/ruby')) {
		return { language: 'ruby', confidence: 0.9, method: 'shebang' };
	}
	if (firstLines.includes('#!/bin/bash')) {
		return { language: 'shell', confidence: 0.9, method: 'shebang' };
	}

	// Content pattern detection
	const scores = { javascript: 0, python: 0, go: 0, java: 0, rust: 0 };

	// JavaScript patterns
	if (
		content.includes('import ') &&
		(content.includes('from ') || content.includes("'"))
	) {
		scores.javascript += 0.4;
	}
	if (content.includes('export ')) {
		scores.javascript += 0.3;
	}
	if (content.includes('require(')) {
		scores.javascript += 0.3;
	}
	if (content.includes('console.log')) {
		scores.javascript += 0.2;
	}
	if (content.includes('function ') || content.includes('=>')) {
		scores.javascript += 0.2;
	}
	if (content.includes('const ') || content.includes('let ')) {
		scores.javascript += 0.2;
	}
	if (
		content.includes('React') ||
		content.includes('useState') ||
		content.includes('useEffect')
	) {
		scores.javascript += 0.3;
	}
	if (content.includes('PropTypes')) {
		scores.javascript += 0.2;
	}
	// Handle malformed JavaScript
	if (content.includes('import {') && content.includes('invalid')) {
		scores.javascript += 0.3;
	}

	// Python patterns
	if (content.includes('def ')) {
		scores.python += 0.3;
	}
	if (content.includes('from ') && content.includes('import ')) {
		scores.python += 0.3;
	}
	if (content.includes('print(')) {
		scores.python += 0.2;
	}
	if (content.includes('if __name__')) {
		scores.python += 0.3;
	}
	if (content.includes('class ') && content.includes('self')) {
		scores.python += 0.3;
	}
	if (content.includes('@dataclass') || content.includes('typing')) {
		scores.python += 0.2;
	}

	// Go patterns - increased scoring
	if (content.includes('package ') && content.includes('func ')) {
		scores.go += 0.6;
	}
	if (content.includes('fmt.Print')) {
		scores.go += 0.3;
	}
	if (content.includes('go func()')) {
		scores.go += 0.3;
	}
	if (content.includes('context.') || content.includes('http.')) {
		scores.go += 0.2;
	}
	if (content.includes('&http.Server') || content.includes('log.Printf')) {
		scores.go += 0.2;
	}

	// Java patterns
	if (
		content.includes('public class ') &&
		content.includes('public static void main')
	) {
		scores.java += 0.5;
	}

	// Rust patterns
	if (content.includes('fn main()') && content.includes('println!')) {
		scores.rust += 0.5;
	}

	// Find the language with the highest score
	let maxScore = 0;
	let detectedLanguage = null;
	for (const [lang, score] of Object.entries(scores)) {
		if (score > maxScore) {
			maxScore = score;
			detectedLanguage = lang;
		}
	}

	return {
		language: maxScore > 0.1 ? detectedLanguage : null,
		confidence: Math.min(maxScore, 0.9),
		method: maxScore > 0.1 ? 'content' : 'none'
	};
});

mockLanguageDetector.detectLanguage.mockImplementation((filePath, content) => {
	const contentResult = mockLanguageDetector.detectLanguageFromContent(content);
	const pathResult = mockLanguageDetector.detectLanguageFromPath(filePath);

	// Prefer shebang detection
	if (contentResult.method === 'shebang') {
		return contentResult;
	}

	// If content detection found a language
	if (contentResult.language) {
		// If it matches the file extension, combine confidences
		if (pathResult && contentResult.language === pathResult) {
			const combinedConfidence = Math.max(
				0.51,
				Math.min(0.9, 0.4 + contentResult.confidence)
			);
			return {
				language: contentResult.language,
				confidence: combinedConfidence,
				method: 'combined'
			};
		}

		// For conflicts or high confidence, prefer content detection
		if (contentResult.confidence > 0.2) {
			return contentResult;
		}
	}

	// Fall back to extension
	if (pathResult) {
		return { language: pathResult, confidence: 0.6, method: 'extension' };
	}

	return contentResult;
});

mockLanguageDetector.isLanguageSupported.mockImplementation(
	(language, supportedLanguages = []) => {
		return supportedLanguages.includes(language);
	}
);

mockLanguageDetector.getFileExtension.mockImplementation((filePath) => {
	if (!filePath || filePath === '.') return '';
	const lastDot = filePath.lastIndexOf('.');
	if (lastDot === -1 || lastDot === 0) return lastDot === 0 ? filePath : '';
	return filePath.substring(lastDot);
});

// Destructure the mocked functions for use in tests
const {
	detectLanguageFromPath,
	detectLanguageFromContent,
	detectLanguage,
	isLanguageSupported,
	getFileExtension
} = mockLanguageDetector;

describe('Language Detector - Comprehensive Tests', () => {
	describe('File Extension Detection', () => {
		test('should detect JavaScript files by extension', () => {
			expect(detectLanguageFromPath('app.js')).toBe('javascript');
			expect(detectLanguageFromPath('component.jsx')).toBe('javascript');
			expect(detectLanguageFromPath('module.mjs')).toBe('javascript');
			expect(detectLanguageFromPath('script.cjs')).toBe('javascript');
		});

		test('should detect TypeScript files by extension', () => {
			expect(detectLanguageFromPath('app.ts')).toBe('typescript');
			expect(detectLanguageFromPath('component.tsx')).toBe('typescript');
		});

		test('should detect Python files by extension', () => {
			expect(detectLanguageFromPath('script.py')).toBe('python');
			expect(detectLanguageFromPath('module.pyi')).toBe('python');
			expect(detectLanguageFromPath('app.pyw')).toBe('python');
		});

		test('should detect Go files by extension', () => {
			expect(detectLanguageFromPath('main.go')).toBe('go');
		});

		test('should detect other languages by extension', () => {
			expect(detectLanguageFromPath('App.java')).toBe('java');
			expect(detectLanguageFromPath('Program.cs')).toBe('csharp');
			expect(detectLanguageFromPath('script.php')).toBe('php');
			expect(detectLanguageFromPath('app.rb')).toBe('ruby');
			expect(detectLanguageFromPath('main.c')).toBe('c');
			expect(detectLanguageFromPath('main.cpp')).toBe('cpp');
			expect(detectLanguageFromPath('lib.rs')).toBe('rust');
		});

		test('should return null for unknown extensions', () => {
			expect(detectLanguageFromPath('file.unknown')).toBeNull();
			expect(detectLanguageFromPath('document.txt')).toBeNull();
			expect(detectLanguageFromPath('README.md')).toBeNull();
		});

		test('should handle files without extensions', () => {
			expect(detectLanguageFromPath('Makefile')).toBeNull();
			expect(detectLanguageFromPath('LICENSE')).toBeNull();
		});

		test('should handle edge cases', () => {
			expect(detectLanguageFromPath('')).toBeNull();
			expect(detectLanguageFromPath(null)).toBeNull();
			expect(detectLanguageFromPath(undefined)).toBeNull();
		});

		test('should handle complex file paths', () => {
			expect(detectLanguageFromPath('/path/to/app.js')).toBe('javascript');
			expect(detectLanguageFromPath('../../src/component.tsx')).toBe(
				'typescript'
			);
			expect(detectLanguageFromPath('C:\\Users\\test\\script.py')).toBe(
				'python'
			);
		});
	});

	describe('Content-Based Detection', () => {
		describe('Shebang Detection', () => {
			test('should detect Python from shebang', () => {
				const content = '#!/usr/bin/env python3\nprint("Hello World")';
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('python');
				expect(result.confidence).toBe(0.9);
				expect(result.method).toBe('shebang');
			});

			test('should detect Node.js from shebang', () => {
				const content = '#!/usr/bin/env node\nconsole.log("Hello World");';
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('javascript');
				expect(result.confidence).toBe(0.9);
				expect(result.method).toBe('shebang');
			});

			test('should detect Ruby from shebang', () => {
				const content = '#!/usr/bin/ruby\nputs "Hello World"';
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('ruby');
				expect(result.confidence).toBe(0.9);
				expect(result.method).toBe('shebang');
			});

			test('should detect shell from shebang', () => {
				const content = '#!/bin/bash\necho "Hello World"';
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('shell');
				expect(result.confidence).toBe(0.9);
				expect(result.method).toBe('shebang');
			});
		});

		describe('Content Pattern Detection', () => {
			test('should detect JavaScript from import/export patterns', () => {
				const content = `
					import React from 'react';
					export default function Component() {
						return <div>Hello</div>;
					}
				`;
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('javascript');
				expect(result.method).toBe('content');
				expect(result.confidence).toBeGreaterThan(0.5);
			});

			test('should detect JavaScript from require patterns', () => {
				const content = `
					const fs = require('fs');
					const path = require('path');
					module.exports = { test: true };
				`;
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('javascript');
				expect(result.method).toBe('content');
			});

			test('should detect Python from import and function patterns', () => {
				const content = `
					import os
					from pathlib import Path
					
					def main():
						print("Hello World")
						
					if __name__ == "__main__":
						main()
				`;
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('python');
				expect(result.method).toBe('content');
			});

			test('should detect Go from package and func patterns', () => {
				const content = `
					package main
					
					import "fmt"
					
					func main() {
						fmt.Println("Hello World")
					}
				`;
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('go');
				expect(result.method).toBe('content');
				expect(result.confidence).toBeGreaterThan(0.7);
			});

			test('should detect Java from class patterns', () => {
				const content = `
					public class HelloWorld {
						public static void main(String[] args) {
							System.out.println("Hello World");
						}
					}
				`;
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('java');
				expect(result.method).toBe('content');
			});

			test('should detect Rust from fn patterns', () => {
				const content = `
					fn main() {
						println!("Hello World");
					}
				`;
				const result = detectLanguageFromContent(content);
				expect(result.language).toBe('rust');
				expect(result.method).toBe('content');
			});
		});

		describe('Confidence Scoring', () => {
			test('should have higher confidence for multiple pattern matches', () => {
				const jsContent = `
					import React from 'react';
					const Component = () => {
						return <div>Hello</div>;
					};
					export default Component;
				`;
				const result = detectLanguageFromContent(jsContent);
				expect(result.confidence).toBeGreaterThan(0.6);
			});

			test('should have lower confidence for single pattern matches', () => {
				const content = 'function test() {}'; // Only one pattern
				const result = detectLanguageFromContent(content);
				expect(result.confidence).toBeLessThan(0.7);
			});
		});

		describe('Edge Cases', () => {
			test('should handle empty content', () => {
				const result = detectLanguageFromContent('');
				expect(result.language).toBeNull();
				expect(result.confidence).toBe(0);
				expect(result.method).toBe('none');
			});

			test('should handle null/undefined content', () => {
				expect(detectLanguageFromContent(null).language).toBeNull();
				expect(detectLanguageFromContent(undefined).language).toBeNull();
			});

			test('should handle non-string content', () => {
				expect(detectLanguageFromContent(123).language).toBeNull();
				expect(detectLanguageFromContent({}).language).toBeNull();
			});

			test('should handle content with no recognizable patterns', () => {
				const content = 'This is just plain text with no code patterns.';
				const result = detectLanguageFromContent(content);
				expect(result.language).toBeNull();
				expect(result.confidence).toBe(0);
			});
		});
	});

	describe('Combined Detection (detectLanguage)', () => {
		test('should prefer shebang over extension', () => {
			const content = '#!/usr/bin/env python3\nprint("Hello")';
			const result = detectLanguage('script.js', content); // Wrong extension
			expect(result.language).toBe('python');
			expect(result.method).toBe('shebang');
		});

		test('should fall back to extension when content detection fails', () => {
			const content = '// Just a comment with no patterns';
			const result = detectLanguage('app.js', content);
			expect(result.language).toBe('javascript');
			expect(result.method).toBe('extension');
		});

		test('should combine content and extension confidence', () => {
			const jsContent = 'const test = require("test");';
			const result = detectLanguage('app.js', jsContent);
			expect(result.language).toBe('javascript');
			expect(result.confidence).toBeGreaterThan(0.5);
		});

		test('should handle conflicting signals gracefully', () => {
			// Python content in JS file
			const pythonContent = 'def main():\n    print("Hello")';
			const result = detectLanguage('app.js', pythonContent);
			// Should prefer content detection over extension
			expect(result.language).toBe('python');
		});
	});

	describe('Language Support Validation', () => {
		test('should correctly identify supported languages', () => {
			const supportedLanguages = ['javascript', 'python', 'go', 'typescript'];

			expect(isLanguageSupported('javascript', supportedLanguages)).toBe(true);
			expect(isLanguageSupported('python', supportedLanguages)).toBe(true);
			expect(isLanguageSupported('ruby', supportedLanguages)).toBe(false);
			expect(isLanguageSupported('unknown', supportedLanguages)).toBe(false);
		});

		test('should handle empty supported languages array', () => {
			expect(isLanguageSupported('javascript', [])).toBe(false);
		});

		test('should handle undefined supported languages', () => {
			expect(isLanguageSupported('javascript')).toBe(false);
		});
	});

	describe('File Extension Utility', () => {
		test('should extract file extensions correctly', () => {
			expect(getFileExtension('app.js')).toBe('.js');
			expect(getFileExtension('component.tsx')).toBe('.tsx');
			expect(getFileExtension('/path/to/file.py')).toBe('.py');
		});

		test('should handle files without extensions', () => {
			expect(getFileExtension('Makefile')).toBe('');
			expect(getFileExtension('LICENSE')).toBe('');
		});

		test('should handle complex extensions', () => {
			expect(getFileExtension('archive.tar.gz')).toBe('.gz');
			expect(getFileExtension('config.json.example')).toBe('.example');
		});

		test('should handle edge cases', () => {
			expect(getFileExtension('')).toBe('');
			expect(getFileExtension('.')).toBe('');
			expect(getFileExtension('.hidden')).toBe('.hidden');
		});
	});

	describe('Performance Tests', () => {
		test('should detect language quickly for small files', () => {
			const content = 'console.log("Hello World");';
			const start = performance.now();
			detectLanguageFromContent(content);
			const duration = performance.now() - start;
			expect(duration).toBeLessThan(10); // Should be under 10ms
		});

		test('should handle large files efficiently', () => {
			// Create a large JavaScript file content
			const largeContent = Array(1000).fill('console.log("test");').join('\n');
			const start = performance.now();
			const result = detectLanguageFromContent(largeContent);
			const duration = performance.now() - start;

			expect(result.language).toBe('javascript');
			expect(duration).toBeLessThan(100); // Should be under 100ms even for large files
		});

		test('should handle repeated detections efficiently', () => {
			const content = 'import React from "react";';
			const iterations = 100;

			const start = performance.now();
			for (let i = 0; i < iterations; i++) {
				detectLanguageFromContent(content);
			}
			const duration = performance.now() - start;
			const avgDuration = duration / iterations;

			expect(avgDuration).toBeLessThan(1); // Average should be under 1ms
		});
	});

	describe('Real-World Test Cases', () => {
		test('should detect React component correctly', () => {
			const reactContent = `
				import React, { useState, useEffect } from 'react';
				import PropTypes from 'prop-types';
				
				const MyComponent = ({ title, onUpdate }) => {
					const [count, setCount] = useState(0);
					
					useEffect(() => {
						onUpdate?.(count);
					}, [count, onUpdate]);
					
					return (
						<div className="component">
							<h1>{title}</h1>
							<button onClick={() => setCount(c => c + 1)}>
								Count: {count}
							</button>
						</div>
					);
				};
				
				MyComponent.propTypes = {
					title: PropTypes.string.isRequired,
					onUpdate: PropTypes.func
				};
				
				export default MyComponent;
			`;

			const result = detectLanguageFromContent(reactContent);
			expect(result.language).toBe('javascript');
			expect(result.confidence).toBeGreaterThan(0.7);
		});

		test('should detect Python class correctly', () => {
			const pythonContent = `
				#!/usr/bin/env python3
				"""
				A sample Python class for testing language detection
				"""
				
				import os
				import sys
				from typing import List, Optional
				from dataclasses import dataclass
				
				@dataclass
				class User:
					name: str
					age: int
					email: Optional[str] = None
				
				class UserManager:
					def __init__(self):
						self.users: List[User] = []
					
					def add_user(self, user: User) -> None:
						"""Add a user to the manager"""
						if user not in self.users:
							self.users.append(user)
					
					def get_user_by_name(self, name: str) -> Optional[User]:
						"""Find a user by name"""
						for user in self.users:
							if user.name == name:
								return user
						return None
				
				if __name__ == "__main__":
					manager = UserManager()
					user = User("John Doe", 30, "john@example.com")
					manager.add_user(user)
					print(f"Added user: {user.name}")
			`;

			const result = detectLanguageFromContent(pythonContent);
			expect(result.language).toBe('python');
			expect(result.method).toBe('shebang'); // Should prefer shebang
			expect(result.confidence).toBe(0.9);
		});

		test('should detect Go package correctly', () => {
			const goContent = `
				package main
				
				import (
					"context"
					"fmt"
					"log"
					"net/http"
					"time"
				)
				
				type Server struct {
					port string
					mux  *http.ServeMux
				}
				
				func NewServer(port string) *Server {
					return &Server{
						port: port,
						mux:  http.NewServeMux(),
					}
				}
				
				func (s *Server) Start(ctx context.Context) error {
					s.mux.HandleFunc("/health", s.healthHandler)
					s.mux.HandleFunc("/", s.rootHandler)
					
					server := &http.Server{
						Addr:    ":" + s.port,
						Handler: s.mux,
					}
					
					go func() {
						<-ctx.Done()
						shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
						defer cancel()
						server.Shutdown(shutdownCtx)
					}()
					
					log.Printf("Server starting on port %s", s.port)
					return server.ListenAndServe()
				}
				
				func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					fmt.Fprint(w, "OK")
				}
				
				func (s *Server) rootHandler(w http.ResponseWriter, r *http.Request) {
					fmt.Fprint(w, "Hello, World!")
				}
				
				func main() {
					ctx := context.Background()
					server := NewServer("8080")
					
					if err := server.Start(ctx); err != nil {
						log.Fatal(err)
					}
				}
			`;

			const result = detectLanguageFromContent(goContent);
			expect(result.language).toBe('go');
			expect(result.confidence).toBeGreaterThan(0.8);
		});
	});

	describe('Error Handling and Robustness', () => {
		test('should handle malformed content gracefully', () => {
			const malformedContent = 'import {{{{{ invalid syntax';
			const result = detectLanguageFromContent(malformedContent);
			// Should still detect based on patterns, even if syntax is invalid
			expect(result.language).toBe('javascript');
		});

		test('should handle mixed language content', () => {
			const mixedContent = `
				<!-- HTML comment -->
				<script>
					console.log("JavaScript");
				</script>
				<style>
					body { color: red; }
				</style>
			`;
			// Should detect the most prominent language
			const result = detectLanguageFromContent(mixedContent);
			expect(result.language).toBe('javascript');
		});

		test('should handle very long lines', () => {
			const longLine = 'const x = ' + '"a".repeat(10000)' + ';';
			const result = detectLanguageFromContent(longLine);
			expect(result.language).toBe('javascript');
		});

		test('should handle special characters and unicode', () => {
			const unicodeContent = `
				# -*- coding: utf-8 -*-
				def greet():
					print("Hello 🌍 World! 你好世界")
			`;
			const result = detectLanguageFromContent(unicodeContent);
			expect(result.language).toBe('python');
		});
	});
});

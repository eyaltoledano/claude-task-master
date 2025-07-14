/**
 * Task Master Flow Design System
 * Comprehensive design tokens and styling standards
 */

// Color Palette
export const colors = {
	// Primary colors
	primary: {
		50: '#eff6ff',
		100: '#dbeafe',
		200: '#bfdbfe',
		300: '#93c5fd',
		400: '#60a5fa',
		500: '#3b82f6',
		600: '#2563eb',
		700: '#1d4ed8',
		800: '#1e40af',
		900: '#1e3a8a'
	},

	// Success colors
	success: {
		50: '#f0fdf4',
		100: '#dcfce7',
		200: '#bbf7d0',
		300: '#86efac',
		400: '#4ade80',
		500: '#22c55e',
		600: '#16a34a',
		700: '#15803d',
		800: '#166534',
		900: '#14532d'
	},

	// Warning colors
	warning: {
		50: '#fffbeb',
		100: '#fef3c7',
		200: '#fde68a',
		300: '#fcd34d',
		400: '#fbbf24',
		500: '#f59e0b',
		600: '#d97706',
		700: '#b45309',
		800: '#92400e',
		900: '#78350f'
	},

	// Error colors
	error: {
		50: '#fef2f2',
		100: '#fee2e2',
		200: '#fecaca',
		300: '#fca5a5',
		400: '#f87171',
		500: '#ef4444',
		600: '#dc2626',
		700: '#b91c1c',
		800: '#991b1b',
		900: '#7f1d1d'
	},

	// Neutral colors
	neutral: {
		50: '#f9fafb',
		100: '#f3f4f6',
		200: '#e5e7eb',
		300: '#d1d5db',
		400: '#9ca3af',
		500: '#6b7280',
		600: '#4b5563',
		700: '#374151',
		800: '#1f2937',
		900: '#111827'
	},

	// Dark mode colors
	dark: {
		50: '#ffffff',
		100: '#f8fafc',
		200: '#f1f5f9',
		300: '#e2e8f0',
		400: '#cbd5e1',
		500: '#94a3b8',
		600: '#64748b',
		700: '#475569',
		800: '#334155',
		900: '#1e293b',
		950: '#0f172a'
	}
};

// Typography
export const typography = {
	fontFamily: {
		sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
		mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace']
	},

	fontSize: {
		xs: ['0.75rem', { lineHeight: '1rem' }],
		sm: ['0.875rem', { lineHeight: '1.25rem' }],
		base: ['1rem', { lineHeight: '1.5rem' }],
		lg: ['1.125rem', { lineHeight: '1.75rem' }],
		xl: ['1.25rem', { lineHeight: '1.75rem' }],
		'2xl': ['1.5rem', { lineHeight: '2rem' }],
		'3xl': ['1.875rem', { lineHeight: '2.25rem' }],
		'4xl': ['2.25rem', { lineHeight: '2.5rem' }]
	},

	fontWeight: {
		normal: '400',
		medium: '500',
		semibold: '600',
		bold: '700'
	}
};

// Spacing
export const spacing = {
	px: '1px',
	0: '0',
	0.5: '0.125rem',
	1: '0.25rem',
	1.5: '0.375rem',
	2: '0.5rem',
	2.5: '0.625rem',
	3: '0.75rem',
	3.5: '0.875rem',
	4: '1rem',
	5: '1.25rem',
	6: '1.5rem',
	7: '1.75rem',
	8: '2rem',
	9: '2.25rem',
	10: '2.5rem',
	11: '2.75rem',
	12: '3rem',
	14: '3.5rem',
	16: '4rem',
	20: '5rem',
	24: '6rem',
	28: '7rem',
	32: '8rem',
	36: '9rem',
	40: '10rem',
	44: '11rem',
	48: '12rem',
	52: '13rem',
	56: '14rem',
	60: '15rem',
	64: '16rem',
	72: '18rem',
	80: '20rem',
	96: '24rem'
};

// Shadows
export const shadows = {
	sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
	base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
	md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
	lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
	xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
	'2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
	inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
	none: '0 0 #0000'
};

// Border Radius
export const borderRadius = {
	none: '0',
	sm: '0.125rem',
	base: '0.25rem',
	md: '0.375rem',
	lg: '0.5rem',
	xl: '0.75rem',
	'2xl': '1rem',
	'3xl': '1.5rem',
	full: '9999px'
};

// Animations
export const animations = {
	// Duration
	duration: {
		75: '75ms',
		100: '100ms',
		150: '150ms',
		200: '200ms',
		300: '300ms',
		500: '500ms',
		700: '700ms',
		1000: '1000ms'
	},

	// Timing functions
	timing: {
		linear: 'linear',
		in: 'cubic-bezier(0.4, 0, 1, 1)',
		out: 'cubic-bezier(0, 0, 0.2, 1)',
		inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
		bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
		spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
	},

	// Keyframes
	keyframes: {
		fadeIn: {
			from: { opacity: 0 },
			to: { opacity: 1 }
		},
		fadeOut: {
			from: { opacity: 1 },
			to: { opacity: 0 }
		},
		slideIn: {
			from: { transform: 'translateX(-100%)', opacity: 0 },
			to: { transform: 'translateX(0)', opacity: 1 }
		},
		slideOut: {
			from: { transform: 'translateX(0)', opacity: 1 },
			to: { transform: 'translateX(-100%)', opacity: 0 }
		},
		scaleIn: {
			from: { transform: 'scale(0.95)', opacity: 0 },
			to: { transform: 'scale(1)', opacity: 1 }
		},
		scaleOut: {
			from: { transform: 'scale(1)', opacity: 1 },
			to: { transform: 'scale(0.95)', opacity: 0 }
		},
		spin: {
			from: { transform: 'rotate(0deg)' },
			to: { transform: 'rotate(360deg)' }
		},
		pulse: {
			'0%, 100%': { opacity: 1 },
			'50%': { opacity: 0.5 }
		},
		bounce: {
			'0%, 100%': {
				transform: 'translateY(-25%)',
				animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)'
			},
			'50%': {
				transform: 'none',
				animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)'
			}
		},
		shake: {
			'0%, 100%': { transform: 'translateX(0)' },
			'10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-10px)' },
			'20%, 40%, 60%, 80%': { transform: 'translateX(10px)' }
		}
	}
};

// Workflow-specific icons
export const icons = {
	workflow: {
		pending: '⏳',
		inProgress: '🔄',
		done: '✅',
		blocked: '🚫',
		cancelled: '❌',
		review: '👀'
	},

	git: {
		branch: '🌿',
		commit: '📝',
		merge: '🔀',
		pull: '⬇️',
		push: '⬆️',
		conflict: '⚠️'
	},

	actions: {
		edit: '✏️',
		delete: '🗑️',
		save: '💾',
		copy: '📋',
		search: '🔍',
		filter: '🔽',
		refresh: '🔄',
		settings: '⚙️',
		help: '❓',
		close: '✖️'
	},

	status: {
		success: '✅',
		warning: '⚠️',
		error: '❌',
		info: 'ℹ️',
		loading: '⏳'
	}
};

// Component variants
export const variants = {
	button: {
		primary: {
			background: colors.primary[600],
			color: colors.neutral[50],
			border: 'none',
			'&:hover': {
				background: colors.primary[700]
			},
			'&:active': {
				background: colors.primary[800]
			},
			'&:disabled': {
				background: colors.neutral[400],
				cursor: 'not-allowed'
			}
		},

		secondary: {
			background: colors.neutral[200],
			color: colors.neutral[800],
			border: `1px solid ${colors.neutral[300]}`,
			'&:hover': {
				background: colors.neutral[300]
			},
			'&:active': {
				background: colors.neutral[400]
			},
			'&:disabled': {
				background: colors.neutral[100],
				color: colors.neutral[500],
				cursor: 'not-allowed'
			}
		},

		success: {
			background: colors.success[600],
			color: colors.neutral[50],
			border: 'none',
			'&:hover': {
				background: colors.success[700]
			},
			'&:active': {
				background: colors.success[800]
			}
		},

		warning: {
			background: colors.warning[600],
			color: colors.neutral[50],
			border: 'none',
			'&:hover': {
				background: colors.warning[700]
			},
			'&:active': {
				background: colors.warning[800]
			}
		},

		danger: {
			background: colors.error[600],
			color: colors.neutral[50],
			border: 'none',
			'&:hover': {
				background: colors.error[700]
			},
			'&:active': {
				background: colors.error[800]
			}
		},

		ghost: {
			background: 'transparent',
			color: colors.neutral[700],
			border: 'none',
			'&:hover': {
				background: colors.neutral[100]
			},
			'&:active': {
				background: colors.neutral[200]
			}
		}
	},

	input: {
		default: {
			background: colors.neutral[50],
			border: `1px solid ${colors.neutral[300]}`,
			borderRadius: borderRadius.md,
			padding: `${spacing[2]} ${spacing[3]}`,
			fontSize: typography.fontSize.sm[0],
			'&:focus': {
				outline: 'none',
				borderColor: colors.primary[500],
				boxShadow: `0 0 0 3px ${colors.primary[100]}`
			},
			'&:disabled': {
				background: colors.neutral[100],
				color: colors.neutral[500],
				cursor: 'not-allowed'
			}
		},

		error: {
			borderColor: colors.error[500],
			'&:focus': {
				borderColor: colors.error[500],
				boxShadow: `0 0 0 3px ${colors.error[100]}`
			}
		}
	},

	card: {
		default: {
			background: colors.neutral[50],
			border: `1px solid ${colors.neutral[200]}`,
			borderRadius: borderRadius.lg,
			padding: spacing[6],
			boxShadow: shadows.base
		},

		elevated: {
			background: colors.neutral[50],
			border: `1px solid ${colors.neutral[200]}`,
			borderRadius: borderRadius.lg,
			padding: spacing[6],
			boxShadow: shadows.lg
		},

		interactive: {
			background: colors.neutral[50],
			border: `1px solid ${colors.neutral[200]}`,
			borderRadius: borderRadius.lg,
			padding: spacing[6],
			boxShadow: shadows.base,
			cursor: 'pointer',
			transition: `all ${animations.duration[200]} ${animations.timing.inOut}`,
			'&:hover': {
				borderColor: colors.primary[300],
				boxShadow: shadows.md,
				transform: 'translateY(-2px)'
			}
		}
	}
};

// Theme configuration
export const theme = {
	light: {
		background: colors.neutral[50],
		surface: colors.neutral[100],
		text: {
			primary: colors.neutral[900],
			secondary: colors.neutral[600],
			disabled: colors.neutral[400]
		},
		border: colors.neutral[200],
		accent: colors.primary[600]
	},

	dark: {
		background: colors.dark[950],
		surface: colors.dark[900],
		text: {
			primary: colors.dark[50],
			secondary: colors.dark[300],
			disabled: colors.dark[500]
		},
		border: colors.dark[800],
		accent: colors.primary[400]
	}
};

// Utility functions
export const utils = {
	// Get color with opacity
	rgba: (color, alpha) => {
		const hex = color.replace('#', '');
		const r = parseInt(hex.substr(0, 2), 16);
		const g = parseInt(hex.substr(2, 2), 16);
		const b = parseInt(hex.substr(4, 2), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	},

	// Create transition string
	transition: (
		properties,
		duration = animations.duration[200],
		timing = animations.timing.inOut
	) => {
		const props = Array.isArray(properties)
			? properties.join(', ')
			: properties;
		return `${props} ${duration} ${timing}`;
	},

	// Create responsive breakpoint
	breakpoint: (size, styles) => {
		const breakpoints = {
			sm: '640px',
			md: '768px',
			lg: '1024px',
			xl: '1280px',
			'2xl': '1536px'
		};
		return `@media (min-width: ${breakpoints[size]}) { ${styles} }`;
	},

	// Create focus ring
	focusRing: (color = colors.primary[500]) => ({
		outline: 'none',
		boxShadow: `0 0 0 3px ${utils.rgba(color, 0.2)}`
	})
};

export default {
	colors,
	typography,
	spacing,
	shadows,
	borderRadius,
	animations,
	icons,
	variants,
	theme,
	utils
};

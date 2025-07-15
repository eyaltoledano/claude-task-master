import { extendTheme } from '@inkjs/ui';
import { getTheme } from '../../theme.js';

export function createInkUITheme() {
	const currentTheme = getTheme();

	return {
		components: {
			ProgressBar: {
				styles: {
					container: () => ({ borderStyle: 'round' }),
					bar: () => ({ color: currentTheme.accent || 'cyan' })
				}
			},
			StatusMessage: {
				styles: {
					icon: ({ variant }) => ({
						color:
							variant === 'success'
								? currentTheme.success || 'green'
								: variant === 'error'
									? currentTheme.error || 'red'
									: variant === 'warning'
										? currentTheme.warning || 'yellow'
										: currentTheme.info || 'blue'
					})
				}
			},
			Spinner: {
				styles: {
					frame: () => ({ color: currentTheme.accent || 'cyan' }),
					label: () => ({ color: currentTheme.text || 'white' })
				}
			},
			Badge: {
				styles: {
					badge: ({ color }) => ({
						backgroundColor: color,
						color: currentTheme.background || 'black'
					})
				}
			},
			Select: {
				styles: {
					item: ({ isSelected }) => ({
						color: isSelected
							? currentTheme.accent || 'cyan'
							: currentTheme.text || 'white',
						backgroundColor: isSelected
							? currentTheme.highlight || 'gray'
							: 'transparent'
					}),
					indicator: () => ({
						color: currentTheme.accent || 'cyan'
					})
				}
			}
		}
	};
}

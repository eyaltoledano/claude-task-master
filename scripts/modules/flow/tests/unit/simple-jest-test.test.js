/**
 * Simple Jest Test - No ES Module Imports
 */

describe('Simple Jest Test', () => {
    test('basic Jest functionality works', () => {
        expect(1 + 1).toBe(2);
        expect(typeof jest).toBe('object');
    });
    
    test('can run async tests', async () => {
        const result = await Promise.resolve('test');
        expect(result).toBe('test');
    });
    
    test('mocking works', () => {
        const mockFn = jest.fn();
        mockFn('test');
        expect(mockFn).toHaveBeenCalledWith('test');
    });
});

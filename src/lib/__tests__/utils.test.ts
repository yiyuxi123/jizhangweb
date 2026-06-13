import { describe, it, expect } from 'vitest';
import { cn, compressImage } from '../utils';

describe('cn (classname utility)', () => {
  it('should merge tailwind classes correctly', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('should handle conditional classes', () => {
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });

  it('should handle undefined and null', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra');
  });

  it('should merge conflicting tailwind classes (later wins)', () => {
    const result = cn('p-4', 'p-2');
    // tailwind-merge resolves p-2 as the winner
    expect(result).toContain('p-2');
    expect(result).not.toContain('p-4');
  });

  it('should return empty string for no args', () => {
    expect(cn()).toBe('');
  });
});

describe('compressImage', () => {
  it('should be a function', () => {
    expect(typeof compressImage).toBe('function');
  });

  it('should return a Promise', () => {
    const result = compressImage('data:image/jpeg;base64,/9j/4AAQ');
    expect(result).toBeInstanceOf(Promise);
  });
});

import { it, expect } from 'vitest'
import { parse_dimension } from './parse-dimension'

it('should parse integer with unit', () => {
	expect(parse_dimension('100px')).toEqual({ value: 100, unit: 'px' })
})

it('should parse float with unit', () => {
	expect(parse_dimension('1.5em')).toEqual({ value: 1.5, unit: 'em' })
})

it('should parse percentage', () => {
	expect(parse_dimension('50%')).toEqual({ value: 50, unit: '%' })
})

it('should parse negative value', () => {
	expect(parse_dimension('-10rem')).toEqual({ value: -10, unit: 'rem' })
})

it('should parse positive value with sign', () => {
	expect(parse_dimension('+5px')).toEqual({ value: 5, unit: 'px' })
})

it('should parse value with decimal point', () => {
	expect(parse_dimension('0.5em')).toEqual({ value: 0.5, unit: 'em' })
})

it('should parse scientific notation', () => {
	expect(parse_dimension('1e2px')).toEqual({ value: 100, unit: 'px' })
})

it('should parse scientific notation with positive exponent', () => {
	expect(parse_dimension('1e+2px')).toEqual({ value: 100, unit: 'px' })
})

it('should parse scientific notation with negative exponent', () => {
	expect(parse_dimension('1e-2px')).toEqual({ value: 0.01, unit: 'px' })
})

it('should parse uppercase E scientific notation', () => {
	expect(parse_dimension('1E2px')).toEqual({ value: 100, unit: 'px' })
})

it('should handle no unit', () => {
	expect(parse_dimension('100')).toEqual({ value: 100, unit: '' })
})

it('should handle zero', () => {
	expect(parse_dimension('0')).toEqual({ value: 0, unit: '' })
})

it('should handle zero with unit', () => {
	expect(parse_dimension('0px')).toEqual({ value: 0, unit: 'px' })
})

it('should handle fractional value starting with dot', () => {
	expect(parse_dimension('.5em')).toEqual({ value: 0.5, unit: 'em' })
})

it('should handle long unit name', () => {
	expect(parse_dimension('100vmax')).toEqual({ value: 100, unit: 'vmax' })
})

it('should handle invalid scientific notation (e not followed by digit)', () => {
	expect(parse_dimension('1epx')).toEqual({ value: 1, unit: 'epx' })
})

it('should handle multiple decimal points', () => {
	// parseFloat stops after first complete number, so numEnd continues past the period
	expect(parse_dimension('1.2.3px')).toEqual({ value: 1.2, unit: 'px' })
})

it('should handle empty string', () => {
	expect(parse_dimension('')).toEqual({ value: 0, unit: '' })
})

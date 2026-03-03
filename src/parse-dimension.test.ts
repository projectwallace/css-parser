import { it, expect, describe } from 'vitest'
import { parse_dimension } from './parse-dimension'

describe('unit casing matrix', () => {
	it.each([
		['1px', 'px'],
		['1PX', 'PX'],
		['1Px', 'Px'],
		['1em', 'em'],
		['1EM', 'EM'],
		['1Em', 'Em'],
		['1rem', 'rem'],
		['1REM', 'REM'],
		['1Rem', 'Rem'],
		['1vw', 'vw'],
		['1VW', 'VW'],
		['1Vw', 'Vw'],
		['1vh', 'vh'],
		['1VH', 'VH'],
		['1Vh', 'Vh'],
		['1deg', 'deg'],
		['1DEG', 'DEG'],
		['1Deg', 'Deg'],
		['1ms', 'ms'],
		['1MS', 'MS'],
		['1Ms', 'Ms'],
		['1hz', 'hz'],
		['1HZ', 'HZ'],
		['1Hz', 'Hz'],
	])('%s', (input, unit) => {
		expect(parse_dimension(input)).toEqual({ value: 1, unit })
	})
})

describe('plain numbers', () => {
	it.each([
		['1', 1],
		['42', 42],
		['100', 100],
		['999999', 999999],
		['+5', 5],
		['+0', 0],
	])('%s', (input, value) => {
		expect(parse_dimension(input)).toEqual({ value, unit: '' })
	})
})

describe('decimals', () => {
	it.each([
		['.5', 0.5, ''],
		['.5em', 0.5, 'em'],
		['0.5', 0.5, ''],
		['0.5em', 0.5, 'em'],
		['1.5', 1.5, ''],
		['1.5em', 1.5, 'em'],
		['3.14159', 3.14159, ''],
		['0.001', 0.001, ''],
		['0.001px', 0.001, 'px'],
	])('%s', (input, value, unit) => {
		expect(parse_dimension(input)).toEqual({ value, unit })
	})
})

describe('zero values', () => {
	it.each([
		['0', 0, ''],
		['0px', 0, 'px'],
		['0em', 0, 'em'],
		['0%', 0, '%'],
		['0.0', 0, ''],
		['0.0px', 0, 'px'],
		['+0', 0, ''],
		['+0px', 0, 'px'],
		['-0', -0, ''],
		['-0px', -0, 'px'],
	])('%s', (input, value, unit) => {
		expect(parse_dimension(input)).toEqual({ value, unit })
	})
})

describe('negative numbers', () => {
	it.each([
		['-1', -1, ''],
		['-10rem', -10, 'rem'],
		['-100', -100, ''],
		['-1.5', -1.5, ''],
		['-.5', -0.5, ''],
		['-1.5em', -1.5, 'em'],
		['-.5px', -0.5, 'px'],
		['-50%', -50, '%'],
	])('%s', (input, value, unit) => {
		expect(parse_dimension(input)).toEqual({ value, unit })
	})
})

describe('percentage cases', () => {
	it.each([
		['1%', 1, '%'],
		['50%', 50, '%'],
		['100%', 100, '%'],
		['0.5%', 0.5, '%'],
		['0.001%', 0.001, '%'],
		['+10%', 10, '%'],
		['-50%', -50, '%'],
		['0%', 0, '%'],
	])('%s', (input, value, unit) => {
		expect(parse_dimension(input)).toEqual({ value, unit })
	})
})

describe('scientific notation', () => {
	it.each([
		['1e2px', 100, 'px'],
		['1e+2px', 100, 'px'],
		['1E2px', 100, 'px'],
		['2.5e3em', 2500, 'em'],
		['0.5e2px', 50, 'px'],
		['1e10', 1e10, ''],
		['1.5E+2rem', 150, 'rem'],
		['1E+2', 100, ''],
	])('%s', (input, value, unit) => {
		expect(parse_dimension(input)).toEqual({ value, unit })
	})
})

describe('negative scientific notation', () => {
	it.each([
		['-1e2px', -100, 'px'],
		['-2.5e3em', -2500, 'em'],
		['-1E2', -100, ''],
		['-0.5e2px', -50, 'px'],
		['-1e+2px', -100, 'px'],
	])('%s', (input, value, unit) => {
		expect(parse_dimension(input)).toEqual({ value, unit })
	})
})

describe('scientific notation with negative exponent', () => {
	it.each([
		['1e-2px', 0.01, 'px'],
		['5e-3em', 0.005, 'em'],
		['2.5E-2rem', 0.025, 'rem'],
		['1e-1', 0.1, ''],
		['1E-10', 1e-10, ''],
		['-3e-2px', -0.03, 'px'],
		['-1e-1', -0.1, ''],
	])('%s', (input, value, unit) => {
		expect(parse_dimension(input)).toEqual({ value, unit })
	})
})

describe('syntactical errors', () => {
	it.each([
		['', 0, ''],
		['abc', 0, 'abc'],
		['px100', 0, 'px100'],
		['1..5px', 1, 'px'],
		['1.2.3px', 1.2, 'px'],
		['--5px', NaN, 'px'],
		['++5px', NaN, 'px'],
		['1epx', 1, 'epx'],
		['1ea', 1, 'ea'],
		['1e', 1, 'e'],
		['1e+', 1, 'e+'],
		['1e+a', 1, 'e+a'],
	])('%s', (input, value, unit) => {
		expect(parse_dimension(input)).toEqual({ value, unit })
	})
})

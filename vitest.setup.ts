import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TAILWIND_VERSION = '2.2.19'
const BASE_URL = `https://unpkg.com/tailwindcss@${TAILWIND_VERSION}/dist`
const DEST_DIR = resolve('node_modules/tailwindcss/dist')
const FILES = ['tailwind.css', 'tailwind.min.css']

async function downloadFile(url: string, dest: string): Promise<void> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
	writeFileSync(dest, await res.text(), 'utf-8')
}

export async function ensureTailwindFixtures(): Promise<void> {
	mkdirSync(DEST_DIR, { recursive: true })
	await Promise.all(
		FILES.map((file) => {
			const dest = resolve(DEST_DIR, file)
			if (existsSync(dest)) return Promise.resolve()
			return downloadFile(`${BASE_URL}/${file}`, dest)
		}),
	)
}

// vitest globalSetup entry point
export async function setup(): Promise<void> {
	await ensureTailwindFixtures()
}

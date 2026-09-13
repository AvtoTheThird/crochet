/**
 * Apply the latest SQL migration using DATABASE_URL from the environment.
 * Usage: node --env-file=.env scripts/apply-migration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('Set DATABASE_URL (see .env.example)');
	process.exit(1);
}

const migrationsDir = path.resolve('supabase/migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
if (!files.length) {
	console.error('No migrations found');
	process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
	for (const file of files) {
		const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
		process.stdout.write(`Applying ${file}… `);
		await client.query(sql);
		console.log('ok');
	}
} catch (e) {
	console.error('\nFailed:', e.message);
	process.exitCode = 1;
} finally {
	await client.end();
}

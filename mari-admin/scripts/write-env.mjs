import fs from 'node:fs';
import crypto from 'node:crypto';

const url = process.env.PUBLIC_SUPABASE_URL || '';
const secret = crypto.randomBytes(24).toString('hex');
const body = `# Auto-prepared. Fill SUPABASE_SERVICE_ROLE_KEY from Supabase → Settings → API.
SUPABASE_URL=${url}
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=admin
ADMIN_SESSION_SECRET=${secret}
`;
fs.writeFileSync(new URL('./.env', import.meta.url), body);
console.log('Wrote mari-admin/.env (add SERVICE_ROLE_KEY manually)');

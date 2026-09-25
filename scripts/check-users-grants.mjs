import pg from 'pg';

const c = new pg.Client({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});
await c.connect();

const table = await c.query(`
	select grantee, privilege_type
	from information_schema.role_table_grants
	where table_schema = 'public'
	  and table_name = 'users'
	  and grantee in ('anon', 'authenticated', 'service_role')
	order by 1, 2
`);
console.log('table grants:', table.rows);

const cols = await c.query(`
	select column_name, privilege_type
	from information_schema.column_privileges
	where table_schema = 'public'
	  and table_name = 'users'
	  and grantee = 'authenticated'
	order by 1, 2
`);
console.log('authenticated column privileges:', cols.rows);

await c.end();

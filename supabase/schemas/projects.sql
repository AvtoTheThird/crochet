-- Tapestry / pattern projects (many per user)

create table public.projects (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete cascade,
	name text not null,
	-- Supabase Storage path to cropped working-canvas PNG (not the original upload)
	image_url text not null,
	image_width integer not null,
	image_height integer not null,
	pixel_width numeric not null,
	pixel_height numeric not null,
	color_tolerance integer not null default 20,
	start_direction text not null default 'left'
		check (start_direction in ('left', 'right')),
	palette jsonb not null default '[]'::jsonb,
	count_results jsonb not null default '[]'::jsonb,
	grid_opacity integer not null default 35,
	current_row integer not null default 0,
	completed_rows integer[] not null default '{}'::integer[],
	studio_step integer not null default 2,
	walk_index integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);
create index projects_updated_at_idx on public.projects (updated_at desc);

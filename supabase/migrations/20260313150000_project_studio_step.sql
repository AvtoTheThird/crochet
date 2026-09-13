-- Restore workflow step when loading a project
alter table public.projects
	add column if not exists studio_step integer not null default 2;

alter table public.projects
	add column if not exists walk_index integer not null default 0;

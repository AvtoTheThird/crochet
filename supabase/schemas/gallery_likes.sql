-- One like per registered user per published gallery project

create table public.gallery_likes (
	project_id uuid not null references public.projects (id) on delete cascade,
	user_id uuid not null references public.users (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (project_id, user_id)
);

create index gallery_likes_user_id_idx on public.gallery_likes (user_id);
create index gallery_likes_project_id_idx on public.gallery_likes (project_id);

-- Grid cell sizes may be fractional in the studio UI
alter table public.projects
	alter column pixel_width type numeric using pixel_width::numeric,
	alter column pixel_height type numeric using pixel_height::numeric;

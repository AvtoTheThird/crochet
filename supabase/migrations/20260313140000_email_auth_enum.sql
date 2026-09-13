-- Part 1: extend enum (must commit before the value is used elsewhere)

alter type public.auth_provider add value if not exists 'email';

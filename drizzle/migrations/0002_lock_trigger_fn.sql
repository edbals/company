revoke execute on function public.handle_new_user() from public, anon, authenticated;
comment on table public.invitations is 'Locked: only reachable through create_invitation/accept_invitation, which hash codes and check roles.';

A personal access token lets a script act as you, without your password and
without your session.

## Creating one

**Settings → API tokens**. Give it a name, choose how long it lives, and tick the
scopes it needs.

The token is shown once. There is no way to see it again — only a hash is stored,
the same way a password is — so copy it before you leave the page.

## Scopes

A token can only do what you ticked. Choosing a write scope implies its read
twin, because a token that may change something can obviously see it.

Two things a token can never do, whatever you tick: create another token, and
close your account. A narrow leak must not be able to widen itself.

## Lifetime

A day, a week, a fortnight, a month, ninety days, a year, two years, or never.
Pick the shortest that fits what you are building.

## Using it

Send it as a bearer token:

```
Authorization: Bearer spx_your_token_here
```

## If it leaks

Revoke it from the same page. Revoking takes effect immediately.

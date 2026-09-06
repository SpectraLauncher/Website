If you are building something other people will sign in to, register it as an
application rather than asking them for a token.

## Registering

**Settings → Applications**. You need:

- A **name**, which is what people see when they are asked to approve it
- **Redirect addresses** — where the browser comes back to. https only, except
  localhost, so a desktop application has somewhere to listen
- The **most it may ever ask for** — a ceiling on scopes
- A **token lifetime**

You get a client id and a secret. The secret is shown once, and can be rotated
without re-registering anything.

## The flow

1. Send the person to `/oauth/authorize` with your `client_id`, a `redirect_uri`,
   the `scope` you want and a `state` of your own
2. They see what you are asking for and for how long, and approve or refuse
3. They come back to your redirect with a `code` and your `state`
4. Exchange the code at `/api/oauth/token` with your client secret

## Rules worth knowing before you debug

- The redirect must be one you registered — scheme, host, port and path all have
  to match. Only the query may differ
- A code is good for ten minutes, once, and only for the redirect it was issued
  for
- Every failed exchange answers the same way, so you cannot tell expired from
  already-used from wrong-client. That is on purpose

## Withdrawing access

People can withdraw it under **Settings → Applications**, and that deletes the
tokens too. Do not assume a token stays valid until it expires.

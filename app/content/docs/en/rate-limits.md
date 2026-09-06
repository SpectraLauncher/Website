Requests are limited per address, so one busy client cannot spoil the site for
everyone else.

## What to expect

A limit that has been reached answers **429** with a `retry-after` header saying
how many seconds to wait. Honour it — retrying immediately just spends the next
window.

Budgets differ by endpoint. Reading is generous, writing is tighter, and anything
that sends mail or reaches every moderator is tighter still.

## Writing a client that behaves

- Read `retry-after` rather than guessing
- Back off rather than retrying in a loop
- Cache what does not change. Project and version data carry an ETag, so a
  conditional request costs almost nothing when nothing has moved
- Ask for what you need. A hash lookup for one file beats downloading a listing

## Bulk lookups

Launchers identify unknown files by hash. There is an endpoint for looking up
many hashes at once, and it is far kinder than a request per file.

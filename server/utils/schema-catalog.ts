
import { usePool } from './db'

// The backbone of the content catalog: Project -> Version -> File, one set of
// tables for all five types. Differences between types live in the `meta` JSONB
// columns, never in separate tables.
//
// Same pattern as ensureSchema(): CREATE TABLE IF NOT EXISTS to begin with, and
// every later column in its own ALTER ... ADD COLUMN IF NOT EXISTS, because on a
// database that already has the table, IF NOT EXISTS skips the whole statement.
//
// no migration versioning. At the first destructive change (dropping a
// column, rebuilding an index) add a schema_migration table with a number and
// run the steps in order.
export async function ensureCatalogSchema() {
  const pool = usePool()

  await adoptTextIds(pool)

  await pool.query(`
    -- Project. game_versions and loaders are denormalised here as the union over
    -- versions — a listing asks for "mods for 1.20.1 on Fabric", not "versions
    -- for 1.20.1", and without these columns every listing becomes an EXISTS over
    -- the version table with deduplication, and sorting by downloads stops being
    -- cheap. Recomputed in refreshProjectFacets() after every version change.
    --
    -- The owner is an account OR an organization, exactly one of the two.
    CREATE TABLE IF NOT EXISTS project (
      id            TEXT PRIMARY KEY,
      slug          TEXT NOT NULL UNIQUE,
      type          TEXT NOT NULL,
      owner_id      TEXT REFERENCES "user"(id) ON DELETE CASCADE,
      org_id        TEXT,
      title         TEXT NOT NULL,
      summary       TEXT NOT NULL DEFAULT '',
      description   TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'draft',
      license       TEXT,
      license_url   TEXT,
      icon          TEXT,
      categories    TEXT[] NOT NULL DEFAULT '{}',
      game_versions TEXT[] NOT NULL DEFAULT '{}',
      loaders       TEXT[] NOT NULL DEFAULT '{}',
      links         JSONB  NOT NULL DEFAULT '{}',
      meta          JSONB  NOT NULL DEFAULT '{}',
      downloads     BIGINT NOT NULL DEFAULT 0,
      follows       INTEGER NOT NULL DEFAULT 0,
      created       BIGINT NOT NULL,
      updated       BIGINT NOT NULL,
      published     BIGINT,
      CONSTRAINT project_one_owner CHECK (num_nonnulls(owner_id, org_id) = 1)
    );

    CREATE INDEX IF NOT EXISTS idx_project_game_versions ON project USING GIN (game_versions);
    CREATE INDEX IF NOT EXISTS idx_project_loaders       ON project USING GIN (loaders);
    CREATE INDEX IF NOT EXISTS idx_project_categories    ON project USING GIN (categories);
    CREATE INDEX IF NOT EXISTS idx_project_browse        ON project (type, status, downloads DESC);
    CREATE INDEX IF NOT EXISTS idx_project_owner         ON project (owner_id);
    CREATE INDEX IF NOT EXISTS idx_project_org           ON project (org_id);

    CREATE TABLE IF NOT EXISTS version (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      number        TEXT NOT NULL,
      name          TEXT NOT NULL DEFAULT '',
      changelog     TEXT NOT NULL DEFAULT '',
      channel       TEXT NOT NULL DEFAULT 'release',
      game_versions TEXT[] NOT NULL DEFAULT '{}',
      loaders       TEXT[] NOT NULL DEFAULT '{}',
      meta          JSONB  NOT NULL DEFAULT '{}',
      downloads     BIGINT NOT NULL DEFAULT 0,
      created       BIGINT NOT NULL,
      UNIQUE (project_id, number)
    );
    CREATE INDEX IF NOT EXISTS idx_version_project ON version (project_id, created DESC);
    CREATE INDEX IF NOT EXISTS idx_version_gv      ON version USING GIN (game_versions);

    -- A file is identified by hash, not by name. object_key carries sha512, so
    -- the same JAR across ten modpacks is stored in R2 once. sha1 exists purely
    -- as a lookup key: the whole Minecraft ecosystem identifies files by sha1 and
    -- the launcher has to speak it, but sha1 is collision-broken and does not get
    -- to decide where a file lives.
    CREATE TABLE IF NOT EXISTS version_file (
      id         TEXT PRIMARY KEY,
      version_id TEXT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
      filename   TEXT   NOT NULL,
      size       BIGINT NOT NULL,
      sha1       TEXT   NOT NULL,
      sha512     TEXT   NOT NULL,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      object_key TEXT   NOT NULL,
      created    BIGINT NOT NULL,
      UNIQUE (version_id, filename)
    );
    CREATE INDEX IF NOT EXISTS idx_version_file_version ON version_file (version_id);
    CREATE INDEX IF NOT EXISTS idx_version_file_sha1    ON version_file (sha1);
    CREATE INDEX IF NOT EXISTS idx_version_file_sha512  ON version_file (sha512);

    -- A dependency points at a project here, a specific version here, or at a
    -- foreign catalog (external = { source: 'modrinth', id: '...' }) — exactly one.
    CREATE TABLE IF NOT EXISTS version_dependency (
      id          TEXT PRIMARY KEY,
      version_id  TEXT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
      kind        TEXT   NOT NULL DEFAULT 'required',
      project_id  TEXT REFERENCES project(id) ON DELETE CASCADE,
      depends_on  TEXT REFERENCES version(id) ON DELETE CASCADE,
      external    JSONB,
      CONSTRAINT dependency_one_target CHECK (num_nonnulls(project_id, depends_on, external) = 1)
    );
    CREATE INDEX IF NOT EXISTS idx_dependency_version ON version_dependency (version_id);

    CREATE TABLE IF NOT EXISTS project_gallery (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      url        TEXT NOT NULL,
      title      TEXT NOT NULL DEFAULT '',
      ordering   INTEGER NOT NULL DEFAULT 0,
      featured   BOOLEAN NOT NULL DEFAULT FALSE,
      created    BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gallery_project ON project_gallery (project_id, ordering);
  `)

  // The organization foreign key is applied separately, because that table is
  // created by the better-auth plugin and does not exist yet on a database from
  // before it was enabled. Without this, ensureCatalogSchema throws at boot and
  // the server never comes up.
  const orgTable = await pool.query(`SELECT to_regclass('public.organization') AS t`)
  if (orgTable.rows[0]?.t) {
    await pool.query(`
      ALTER TABLE project DROP CONSTRAINT IF EXISTS project_org_fk;
      ALTER TABLE project ADD CONSTRAINT project_org_fk
        FOREIGN KEY (org_id) REFERENCES organization(id) ON DELETE CASCADE;
    `)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_follow (
      user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      created    BIGINT NOT NULL,
      PRIMARY KEY (user_id, project_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_follow_project ON project_follow (project_id);
  `)

  await pool.query(`
    -- A user's own list of projects. visibility follows the project rules rather
    -- than inventing new ones: listed shows on the profile, unlisted opens only
    -- for whoever holds the address, private is the owner alone.
    CREATE TABLE IF NOT EXISTS collection (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      summary     TEXT NOT NULL DEFAULT '',
      icon        TEXT,
      visibility  TEXT NOT NULL DEFAULT 'private',
      created     BIGINT NOT NULL,
      updated     BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_collection_user ON collection (user_id, updated DESC);

    -- 'favourites' is the one-click shelf every account gets on first use;
    -- everything else is a list the user made and named. The partial unique
    -- index is what stops a second one appearing on a double click.
    ALTER TABLE collection ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'custom';
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_collection_favourites
      ON collection (user_id) WHERE kind = 'favourites';

    CREATE TABLE IF NOT EXISTS collection_project (
      collection_id TEXT NOT NULL REFERENCES collection(id) ON DELETE CASCADE,
      project_id    TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      added         BIGINT NOT NULL,
      PRIMARY KEY (collection_id, project_id)
    );
    CREATE INDEX IF NOT EXISTS idx_collection_project ON collection_project (project_id);
  `)

  // Daily attribution per project. Views and downloads are what a revenue split
  // is computed from, and they cannot be reconstructed after the fact, so they
  // are collected from the day the catalog opens rather than from the day a
  // payout system exists.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_metric (
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      day        TEXT NOT NULL,
      views      INTEGER NOT NULL DEFAULT 0,
      downloads  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, day)
    );
    CREATE INDEX IF NOT EXISTS idx_project_metric_day ON project_metric (day);
  `)

  // One row per visitor per project per day, purely so a refresh does not count
  // twice. The visitor column is a keyed hash of address and user agent with a
  // salt that changes daily: it cannot be reversed into either, and it stops
  // being linkable to the same person the next day. Rows are pruned once they
  // can no longer affect deduplication.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_view_seen (
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      day        TEXT NOT NULL,
      visitor    TEXT NOT NULL,
      PRIMARY KEY (project_id, day, visitor)
    );
    CREATE INDEX IF NOT EXISTS idx_view_seen_day ON project_view_seen (day);
  `)

  // Applications for partner status and organization verification. Both are
  // moderator decisions rather than switches someone can flip on themselves.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verification_request (
      id          TEXT PRIMARY KEY,
      kind        TEXT NOT NULL,
      user_id     TEXT REFERENCES "user"(id) ON DELETE CASCADE,
      org_id      TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      body        TEXT NOT NULL DEFAULT '',
      links       JSONB NOT NULL DEFAULT '{}',
      reviewed_by TEXT,
      reviewed_at BIGINT,
      review_note TEXT NOT NULL DEFAULT '',
      created     BIGINT NOT NULL,
      CONSTRAINT verification_one_subject CHECK (num_nonnulls(user_id, org_id) = 1)
    );
    CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_request (status, created);
    CREATE INDEX IF NOT EXISTS idx_verification_user ON verification_request (user_id);
    CREATE INDEX IF NOT EXISTS idx_verification_org ON verification_request (org_id);
  `)

  // One open application per subject, so a queue cannot be flooded by resubmitting.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_verification_open_user
      ON verification_request (user_id) WHERE status = 'pending' AND user_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_verification_open_org
      ON verification_request (org_id) WHERE status = 'pending' AND org_id IS NOT NULL
  `)

  await pool.query(`
    -- The moderation record for a project, and the appeal against it. Both sides
    -- write into the same thread: a moderator explains a rejection, the author
    -- answers once the project is fixed. status carries the decision a staff
    -- message enacted, so the thread doubles as the audit trail.
    CREATE TABLE IF NOT EXISTS project_message (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      author_id  TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      staff      BOOLEAN NOT NULL DEFAULT FALSE,
      body       TEXT NOT NULL,
      status     TEXT,
      created    BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_message ON project_message (project_id, created);

    -- Public comments. parent_id gives one level of replies; deeper nesting is
    -- flattened against the same parent by the write path.
    CREATE TABLE IF NOT EXISTS project_comment (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      author_id  TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      parent_id  TEXT REFERENCES project_comment(id) ON DELETE CASCADE,
      body       TEXT NOT NULL,
      hidden     BOOLEAN NOT NULL DEFAULT FALSE,
      created    BIGINT NOT NULL,
      updated    BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_project_comment ON project_comment (project_id, created DESC);
    CREATE INDEX IF NOT EXISTS idx_project_comment_parent ON project_comment (parent_id);
  `)

  await pool.query(`
    ALTER TABLE notification ADD COLUMN IF NOT EXISTS project_id TEXT
      REFERENCES project(id) ON DELETE CASCADE
  `)

  await pool.query(`
    -- Abuse reports. item_id is deliberately not a foreign key: one queue holds
    -- complaints about projects, versions, users, comments and organizations,
    -- and a moderator needs the row to survive the thing it accuses being
    -- deleted, so there is something left to explain the decision.
    CREATE TABLE IF NOT EXISTS report (
      id          TEXT PRIMARY KEY,
      reason      TEXT NOT NULL,
      item_type   TEXT NOT NULL,
      item_id     TEXT NOT NULL,
      reporter_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      body        TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'open',
      note        TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      reviewed_at BIGINT,
      created     BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_report_queue ON report (status, created);
    CREATE INDEX IF NOT EXISTS idx_report_item ON report (item_type, item_id);
    CREATE INDEX IF NOT EXISTS idx_report_reporter ON report (reporter_id, created DESC);
  `)

  // One open report per person per thing. Without this the queue is trivially
  // flooded by resubmitting the same complaint, and a moderator cannot tell
  // whether ten rows are ten people or one person ten times.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_report_open
      ON report (reporter_id, item_type, item_id)
      WHERE status = 'open' AND reporter_id IS NOT NULL
  `)

  // The scanner raises a hand, a person decides. NULL means nobody has looked
  // yet, which is different from having looked and found nothing.
  await pool.query(`
    ALTER TABLE version_file ADD COLUMN IF NOT EXISTS scan_verdict TEXT;
    ALTER TABLE version_file ADD COLUMN IF NOT EXISTS scan_findings JSONB;
    ALTER TABLE version_file ADD COLUMN IF NOT EXISTS scanned_at BIGINT;
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_version_file_flagged
      ON version_file (scan_verdict) WHERE scan_verdict <> 'clean'
  `)

  await pool.query(`
    ALTER TABLE project ADD COLUMN IF NOT EXISTS disclosures JSONB NOT NULL DEFAULT '{}'
  `)

  await pool.query(`
    -- The two or three categories shown before the rest. A subset of categories
    -- rather than a separate vocabulary, so nothing can be featured that the
    -- project does not actually claim.
    ALTER TABLE project ADD COLUMN IF NOT EXISTS featured_categories TEXT[] NOT NULL DEFAULT '{}'
  `)

  await pool.query(`
    -- Where the project goes once a moderator approves it. The author picks it
    -- when the project is created and can change it while it waits, so it has
    -- to live somewhere other than status, which says where the project is now.
    ALTER TABLE project ADD COLUMN IF NOT EXISTS requested_status TEXT NOT NULL DEFAULT 'published'
  `)

  await pool.query(`
    -- Rights granted on one project, to somebody who is not its owner. The
    -- organization grants a working set already; this is for the rest.
    CREATE TABLE IF NOT EXISTS project_member (
      project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      permissions BIGINT NOT NULL DEFAULT 0,
      created     BIGINT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_member_user ON project_member (user_id);
  `)

  // The moderation thread hangs off a project or off a report, never both and
  // never neither. One mechanism rather than two nearly identical tables.
  await pool.query(`
    ALTER TABLE project_message ALTER COLUMN project_id DROP NOT NULL;
    ALTER TABLE project_message ADD COLUMN IF NOT EXISTS report_id TEXT
      REFERENCES report(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_project_message_report
      ON project_message (report_id, created);
  `)

  await pool.query(`
    -- What every stored image belongs to. subject_id is polymorphic on purpose:
    -- one row can point at a project, a version, an organization, an account or
    -- a report, so it cannot be a foreign key and the sweep checks by hand.
    CREATE TABLE IF NOT EXISTS stored_image (
      id         TEXT PRIMARY KEY,
      object_key TEXT NOT NULL UNIQUE,
      context    TEXT NOT NULL,
      owner_id   TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      subject_id TEXT,
      size       BIGINT NOT NULL DEFAULT 0,
      created    BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stored_image_subject ON stored_image (context, subject_id);
  `)

  // Per-member rights inside an organization. NULL means "whatever the role is
  // worth by default", so existing rows keep working without a backfill.
  await pool.query(`
    ALTER TABLE member ADD COLUMN IF NOT EXISTS permissions BIGINT
  `)

  // Both flags are columns rather than fields inside metadata, and deliberately:
  // the organization edit endpoint rewrites metadata wholesale, so a flag living
  // there would be wiped by an owner editing their own description — or worse,
  // set by them.
  await pool.query('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS partner BOOLEAN NOT NULL DEFAULT FALSE')

  const orgTable2 = await pool.query(`SELECT to_regclass('public.organization') AS t`)
  if (orgTable2.rows[0]?.t) {
    await pool.query('ALTER TABLE organization ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE')
  }

  // Selling. Price is in minor units of the currency so nothing ever rounds, and
  // zero means free, which is what every project starts as.
  await pool.query(`ALTER TABLE project ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0`)
  await pool.query(`ALTER TABLE project ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR'`)

  // Who claimed authorship, when, and against which wording. Stored rather than
  // checked in a form, because the claim is the thing that carries weight later
  // and a checkbox that leaves no record proves nothing.
  await pool.query('ALTER TABLE project ADD COLUMN IF NOT EXISTS authorship_by TEXT')
  await pool.query('ALTER TABLE project ADD COLUMN IF NOT EXISTS authorship_at BIGINT')
  await pool.query('ALTER TABLE project ADD COLUMN IF NOT EXISTS authorship_terms TEXT')

  // Environment is a real column rather than a JSONB field because it is a
  // browse filter, and a browse filter that cannot use an index is a browse
  // filter that gets slower every month.
  await pool.query(`ALTER TABLE project ADD COLUMN IF NOT EXISTS environment TEXT[] NOT NULL DEFAULT '{}'`)
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_project_environment ON project USING GIN (environment)')

  // A generated column, so there is nothing to forget to update. 'simple' rather
  // than 'english': mod names are proper nouns ("Sodium", "Iris") and stemming
  // hurts them more than it helps. Typos are handled by pg_trgm below.
  await pool.query(`
    ALTER TABLE project ADD COLUMN IF NOT EXISTS search tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
      ) STORED
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_project_search ON project USING GIN (search)')

  // pg_trgm needs privileges the application role may not have. Search works
  // without it, just without typo tolerance — not a reason to refuse to boot.
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await pool.query(
      'CREATE INDEX IF NOT EXISTS idx_project_title_trgm ON project USING GIN (title gin_trgm_ops)')
  } catch (e) {
    console.warn('[db] pg_trgm unavailable - catalog search without typo tolerance:',
      (e as Error).message)
  }
}

// Catalog ids started out as BIGINT counters and became random base62 strings,
// because a counter makes an unlisted project findable by walking /project/1
// upwards. The tables are rebuilt rather than migrated in place, which is only
// safe while they hold nothing — so this refuses loudly rather than guessing if
// they do not.
async function adoptTextIds(pool: ReturnType<typeof usePool>) {
  const column = await pool.query<{ data_type: string }>(`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'project' AND column_name = 'id'
  `)

  const current = column.rows[0]?.data_type
  if (!current || current === 'text') return

  const counted = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM project')
  const rows = counted.rows[0]?.n ?? 0

  if (rows > 0) {
    throw new Error(`catalog tables still use integer ids and hold ${rows} project(s). `
      + 'Rebuilding would drop them, so this has to be migrated by hand: add a text id '
      + 'column, backfill it, repoint the foreign keys, then swap the primary key.')
  }

  console.info('[db] rebuilding empty catalog tables with text ids')
  await pool.query(`
    DROP TABLE IF EXISTS version_dependency, project_gallery, version_file, version, project CASCADE
  `)
}

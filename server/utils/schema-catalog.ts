
import { usePool } from './db'

// The backbone of the content catalog: Project -> Version -> File, one set of
// tables for all five types. Differences between types live in the `meta` JSONB
// columns, never in separate tables.
//
// Same pattern as ensureSchema(): CREATE TABLE IF NOT EXISTS to begin with, and
// every later column in its own ALTER ... ADD COLUMN IF NOT EXISTS, because on a
// database that already has the table, IF NOT EXISTS skips the whole statement.
//
// ponytail: no migration versioning. At the first destructive change (dropping a
// column, rebuilding an index) add a schema_migration table with a number and
// run the steps in order.
export async function ensureCatalogSchema() {
  const pool = usePool()

  await pool.query(`
    -- Project. game_versions and loaders are denormalised here as the union over
    -- versions — a listing asks for "mods for 1.20.1 on Fabric", not "versions
    -- for 1.20.1", and without these columns every listing becomes an EXISTS over
    -- the version table with deduplication, and sorting by downloads stops being
    -- cheap. Recomputed in refreshProjectFacets() after every version change.
    --
    -- The owner is an account OR an organization, exactly one of the two.
    CREATE TABLE IF NOT EXISTS project (
      id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
      id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      project_id    BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
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
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      version_id BIGINT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
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
      id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      version_id  BIGINT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
      kind        TEXT   NOT NULL DEFAULT 'required',
      project_id  BIGINT REFERENCES project(id) ON DELETE CASCADE,
      depends_on  BIGINT REFERENCES version(id) ON DELETE CASCADE,
      external    JSONB,
      CONSTRAINT dependency_one_target CHECK (num_nonnulls(project_id, depends_on, external) = 1)
    );
    CREATE INDEX IF NOT EXISTS idx_dependency_version ON version_dependency (version_id);

    CREATE TABLE IF NOT EXISTS project_gallery (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
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

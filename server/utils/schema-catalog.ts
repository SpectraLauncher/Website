
import { usePool } from './db'

// Kregoslup katalogu tresci: Project -> Version -> File, jeden dla wszystkich
// pieciu typow. Roznice miedzy typami siedza w kolumnach `meta` (JSONB), nigdy
// w osobnych tabelach.
//
// Ten sam wzorzec co ensureSchema(): CREATE TABLE IF NOT EXISTS na start, a
// kazda pozniejsza kolumna wlasnym ALTER ... ADD COLUMN IF NOT EXISTS, bo na
// bazie, ktora tabele juz ma, IF NOT EXISTS pomija cale polecenie.
//
// ponytail: brak wersjonowania migracji. Przy pierwszej zmianie destrukcyjnej
// (drop kolumny, przebudowa indeksu) dolozyc tabele schema_migration z numerem
// i uruchamiac kroki po kolei.
export async function ensureCatalogSchema() {
  const pool = usePool()

  await pool.query(`
    -- Projekt. game_versions i loaders sa tu zdenormalizowane jako suma po
    -- wersjach — listing pyta "mody na 1.20.1 z Fabrikiem", nie "wersje na
    -- 1.20.1", a bez tych kolumn kazdy listing to EXISTS po tabeli version z
    -- deduplikacja i sortowanie po downloads przestaje byc tanie. Przeliczane
    -- w refreshProjectFacets() po kazdej zmianie wersji.
    --
    -- Wlascicielem jest konto ALBO organizacja, dokladnie jedno z dwojga.
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

    -- Plik jest identyfikowany hashem, nie nazwa. object_key niesie sha512, wiec
    -- ten sam JAR w dziesieciu modpackach lezy w R2 raz. sha1 istnieje wylacznie
    -- jako klucz wyszukiwania: caly ekosystem Minecrafta identyfikuje pliki po
    -- sha1 i launcher musi to umiec, ale sha1 jest zlamany kolizyjnie i nie moze
    -- decydowac o tym, gdzie plik lezy.
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

    -- Zaleznosc wskazuje na projekt u nas, konkretna wersje u nas, albo na obcy
    -- katalog (external = { source: 'modrinth', id: '...' }) — dokladnie jedno.
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

  // Klucz obcy na organizacje nakladany osobno, bo tabele tworzy plugin
  // better-auth i na bazie sprzed jego wlaczenia jeszcze jej nie ma. Bez tego
  // caly ensureCatalogSchema wywala sie na starcie i serwer nie wstaje.
  const orgTable = await pool.query(`SELECT to_regclass('public.organization') AS t`)
  if (orgTable.rows[0]?.t) {
    await pool.query(`
      ALTER TABLE project DROP CONSTRAINT IF EXISTS project_org_fk;
      ALTER TABLE project ADD CONSTRAINT project_org_fk
        FOREIGN KEY (org_id) REFERENCES organization(id) ON DELETE CASCADE;
    `)
  }

  // Kolumna generowana, zeby nie bylo czego zapomniec zaktualizowac. 'simple',
  // nie 'english': nazwy modow to nazwy wlasne ("Sodium", "Iris"), stemming psuje
  // je bardziej, niz pomaga. Literowki dobija pg_trgm nizej.
  await pool.query(`
    ALTER TABLE project ADD COLUMN IF NOT EXISTS search tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
      ) STORED
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_project_search ON project USING GIN (search)')

  // pg_trgm wymaga uprawnien, ktorych rola aplikacyjna moze nie miec. Wyszukiwanie
  // dziala bez niego, tylko bez tolerancji literowek — to nie jest powod, zeby
  // serwer nie wstal.
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await pool.query(
      'CREATE INDEX IF NOT EXISTS idx_project_title_trgm ON project USING GIN (title gin_trgm_ops)')
  } catch (e) {
    console.warn('[db] pg_trgm niedostepny — wyszukiwarka katalogu bez tolerancji literowek:',
      (e as Error).message)
  }
}

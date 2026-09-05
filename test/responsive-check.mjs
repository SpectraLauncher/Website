// node test/responsive-check.mjs
//
// Klasy, ktore rozpychaja strone w poziomie na waskim ekranie. Nikt tego nie
// zobaczy na monitorze, a telefon to wiekszosc ruchu.
//
// Celowo waskie. Sprawdzanie, ktore krzyczy na poprawny kod, przestaje byc
// czytane po tygodniu, wiec sa tu tylko wzorce zawsze bedace bledem —
// przepelnienie, a nie gust.
//
// Liczba kolumn siatki tu nie jest sprawdzana, bo statycznie nie widac, co w
// nich siedzi: grid-cols-8 emoji po 24px miesci sie, grid-cols-3 kart nie.
// Regula po samej liczbie dawala wylacznie falszywe trafienia.
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['app/components', 'app/pages', 'app/layouts']

// Renderowane przez satori do obrazka o stalej szerokosci, nie w przegladarce.
const SKIP = /app\/components\/OgImage\//

function* walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.name.endsWith('.vue')) yield p.split(path.sep).join('/')
  }
}

const PREFIXED = /^(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|hover|focus|group|peer|dark|print):/

function classAttributes(source) {
  return [...source.matchAll(/(?:^|\s)(?::?class)="([^"]*)"/g)].map(m => m[1])
}

function bareClasses(attr) {
  return attr.split(/\s+/)
    .map(raw => raw.replace(/^['"`]|['"`,]$/g, '').trim())
    .filter(cls => cls && !PREFIXED.test(cls))
}

const problems = []

for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (SKIP.test(file)) continue

    const source = fs.readFileSync(file, 'utf8')
    // Szerokosc w pikselach jest w porzadku, jesli cos nad nia przewija.
    const scrolls = /overflow-x-auto|overflow-auto|overflow-x-scroll/.test(source)

    for (const attr of classAttributes(source)) {
      for (const cls of bareClasses(attr)) {
        if (/^(w|min-w)-\[\d{3,}px\]$/.test(cls) && !scrolls) {
          problems.push(`${file} — "${cls}" bez przewijania nad soba rozpycha strone`)
        }
      }
    }

    // Tekst wpisany przez czlowieka trafia tu w calosci. Jeden wklejony dlugi
    // adres bez spacji rozpycha kontener, bo pre-wrap lamie na spacjach, a tam
    // ich nie ma.
    for (const attr of classAttributes(source)) {
      if (/whitespace-pre-wrap/.test(attr) && !/break-words|break-all/.test(attr)) {
        problems.push(`${file} — whitespace-pre-wrap bez break-words, dlugi adres sie nie zlamie`)
      }
    }

    if (/<table\b/.test(source) && !scrolls) {
      problems.push(`${file} — <table> bez kontenera z overflow-x-auto`)
    }
  }
}

if (problems.length) {
  console.error('Klasy, ktore rozpychaja strone na telefonie:\n'
    + [...new Set(problems)].map(p => '  ' + p).join('\n'))
  process.exit(1)
}

console.log('✓ nic nie wymusza szerokosci wiekszej niz ekran')

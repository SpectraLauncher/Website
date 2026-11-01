import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = resolve('public/install.sh')
const TOOLS = ['cat', 'chmod', 'mkdir', 'mktemp', 'mv', 'rm', 'sed', 'tr']

const MANIFEST = JSON.stringify({
  version: '9.9.9',
  platforms: {
    'linux-x86_64': { signature: 'c2ln', url: 'https://example.test/generic.AppImage' },
    'linux-x86_64-deb': { signature: 'c2ln', url: 'https://example.test/app_amd64.deb' },
    'linux-x86_64-rpm': { signature: 'c2ln', url: 'https://example.test/app.x86_64.rpm' },
    'linux-x86_64-appimage': { signature: 'c2ln', url: 'https://example.test/app_amd64.AppImage' },
  },
}, null, 2)

const dirs: string[] = []

function run(managers: string[], { arch = 'x86_64', manifest = MANIFEST } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'install-sh-'))
  dirs.push(root)
  const log = join(root, 'calls.log')
  const bin = join(root, 'bin')
  execFileSync('mkdir', [bin, join(root, 'home')])

  for (const tool of TOOLS) {
    symlinkSync(execFileSync('which', [tool], { encoding: 'utf8' }).trim(), join(bin, tool))
  }
  const stub = (name: string, body: string) => {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`)
    chmodSync(join(bin, name), 0o755)
  }
  writeFileSync(join(root, 'latest.json'), manifest)
  stub('uname', `[ "$1" = -s ] && echo Linux || echo ${arch}`)
  stub('id', 'echo 0')
  stub('curl', `case "$*" in
  *latest.json*) cat "${join(root, 'latest.json')}" ;;
  *) while [ $# -gt 0 ]; do [ "$1" = -o ] && : > "$2"; shift; done ;;
esac`)
  for (const manager of managers) stub(manager, `echo "${manager} $*" >> "${log}"`)

  const result = spawnSync('/bin/sh', [SCRIPT], {
    encoding: 'utf8',
    env: { PATH: bin, HOME: join(root, 'home') },
  })
  return {
    ...result,
    home: join(root, 'home'),
    calls: existsSync(log) ? readFileSync(log, 'utf8') : '',
  }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('install.sh', () => {
  it('installs the deb where apt is available', () => {
    const { status, calls } = run(['apt-get', 'dnf'])
    expect(status).toBe(0)
    expect(calls).toMatch(/^apt-get install -y .*\/app_amd64\.deb\n$/)
  })

  it('installs the rpm with dnf', () => {
    const { status, calls } = run(['dnf'])
    expect(status).toBe(0)
    expect(calls).toMatch(/^dnf install -y .*\/app\.x86_64\.rpm\n$/)
  })

  it('leaves zypper alone, because openSUSE names the rpm dependencies differently', () => {
    const { status, calls, home } = run(['zypper'])
    expect(status).toBe(0)
    expect(calls).toBe('')
    expect(existsSync(join(home, '.local/bin/spectra-launcher.AppImage'))).toBe(true)
  })

  it('falls back to an AppImage whose menu entry passes spectra:// links on', () => {
    const { status, home } = run([])
    expect(status).toBe(0)
    expect(existsSync(join(home, '.local/bin/spectra-launcher.AppImage'))).toBe(true)
    const entry = readFileSync(join(home, '.local/share/applications/spectra-launcher.desktop'), 'utf8')
    expect(entry).toContain(`Exec="${join(home, '.local/bin/spectra-launcher.AppImage')}" %u`)
    expect(entry).toContain('MimeType=x-scheme-handler/spectra;')
  })

  it('refuses other architectures', () => {
    const { status, stderr } = run(['apt-get'], { arch: 'aarch64' })
    expect(status).toBe(1)
    expect(stderr).toContain('aarch64')
  })

  it('stops when the release has no build for this system', () => {
    const { status, stderr, calls } = run(['apt-get'], { manifest: '{"platforms":{}}' })
    expect(status).toBe(1)
    expect(stderr).toContain('no deb build')
    expect(calls).toBe('')
  })
})

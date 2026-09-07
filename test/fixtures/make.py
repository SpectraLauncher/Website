"""Rebuilds the small archives the parser and scanner tests read.

    python test/fixtures/make.py

These are ours, so they are generated rather than committed — a zip bomb and
three malware samples are clearer as the twenty lines that describe them than as
binaries nobody can diff. Python's zipfile is deliberately a different
implementation from the reader under test; a fixture written by our own writer
would only prove the two agree with each other.

The real mods, plugins, packs and schematics cannot be generated. README.md says
what they are; the suites that need them skip when they are absent.

To add a fixture: one entry in FILES, or one function for a shape zipfile cannot
express directly.
"""

import json
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))

STORED = zipfile.ZIP_STORED
DEFLATED = zipfile.ZIP_DEFLATED

MANIFEST = b'Manifest-Version: 1.0\r\n'

# A jar the metadata reader should understand completely.
FABRIC_MOD = {
    'schemaVersion': 1,
    'id': 'spectra_test',
    'version': '1.4.2',
    'name': 'Spectra Test Mod',
    'description': 'Fixture dla parsera metadanych.',
    'authors': ['Spectra'],
    'license': 'MIT',
    'environment': '*',
    'depends': {
        'fabricloader': '>=0.15.0',
        'minecraft': '~1.20.1',
        'java': '>=17',
    },
}

PLUGIN_YML = """name: SpectraGuard
version: 2.4.1
main: app.usespectra.guard.GuardPlugin
api-version: '1.20'
description: Region protection for the test suite.
website: https://usespectra.app
authors: [Alice, Bob]
folia-supported: true
depend: [Vault]
softdepend:
  - PlaceholderAPI
  - LuckPerms
commands:
  guard:
    description: Manage regions
    permission: spectraguard.use
"""

VELOCITY_PLUGIN = {
    'id': 'spectraproxy',
    'name': 'Spectra Proxy',
    'version': '1.0.3',
    'description': 'Proxy side of the test suite.',
    'authors': ['Alice'],
    'url': 'https://usespectra.app',
}

MRPACK_INDEX = {
    'formatVersion': 1,
    'game': 'minecraft',
    'versionId': '1.2.0',
    'name': 'Spectra Test Pack',
    'summary': 'Fixture for the mrpack reader.',
    'dependencies': {'minecraft': '1.20.1', 'fabric-loader': '0.15.7'},
    'files': [
        {
            'path': 'mods/sodium.jar',
            'hashes': {'sha1': 'a' * 40, 'sha512': 'b' * 128},
            'downloads': ['https://cdn.modrinth.com/data/AANobbMI/versions/vvvvvvvv/sodium.jar'],
            'fileSize': 1234,
            'env': {'client': 'required', 'server': 'unsupported'},
        },
        {
            'path': 'mods/local-only.jar',
            'hashes': {'sha1': 'c' * 40, 'sha512': 'd' * 128},
            'downloads': ['https://example.com/local-only.jar'],
            'fileSize': 99,
        },
    ],
}

# Enough of a mod to be read at all. The scan samples pair it with the one thing
# each of them exists to be caught for.
MINIMAL_MOD = b'{"id":"x","version":"1.0.0"}'

PNG_MAGIC = b'\x89PNG\r\n\x1a\n'

# DOS header. What makes a Windows executable recognisable whatever it is named.
MZ = b'MZ' + b'A' * 64

# entry name, bytes, compression
FILES = {
    'sample-fabric-mod.jar': [
        ('fabric.mod.json', json.dumps(FABRIC_MOD, indent=2).encode(), DEFLATED),
        ('META-INF/MANIFEST.MF', MANIFEST, STORED),
        ('assets/spectra_test/icon.png', PNG_MAGIC, STORED),
    ],
    'sample-plugin.jar': [
        ('plugin.yml', PLUGIN_YML.encode(), DEFLATED),
        ('META-INF/MANIFEST.MF', MANIFEST, DEFLATED),
    ],
    'sample-velocity-plugin.jar': [
        ('velocity-plugin.json', json.dumps(VELOCITY_PLUGIN, indent=2).encode(), DEFLATED),
    ],
    'sample-pack.mrpack': [
        ('modrinth.index.json', json.dumps(MRPACK_INDEX, indent=2).encode(), DEFLATED),
        ('overrides/config/example.toml', b'a = 1\n', DEFLATED),
    ],
    # A class file carrying the address of somewhere arbitrary bytes are served.
    'scan-beacon.jar': [
        ('fabric.mod.json', MINIMAL_MOD, STORED),
        ('com/example/Loader.class', b'\xca\xfe\xba\xbe' + b'https://pastebin.com/raw/deadbeef', STORED),
    ],
    # An executable named as if it were an image, which is why the scanner reads
    # the first bytes instead of trusting the extension.
    'scan-disguised.jar': [
        ('fabric.mod.json', MINIMAL_MOD, STORED),
        ('assets/icon.png', MZ, STORED),
    ],
    'scan-executable.jar': [
        ('fabric.mod.json', MINIMAL_MOD, STORED),
        ('payload.exe', MZ, STORED),
    ],
    # 10 MB of zeros in 10 kB of archive: the ratio is the finding, not the size.
    'zip-bomb.zip': [
        ('zeros.bin', b'\0' * (10 * 1024 * 1024), DEFLATED),
    ],
    'zip-traversal.zip': [
        ('../../evil.txt', b'nope', STORED),
        ('ok.txt', b'ok', STORED),
    ],
}


def write(name, entries, comment=None):
    path = os.path.join(HERE, name)
    with zipfile.ZipFile(path, 'w') as archive:
        for entry, data, method in entries:
            archive.writestr(zipfile.ZipInfo(entry), data, compress_type=method)
        if comment:
            archive.comment = comment
    return path


def main():
    for name, entries in FILES.items():
        write(name, entries)
        print('wrote', name)

    # The end-of-central-directory comment is the last place a reader looks for
    # the directory, so a long one is what breaks a reader that scans backwards
    # without a bound. 300 bytes is past any fixed-size peek at the tail.
    write(
        'zip-comment.zip',
        [('pack.mcmeta', b'{"pack":{"pack_format":15,"description":"x"}}', STORED)],
        comment=b'K' * 300,
    )
    print('wrote zip-comment.zip')


if __name__ == '__main__':
    main()

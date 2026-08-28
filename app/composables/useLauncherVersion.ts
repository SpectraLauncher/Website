
const RELEASES = 'https://github.com/MakotoPD/Spectra-Launcher/releases/latest'

export interface LauncherDownloads {
  winInstaller: string
  winMsi: string
  macArm: string
  macIntel: string
  linuxAppImage: string
  linuxDeb: string
}

export interface LauncherVersion {
  version: string | null
  downloadUrl: string
  releasesUrl: string
  downloads: LauncherDownloads
}

const FALLBACK: LauncherVersion = {
  version: null,
  downloadUrl: RELEASES,
  releasesUrl: RELEASES,
  downloads: {
    winInstaller:  RELEASES,
    winMsi:        RELEASES,
    macArm:        RELEASES,
    macIntel:      RELEASES,
    linuxAppImage: RELEASES,
    linuxDeb:      RELEASES,
  }
}

export function useLauncherVersion() {
  return useFetch<LauncherVersion>('/api/version', {
    key: 'launcher-version',
    lazy: true,
    default: () => FALLBACK
  })
}

export const GITHUB_REPO = 'https://github.com/SpectraLauncher/Launcher/'

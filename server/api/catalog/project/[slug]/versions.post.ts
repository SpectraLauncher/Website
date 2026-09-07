import type { VersionInput } from '../../../../utils/catalog'

interface UploadDescriptor {
  filename?: unknown
  size?: unknown
  sha1?: unknown
  sha512?: unknown
  token?: unknown
  primary?: unknown
}

// A version and its file in one request. Splitting them left half-made versions
// behind whenever the second call failed, and a version with no file is one
// nobody can install and no moderator can review.
export default defineEventHandler(async (event) => {
  const { project, user } = await editableProject(event, 'upload_version')

  await requireHeadroom(project.id, 'versionsPerProject', project.owner_id ?? user.id)

  const body = await readBody<VersionInput & { files?: UploadDescriptor[] }>(event) ?? {}
  const uploads = Array.isArray(body.files) ? body.files : []

  const files = uploads.map((upload) => {
    const descriptor = {
      filename: safeFilename(String(upload.filename ?? '')),
      size: Number(upload.size),
      sha1: String(upload.sha1 ?? ''),
      sha512: String(upload.sha512 ?? ''),
    }

    // The signature is what makes the descriptor the server's own words rather
    // than the caller's — see signUpload().
    if (!checkUpload(descriptor, String(upload.token ?? ''))) {
      throw createError({ statusCode: 400, statusMessage: 'upload the file again' })
    }

    return { ...descriptor, primary: upload.primary !== false }
  })

  const version = await createVersion(project.id, body)

  const attached = []
  for (const file of files) {
    const key = contentKey(file.sha512, file.filename)
    if (!await contentExists(key, file.size)) {
      throw createError({ statusCode: 409, statusMessage: 'upload the file again' })
    }

    const row = await attachFile(version.id, { ...file, key })
    queueScan(row.id)
    attached.push(row)
  }

  setResponseStatus(event, 201)
  return { version: shortVersion(version, attached) }
})

// Upload the file first, read what it says about itself, and hand back both.
// The form is filled from the archive rather than from what somebody typed —
// a jar knows its own loader and game versions, and it does not get them wrong.
export default defineEventHandler(async (event) => {
  const { project, user } = await editableProject(event, 'upload_version')

  rateLimit(event, { key: `version-upload:${user.id}`, limit: 30, windowMs: 60_000 })

  const filename = safeFilename(String(getQuery(event).filename ?? 'file'))

  const body = await readRawBody(event, false)
  if (!body?.length) throw createError({ statusCode: 400, statusMessage: 'empty body' })

  const stored = await storeContent(body, filename)
  const analysis = await analyzeUpload(body, stored.filename, stored.sha512)

  // The descriptor is signed because the create route cannot recompute sha1
  // without pulling the object back out of storage, and a client that can
  // choose its own sha1 can make a file no launcher will ever match.
  return {
    file: {
      filename: stored.filename,
      size: stored.size,
      sha1: stored.sha1,
      sha512: stored.sha512,
      url: publicContentUrl(stored.key),
      token: signUpload(stored),
    },
    analysis,
    projectType: project.type,
  }
})

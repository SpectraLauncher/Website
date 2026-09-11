// The catalog is closed while NUXT_PUBLIC_CATALOG_PUBLIC is off: the server
// serves it to the admin alone and answers 404 to everyone else.
export default gateRoute('/api/catalog/gate')

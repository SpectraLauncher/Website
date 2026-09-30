// One place the navigation and the modals agree on. The button lives in the
// navbar, the forms are mounted once in app.vue, and neither needs to know
// about the other.
export function useCreateFlows() {
  return {
    organization: useState('create-organization', () => false),
    collection: useState('create-collection', () => false),
  }
}

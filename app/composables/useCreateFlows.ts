// One place the navigation and the modals agree on. The button lives in the
// navbar, the forms are mounted once in app.vue, and neither needs to know
// about the other.
export function useCreateFlows() {
  return {
    project: useState('create-project', () => false),
    organization: useState('create-organization', () => false),
    collection: useState('create-collection', () => false),
  }
}

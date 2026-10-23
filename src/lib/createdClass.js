// Only successful create responses enter this loading allowance. Server queries
// still authorize the class; a lagging catalog must not hide the next screen.
const created = new Set();
export const rememberCreatedClass = (id) => created.add(id);
export const isRecentlyCreatedClass = (id) => created.has(id);
export const clearCreatedClasses = () => created.clear();

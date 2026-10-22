// Shared ownership prevents nested help/modal/sidebar teardown from leaving the page locked.
const owners = new Set();
let original = "";
export function lockBodyScroll() {
  const owner = {};
  if (!owners.size) original = document.body.style.overflow;
  owners.add(owner);
  document.body.style.overflow = "hidden";
  return () => {
    if (!owners.delete(owner)) return;
    if (!owners.size) document.body.style.overflow = original;
  };
}

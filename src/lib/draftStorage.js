// A delayed completion in a readonly tab may observe an older operation. Never
// remove a newer draft that the active tab has already saved under the same key.
export function removeCompletedDraft(key,operationKey){
 try{const raw=localStorage.getItem(key);if(!raw)return true;const draft=JSON.parse(raw);if(draft?.operationKey!==operationKey)return true;localStorage.removeItem(key);return true;}catch{return false;}
}
// Only call for an explicit discard while holding the editor's Web Lock.
export function discardStoredDraft(key,fresh){
 try{localStorage.removeItem(key);return true;}catch{try{localStorage.setItem(key,JSON.stringify(fresh));return true;}catch{return false;}}
}

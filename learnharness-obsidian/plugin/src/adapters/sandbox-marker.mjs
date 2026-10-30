/** Conservative marker for the disposable development vault, not a security boundary.
 * @param {string} text
 * @returns {boolean}
 */
export function isDisposableVault(text) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1];
  if (!frontmatter) return false;
  const identities = frontmatter.split(/\r?\n/).filter(line => /^id\s*:/.test(line));
  return identities.length === 1 && /^id: learnharness-disposable-vault\s*$/.test(identities[0]);
}

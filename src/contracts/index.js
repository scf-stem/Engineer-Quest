/** Public local-demo contracts. Digests identify content; they grant no authority. */
export const CONTRACT_VERSION = '0.2.0';
export const SNAPSHOT_VERSION = 'eq.submission/1';

export function canonicalJson(value) {
  const visiting = new Set();
  function encode(item) {
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || !item || visiting.has(item)) throw new TypeError('内容必须是有限、无循环的 JSON');
    if (!Array.isArray(item) && ![Object.prototype,null].includes(Object.getPrototypeOf(item))) throw new TypeError('只支持普通 JSON 对象');
    visiting.add(item);
    const result = Array.isArray(item)
      ? '[' + Array.from(item, encode).join(',') + ']'
      : '{' + Object.keys(item).sort().map(key => JSON.stringify(key) + ':' + encode(item[key])).join(',') + '}';
    visiting.delete(item);
    return result;
  }
  return encode(value);
}

export async function textDigest(value) {
  if (typeof value !== 'string') throw new TypeError('源码摘要需要文本');
  const bytes = new TextEncoder().encode(value);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function contentDigest(value) { return textDigest(canonicalJson(value)); }

export async function createRef(id, version, content) {
  if (!id || typeof id !== 'string' || !version || typeof version !== 'string') throw new TypeError('引用需要 ID 和版本');
  return Object.freeze({id, version, digest: await contentDigest(content)});
}

export function assertRef(ref) {
  if (!ref || !['id', 'version'].every(k => typeof ref[k] === 'string' && ref[k]) || !/^sha256:[0-9a-f]{64}$/.test(ref.digest)) throw new TypeError('无效的内容版本引用');
  return ref;
}

export function immutable(value) {
  const copy = structuredClone(value);
  function freeze(item) {
    if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); }
    return item;
  }
  return freeze(copy);
}

/** Drawing positions never prove or change connectivity. */
export function wiringSemantics(document) {
  if (!document || !Array.isArray(document.connections) || !Array.isArray(document.components)) throw new TypeError('接线文档缺少元件或连线');
  return {
    schemaVersion: document.schemaVersion,
    deviceProfileRef: document.deviceProfileRef,
    components: document.components.map(({instanceId, typeRef}) => ({instanceId, typeRef})).sort((a,b) => a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0),
    connections: document.connections.map(({from,to}) => [from,to].sort()).sort((a,b) => canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0),
  };
}

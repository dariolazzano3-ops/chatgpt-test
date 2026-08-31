function array(value) {
  return Array.isArray(value) ? value : [];
}

async function nodesOfType(framer, type) {
  if (!framer || typeof framer.getNodesWithType !== 'function') return [];
  try {
    return array(await framer.getNodesWithType(type));
  } catch {
    return [];
  }
}

function ids(nodes) {
  return new Set(array(nodes).map((node) => node?.id).filter(Boolean).map(String));
}

async function detectInsertedNode(framer, type, before) {
  const beforeIds = ids(before);
  const after = await nodesOfType(framer, type);
  const added = after.filter((node) => node?.id && !beforeIds.has(String(node.id)));
  return added.at(-1) || null;
}

export function wrapFramerConnectionForTrackedInsertions(framer) {
  if (!framer || typeof framer !== 'object') throw new Error('FRAMER_CONNECTION_INVALID');

  return new Proxy(framer, {
    get(target, property, receiver) {
      if (property === 'addText' && typeof target.addText === 'function') {
        return async (...args) => {
          const before = await nodesOfType(target, 'TextNode');
          const returned = await target.addText(...args);
          if (returned && typeof returned === 'object') return returned;
          return detectInsertedNode(target, 'TextNode', before);
        };
      }

      if (property === 'addSVG' && typeof target.addSVG === 'function') {
        return async (...args) => {
          const before = await nodesOfType(target, 'SVGNode');
          const returned = await target.addSVG(...args);
          if (returned && typeof returned === 'object') return returned;
          return detectInsertedNode(target, 'SVGNode', before);
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

export async function connectTrackedFramer(projectUrl, apiKey) {
  const module = await import('framer-api');
  if (typeof module.connect !== 'function') throw new Error('FRAMER_SERVER_API_CONNECT_UNAVAILABLE');
  const connection = await module.connect(projectUrl, apiKey);
  return wrapFramerConnectionForTrackedInsertions(connection);
}

export function framerTrackedConnectionManifest() {
  return {
    schema: 'riosystems.framer-tracked-connection.v1',
    purpose: 'Recover inserted TextNode/SVGNode references when Framer insertion APIs return void',
    tracked_insertions: ['TextNode', 'SVGNode'],
    destructive_operations: false,
    publish_operations: false,
    deploy_operations: false
  };
}

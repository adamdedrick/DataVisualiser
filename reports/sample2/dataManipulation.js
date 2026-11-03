function findCollectionByName(value, collectionName) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const normalizedCollectionName = String(collectionName).toLowerCase();

  if (Array.isArray(value[collectionName])) {
    return value[collectionName];
  }

  if (Array.isArray(value[collectionName.toLowerCase()])) {
    const lowerCaseCollection = value[normalizedCollectionName];
    return lowerCaseCollection;
  }

  for (const childValue of Object.values(value)) {
    if (childValue && typeof childValue === 'object') {
      const nestedCollection = findCollectionByName(childValue, collectionName);
      if (nestedCollection) {
        return nestedCollection;
      }
    }
  }

  return null;
}

function PrepareData(jsonInput) {
  if (typeof jsonInput !== 'string' && (!jsonInput || typeof jsonInput !== 'object')) {
    throw new Error('Input must be a JSON string or object');
  }

  const payload = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
  const itemLinesCollection = findCollectionByName(payload, 'ItemLinesCollection');

  if (!Array.isArray(itemLinesCollection)) {
    return { ...payload, ItemLinesCollection2: [] };
  }

  const groups = new Map();

  itemLinesCollection.forEach((lineItem) => {
    const modelName = String(
      lineItem?.Model?.ModelName || lineItem?.ModelName || lineItem?.modelName || 'Unspecified'
    ).trim() || 'Unspecified';

    const key = modelName;

    if (!groups.has(key)) {
      groups.set(key, {
        ModelName: modelName,
        ItemLinesCollection: []
      });
    }

    const group = groups.get(key);
    group.ItemLinesCollection.push(lineItem);
  });

  // Calculate volume totals for each group
  groups.forEach((group) => {
    group.VolumeTotal = group.ItemLinesCollection.reduce((sum, item) => {
      const volume = parseFloat(item?.Volume) || 0;
      return sum + volume;
    }, 0);
  });

  return {
    ...payload,
    ItemLinesCollection2: Array.from(groups.values())
  };
}

module.exports = { PrepareData };

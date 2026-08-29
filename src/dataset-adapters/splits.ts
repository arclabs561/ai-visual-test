export interface GroupedDatasetExample {
  id: string;
  groupId: string;
  /** Every source entity whose variants must remain in the same split. */
  sourceGroups?: readonly string[];
}

export interface DatasetSplit<T extends GroupedDatasetExample = GroupedDatasetExample> {
  name: string;
  examples: readonly T[];
}

export class DatasetSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetSplitError';
  }
}

function nonEmpty(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DatasetSplitError(`${subject} must be a non-empty string`);
  }
  return value;
}

/**
 * Prove that no row ID or source family crosses a named split. This validates
 * a proposed split; it does not invent one when upstream grouping is absent.
 */
export function assertGroupDisjointSplits<T extends GroupedDatasetExample>(
  splits: readonly DatasetSplit<T>[],
): void {
  const splitNames = new Set<string>();
  const idOwners = new Map<string, string>();
  const groupOwners = new Map<string, string>();
  for (const [splitIndex, split] of splits.entries()) {
    const splitName = nonEmpty(split.name, `split ${splitIndex}.name`);
    if (splitNames.has(splitName)) throw new DatasetSplitError(`duplicate split name: ${splitName}`);
    splitNames.add(splitName);
    if (!Array.isArray(split.examples)) throw new DatasetSplitError(`split ${splitName}.examples must be an array`);
    for (const [exampleIndex, example] of split.examples.entries()) {
      const id = nonEmpty(example.id, `split ${splitName}.examples[${exampleIndex}].id`);
      const priorIdOwner = idOwners.get(id);
      if (priorIdOwner !== undefined) {
        throw new DatasetSplitError(`example ${id} appears in both ${priorIdOwner} and ${splitName}`);
      }
      idOwners.set(id, splitName);
      const groups = example.sourceGroups ?? [example.groupId];
      if (!Array.isArray(groups) || groups.length === 0) {
        throw new DatasetSplitError(`example ${id} must retain at least one source group`);
      }
      for (const [groupIndex, value] of groups.entries()) {
        const group = nonEmpty(value, `example ${id}.sourceGroups[${groupIndex}]`);
        const priorGroupOwner = groupOwners.get(group);
        if (priorGroupOwner !== undefined && priorGroupOwner !== splitName) {
          throw new DatasetSplitError(`source group ${group} crosses ${priorGroupOwner} and ${splitName}`);
        }
        groupOwners.set(group, splitName);
      }
    }
  }
}

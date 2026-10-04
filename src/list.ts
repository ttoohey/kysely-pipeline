import { SelectQueryBuilder } from "kysely";

export function list<DB, TB extends keyof DB, O, T>(
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
): (offset?: number, limit?: number) => Promise<T[]> {
  return (limit?: number, offset?: number) =>
    query
      .$if(limit !== undefined, (q) => q.limit(limit!))
      .$if(offset !== undefined, (q) => q.offset(offset!))
      .execute()
      .then((items) => items.map(transformer));
}

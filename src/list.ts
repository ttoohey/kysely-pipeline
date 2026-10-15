import { SelectQueryBuilder } from "kysely";

export function list<DB, TB extends keyof DB, O, T>(
  query: SelectQueryBuilder<DB, TB, O>,
  transform: (data: O) => T,
): (limit?: number, offset?: number) => Promise<T[]> {
  return (limit?: number, offset?: number) =>
    query
      .$if(limit !== undefined, (q) => q.limit(limit!))
      .$if(offset !== undefined, (q) => q.offset(offset!))
      .execute()
      .then((items) => items.map(transform));
}

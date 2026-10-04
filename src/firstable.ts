import { SelectQueryBuilder } from "kysely";
import { thenable } from "./thenable.js";

export function firstable<
  TObject extends object,
  DB,
  TB extends keyof DB,
  O,
  T,
  L extends boolean,
>(
  object: TObject,
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
  orThrow: L,
): TObject & Promise<L extends true ? T : L extends false ? T | null : never> {
  return thenable(object, () =>
    orThrow
      ? query.executeTakeFirstOrThrow().then(transformer)
      : query
          .executeTakeFirst()
          .then((value) => (value === null ? null : transformer(value as O))),
  ) as any;
}

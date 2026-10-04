import { SelectQueryBuilder } from "kysely";
import { asynciterable } from "./asynciterable.js";

export function streamable<
  TObject extends object,
  DB,
  TB extends keyof DB,
  O,
  T,
>(
  object: TObject,
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
): TObject & AsyncIterable<T> {
  return asynciterable(object, async function* () {
    for await (const data of query.stream()) {
      yield transformer(data);
    }
  });
}

import { SelectQueryBuilder } from "kysely";
import { asynciterable } from "./asynciterable.js";
import { stream } from "./stream.js";

export function lazyStream<
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
  return asynciterable(
    object,
    stream(query, transformer) as () => AsyncIterableIterator<T>,
  );
}

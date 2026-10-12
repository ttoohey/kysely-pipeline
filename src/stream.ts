import { SelectQueryBuilder, StreamOptions } from "kysely";

export type StreamFn<T> = (
  chunkSizeOrOptions?: number | StreamOptions,
) => AsyncIterable<T>;

export function stream<DB, TB extends keyof DB, O, T>(
  query: SelectQueryBuilder<DB, TB, O>,
  transform: (data: O) => T,
): StreamFn<T> {
  return async function* (chunkSizeOrOptions?: number | StreamOptions) {
    for await (const item of query.stream(chunkSizeOrOptions)) {
      yield transform(item);
    }
  };
}

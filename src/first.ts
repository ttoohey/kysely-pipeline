import { SelectQueryBuilder } from "kysely";
import { PipelineState } from "./types.js";

export type FirstFn<T, S extends PipelineState> = () => Promise<
  S["throwIfNotFound"] extends true
    ? T
    : S["throwIfNotFound"] extends false
      ? T | null
      : never
>;

export function first<DB, TB extends keyof DB, O, T, S extends PipelineState>(
  query: SelectQueryBuilder<DB, TB, O>,
  transform: (data: O) => T,
  state: S,
): FirstFn<T, S> {
  return (state.throwIfNotFound
    ? async () => await query.executeTakeFirstOrThrow().then(transform)
    : async () =>
        await query
          .executeTakeFirst()
          .then((data) =>
            data === null ? null : transform(data as O),
          )) as unknown as FirstFn<T, S>;
}

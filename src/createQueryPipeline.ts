import type { SelectQueryBuilder } from "kysely";
import type { Merge, Pipeline, QueryBuilderPipeline } from "./types.js";
import { paginate } from "./paginate.js";
import { cursor } from "./cursor.js";
import { list } from "./list.js";
import { streamable } from "./streamable.js";
import { firstable } from "./firstable.js";

function pipeline<DB, TB extends keyof DB, O, T, L extends boolean>(
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
  throwIfNotFound: L,
): QueryBuilderPipeline<DB, TB, O, T, L> {
  const p: Pipeline<DB, TB, O, T, L> = {
    query,
    extend: <N>(
      func: (
        qb: SelectQueryBuilder<DB, TB, O>,
      ) => SelectQueryBuilder<DB, TB, N>,
    ): QueryBuilderPipeline<DB, TB, N, Merge<O, T, N>, L> =>
      pipeline(
        func(query),
        transformer as unknown as (data: N) => Merge<O, T, N>,
        throwIfNotFound,
      ),
    map: (func) =>
      pipeline(query, (data) => func(transformer(data)), throwIfNotFound),
    compose: (func) => func(pipeline(query, transformer, throwIfNotFound)),
    throwIfNotFound: () => pipeline(query, transformer, true),
    cursor: cursor(query, transformer),
    list: list(query, transformer),
    paginate: paginate(query, transformer),
    transform: transformer,
  };
  const s = streamable(p, query, transformer);
  const f = firstable(s, query, transformer, throwIfNotFound);
  Object.freeze(f);
  return f;
}

export function createQueryPipeline<DB, TB extends keyof DB, O>(
  query: SelectQueryBuilder<DB, TB, O>,
) {
  return pipeline(query, (data: O) => data, false);
}

import type { SelectQueryBuilder } from "kysely";
import type { Merge, Pipeline, QueryBuilderPipeline } from "./types.js";
import { cursor } from "./cursor.js";
import { list } from "./list.js";
import { streamable } from "./streamable.js";
import { firstable } from "./firstable.js";
import { seek } from "./seek.js";
import { page } from "./page.js";

function pipeline<DB, TB extends keyof DB, O, T, L extends boolean>(
  query: SelectQueryBuilder<DB, TB, O>,
  transform: (data: O) => T,
  throwIfNotFound: L,
): QueryBuilderPipeline<DB, TB, O, T, L> {
  const p: Pipeline<DB, TB, O, T, L> = {
    query,
    transform,
    throwIfNotFound: () => pipeline(query, transform, true),
    extend: <N>(
      func: (
        qb: SelectQueryBuilder<DB, TB, O>,
      ) => SelectQueryBuilder<DB, TB, N>,
    ): QueryBuilderPipeline<DB, TB, N, Merge<O, T, N>, L> =>
      pipeline(
        func(query),
        transform as unknown as (data: N) => Merge<O, T, N>,
        throwIfNotFound,
      ),
    map: (func) =>
      pipeline(query, (data) => func(transform(data)), throwIfNotFound),
    compose: (func) => func(pipeline(query, transform, throwIfNotFound)),
    cursor: cursor(query, transform),
    list: list(query, transform),
    page: page(query, transform),
    seek: seek(query, transform),
  };
  const s = streamable(p, query, transform);
  const f = firstable(s, query, transform, throwIfNotFound);
  Object.freeze(f);
  return f;
}

export function createQueryPipeline<DB, TB extends keyof DB, O>(
  query: SelectQueryBuilder<DB, TB, O>,
) {
  return pipeline(query, (data: O) => data, false);
}

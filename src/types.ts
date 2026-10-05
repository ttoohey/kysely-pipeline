import {
  ExtractTypeFromReferenceExpression,
  SelectQueryBuilder,
  StringReference,
} from "kysely";
import { PaginateFn } from "./paginate.js";

export type JsonFrom<T> = {
  [P in keyof T]: T[P] extends boolean | number | [] | object
    ? T[P]
    : null extends T[P]
      ? string | null
      : string;
};

export type Merge<O, T, N> = N & Omit<T, Exclude<keyof O, keyof N>>;

export type QueryBuilderPipeline<
  DB,
  TB extends keyof DB,
  O,
  T,
  L extends boolean = boolean,
> = Promise<L extends true ? T : L extends false ? T | null : never> &
  AsyncIterable<T> &
  Pipeline<DB, TB, O, T, L>;

export interface Pipeline<DB, TB extends keyof DB, O, T, L extends boolean> {
  query: SelectQueryBuilder<DB, TB, O>;
  extend<N>(
    func: (qb: SelectQueryBuilder<DB, TB, O>) => SelectQueryBuilder<DB, TB, N>,
  ): QueryBuilderPipeline<DB, TB, N, Merge<O, T, N>, L>;
  map<N>(func: (data: T) => N): QueryBuilderPipeline<DB, TB, O, N, L>;
  compose<QN, TN>(
    func: (
      p: QueryBuilderPipeline<DB, TB, O, T, L>,
    ) => QueryBuilderPipeline<DB, TB, QN, TN, L>,
  ): QueryBuilderPipeline<DB, TB, QN, TN, L>;
  throwIfNotFound(): QueryBuilderPipeline<DB, TB, O, T, true>;
  list(offset?: number, limit?: number): Promise<T[]>;
  paginate: PaginateFn<T>;
  cursor<RE extends StringReference<DB, TB>>(
    index: RE,
    options?: {
      startAt?: ExtractTypeFromReferenceExpression<DB, TB, RE>;
      sortDirection?: "asc" | "desc";
      batchSize?: number;
    },
  ): AsyncIterable<T>;
  transform: (data: O) => T;
}

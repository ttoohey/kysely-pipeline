import { SelectQueryBuilder } from "kysely";
import { SeekFn } from "./seek.js";
import { PageFn } from "./page.js";
import { CursorFn } from "./cursor.js";

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
  /**
   * Pipeline query
   */
  query: SelectQueryBuilder<DB, TB, O>;
  /**
   * Adjust the query builder
   * @param func
   */
  extend<N>(
    func: (qb: SelectQueryBuilder<DB, TB, O>) => SelectQueryBuilder<DB, TB, N>,
  ): QueryBuilderPipeline<DB, TB, N, Merge<O, T, N>, L>;
  /**
   * Adjust the transformer
   * @param func
   */
  map<N>(func: (data: T) => N): QueryBuilderPipeline<DB, TB, O, N, L>;
  /**
   * Apply modifiers to the pipeline
   * @param func
   */
  compose<QN, TN>(
    func: (
      p: QueryBuilderPipeline<DB, TB, O, T, L>,
    ) => QueryBuilderPipeline<DB, TB, QN, TN, L>,
  ): QueryBuilderPipeline<DB, TB, QN, TN, L>;
  /**
   * When returning a single record, throw instead of returning `null`
   */
  throwIfNotFound(): QueryBuilderPipeline<DB, TB, O, T, true>;
  /**
   * Fetch records as an array
   * @param offset
   * @param limit
   */
  list(offset?: number, limit?: number): Promise<T[]>;
  /**
   * Offset pagination
   */
  page: PageFn<T>;
  /**
   * Cursor (keyset) pagination
   */
  seek: SeekFn<DB, TB, T>;
  /**
   * Cursor (keyset) based streaming
   * @param index
   * @param options
   */
  cursor: CursorFn<DB, TB, T>;
  /**
   * Apply the transformer to a record
   * @param data
   * @returns
   */
  transform: (data: O) => T;
}

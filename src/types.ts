import { SelectQueryBuilder } from "kysely";
import { SeekFn } from "./seek.js";
import { PageFn } from "./page.js";
import { CursorFn } from "./cursor.js";
import { FirstFn } from "./first.js";
import { StreamFn } from "./stream.js";

export type JsonFrom<T> = {
  [P in keyof T]: T[P] extends boolean | number | [] | object
    ? T[P]
    : null extends T[P]
      ? string | null
      : string;
};

export type Merge<O, T, N> = N & Omit<T, Exclude<keyof O, keyof N>>;

export type PipelineState<
  TThrowIfNotFound extends boolean = boolean,
  TLazy extends boolean = boolean,
> = {
  throwIfNotFound: TThrowIfNotFound;
  lazy: TLazy;
};

export type Pipeline<
  DB,
  TB extends keyof DB,
  O,
  T,
  S extends PipelineState,
> = S["lazy"] extends true
  ? Promise<
      S["throwIfNotFound"] extends true
        ? T
        : S["throwIfNotFound"] extends false
          ? T | null
          : never
    > &
      AsyncIterable<T> &
      BasePipeline<DB, TB, O, T, S>
  : S["lazy"] extends false
    ? BasePipeline<DB, TB, O, T, S>
    : never;

export interface BasePipeline<
  DB,
  TB extends keyof DB,
  O,
  T,
  S extends PipelineState,
> {
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
  ): Pipeline<DB, TB, N, Merge<O, T, N>, S>;
  /**
   * Adjust the transformer
   * @param func
   */
  map<N>(func: (data: T) => N): Pipeline<DB, TB, O, N, S>;
  /**
   * Apply modifiers to the pipeline
   * @param func
   */
  compose<QN, TN>(
    func: (p: Pipeline<DB, TB, O, T, S>) => Pipeline<DB, TB, QN, TN, S>,
  ): Pipeline<DB, TB, QN, TN, S>;
  /**
   * When returning a single record, throw instead of returning `null`
   */
  throwIfNotFound(): Pipeline<
    DB,
    TB,
    O,
    T,
    Omit<S, "throwIfNotFound"> & { throwIfNotFound: true }
  >;
  lazy(): Pipeline<DB, TB, O, T, Omit<S, "lazy"> & { lazy: true }>;
  first: FirstFn<T, S>;
  stream: StreamFn<T>;
  /**
   * Fetch records as an array
   * @param limit
   * @param offset
   */
  list(limit?: number, offset?: number): Promise<T[]>;
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

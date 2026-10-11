import { ExtractTypeFromReferenceExpression } from "kysely";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
type PrettifyTuple<T> = T extends readonly [infer Head, ...infer Tail]
  ? [Head, ...PrettifyTuple<Tail>]
  : [];

type MapTuple<DB, TB extends keyof DB, T extends readonly any[]> = {
  [K in keyof T]: ExtractTypeFromReferenceExpression<DB, TB, T[K]>;
};

export type ExtractTupleTypes<
  DB,
  TB extends keyof DB,
  T extends readonly any[],
> = PrettifyTuple<MapTuple<DB, TB, T>>;

export interface CountedMeta {
  totalItems: number;
  totalPages: number;
}

export type PaginatedResult<T, M> = {
  items: T[];
  meta: Prettify<M>;
};

export type Direction = "asc" | "desc";

export interface OffsetMeta {
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export type KeysetMeta<TCursor> = (
  | {
      hasNext: true;
      nextCursor: TCursor;
    }
  | {
      hasNext: false;
      nextCursor: null;
    }
) &
  (
    | {
        hasPrevious: true;
        previousCursor: TCursor;
      }
    | {
        hasPrevious: false;
        previousCursor: null;
      }
  );

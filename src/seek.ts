import {
  ExtractTypeFromReferenceExpression,
  SelectQueryBuilder,
  StringReference,
} from "kysely";
import { buildCompositeOrderBy, buildCompositeWhere, Nulls } from "./keyset.js";
import {
  CountedMeta,
  Direction,
  ExtractTupleTypes,
  KeysetMeta,
  PaginatedResult,
  wrapInCount,
} from "./pagination.js";

type SeekOptions<TCursor, C extends boolean | undefined> = (C extends boolean
  ? { counting: C }
  : { counting?: undefined }) &
  ((
    | {
        first: number;
        cursor?: TCursor;
        last?: never;
      }
    | {
        last: number;
        cursor?: TCursor;
        first?: never;
      }
  ) &
    (TCursor extends unknown[]
      ? {
          direction?: Direction | (Direction[] & { length: TCursor["length"] });
          nulls?: Nulls | (Nulls[] & { length: TCursor["length"] });
        }
      : { direction?: Direction; nulls?: Nulls }));

type CompositeKeyFn<DB, TB extends keyof DB, T> = (<
  const TColumn extends readonly StringReference<DB, TB>[],
  TCursor extends ExtractTupleTypes<DB, TB, TColumn>,
>(
  column: TColumn,
  options: SeekOptions<TCursor, true>,
) => Promise<PaginatedResult<T, KeysetMeta<TCursor> & CountedMeta>>) &
  (<
    const TColumn extends readonly StringReference<DB, TB>[],
    TCursor extends ExtractTupleTypes<DB, TB, TColumn>,
  >(
    column: TColumn,
    options: SeekOptions<TCursor, false | undefined>,
  ) => Promise<PaginatedResult<T, KeysetMeta<TCursor>>>);

type SingleKeyFn<DB, TB extends keyof DB, T> = (<
  const TColumn extends StringReference<DB, TB>,
  TCursor extends ExtractTypeFromReferenceExpression<DB, TB, TColumn>,
>(
  column: TColumn,
  options: SeekOptions<TCursor, true>,
) => Promise<PaginatedResult<T, KeysetMeta<TCursor> & CountedMeta>>) &
  (<
    const TColumn extends StringReference<DB, TB>,
    TCursor extends ExtractTypeFromReferenceExpression<DB, TB, TColumn>,
  >(
    column: TColumn,
    options: SeekOptions<TCursor, false | undefined>,
  ) => Promise<PaginatedResult<T, KeysetMeta<TCursor>>>);

export type SeekFn<DB, TB extends keyof DB, T> = SingleKeyFn<DB, TB, T> &
  CompositeKeyFn<DB, TB, T>;

const keyAlias = (i: number) => `__pipeline_cursor_${i}`;
export function seek<DB, TB extends keyof DB, O, T>(
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
) {
  return async function <
    const TColumn extends
      StringReference<DB, TB> | readonly StringReference<DB, TB>[],
    TCursor extends (TColumn extends unknown[]
      ? ExtractTupleTypes<DB, TB, TColumn>
      : ExtractTypeFromReferenceExpression<DB, TB, TColumn>),
  >(column: TColumn, options: SeekOptions<TCursor, boolean>) {
    const isReverse = options?.last !== undefined;
    const limit = isReverse ? options.last : options.first;
    const cursor = options.cursor;
    const isComposite = Array.isArray(column);
    const columns = isComposite
      ? (column as readonly StringReference<DB, TB>[])
      : [column as StringReference<DB, TB>];
    const directions: Direction[] = Array.isArray(options?.direction)
      ? options.direction
      : Array(columns.length).fill(
          (options?.direction === "desc") === isReverse ? "asc" : "desc",
        );
    const nulls: Nulls[] = Array.isArray(options.nulls)
      ? options.nulls
      : Array(columns.length).fill(options.nulls ?? "never");

    const cursorOf = (row: Record<string, unknown>) =>
      isComposite ? columns.map((_, i) => row[keyAlias(i)]) : row[keyAlias(0)];
    const stripKeys = (row: Record<string, unknown>) => {
      const out = { ...row };
      columns.forEach((_, i) => delete out[keyAlias(i)]);
      return out as O;
    };

    const itemsQuery = query
      .clearLimit()
      .clearOffset()
      .clearOrderBy()
      .limit(limit + 1)
      .select((eb) => columns.map((col, i) => eb.ref(col).as(keyAlias(i))))
      .$if(isComposite, (q) => {
        const columns = column as readonly StringReference<DB, TB>[];
        return q
          .$call(buildCompositeOrderBy(columns, directions, nulls))
          .$if(Boolean(options.cursor), (q) => {
            const cursor = options.cursor! as ExtractTupleTypes<
              DB,
              TB,
              unknown[]
            >;
            return q.where((eb) =>
              buildCompositeWhere(eb, columns, directions, nulls, cursor),
            );
          });
      })
      .$if(!isComposite, (q) => {
        const columns = [column as StringReference<DB, TB>] as const;
        return q
          .$call(buildCompositeOrderBy(columns, directions, nulls))
          .$if(Boolean(options.cursor), (q) => {
            const cursor = [options.cursor!];
            return q.where((eb) =>
              buildCompositeWhere(eb, columns, directions, nulls, cursor),
            );
          });
      });

    const getMeta = (itemsPlusOne: Record<string, unknown>[]) => {
      const items = itemsPlusOne.slice(0, limit);
      if (isReverse) {
        items.reverse();
      }
      const hasNext =
        (isReverse && cursor !== undefined) ||
        (!isReverse && itemsPlusOne.length > limit);
      const hasPrevious =
        (!isReverse && cursor !== undefined) ||
        (isReverse && itemsPlusOne.length > limit);
      const firstRow = items.at(0);
      const lastRow = items.at(-1);
      const first = firstRow ? cursorOf(firstRow) : null;
      const last = lastRow ? cursorOf(lastRow) : null;
      const nextCursor = hasNext ? last : null;
      const previousCursor = hasPrevious ? first : null;
      return [
        items,
        {
          hasNext,
          hasPrevious,
          nextCursor,
          previousCursor,
        },
      ] as const;
    };

    if (options?.counting !== true) {
      const itemsPlusOne = await itemsQuery.execute();
      const [items, meta] = getMeta(itemsPlusOne);
      return {
        items: items.map(stripKeys).map(transformer),
        meta,
      };
    }
    const countQuery = query
      .clearLimit()
      .clearOffset()
      .clearOrderBy()
      .withPlugin(wrapInCount)
      .$castTo<{ total: bigint | string }>();
    const [count, itemsPlusOne] = await Promise.all([
      countQuery.executeTakeFirstOrThrow(),
      itemsQuery.execute(),
    ]);
    const totalItems = Number(count.total);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
    const [items, meta] = getMeta(itemsPlusOne);

    return {
      items: items.map(stripKeys).map(transformer),
      meta: {
        ...meta,
        totalItems,
        totalPages,
      },
    };
  } as SeekFn<DB, TB, T>;
}

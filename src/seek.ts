import {
  ExtractTypeFromReferenceExpression,
  SelectQueryBuilder,
  StringReference,
} from "kysely";
import { buildCompositeOrderBy, buildCompositeWhere } from "./keyset.js";
import {
  CountedMeta,
  Direction,
  ExtractTupleTypes,
  KeysetMeta,
  PaginatedResult,
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
        }
      : { direction?: Direction }));

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

    const itemsQuery = query
      .clearLimit()
      .clearOffset()
      .clearOrderBy()
      .limit(limit + 1)
      .select(columns)
      .$if(isComposite, (q) => {
        const columns = column as readonly StringReference<DB, TB>[];
        return q
          .$call(buildCompositeOrderBy(columns, directions))
          .$if(Boolean(options.cursor), (q) => {
            const cursor = options.cursor! as ExtractTupleTypes<
              DB,
              TB,
              unknown[]
            >;
            return q.where((eb) =>
              buildCompositeWhere(eb, columns, directions, cursor),
            );
          });
      })
      .$if(!isComposite, (q) => {
        const columns = [column as StringReference<DB, TB>] as const;
        return q
          .$call(buildCompositeOrderBy(columns, directions))
          .$if(Boolean(options.cursor), (q) => {
            const cursor = [options.cursor!];
            return q.where((eb) =>
              buildCompositeWhere(eb, columns, directions, cursor),
            );
          });
      });

    const getMeta = (itemsPlusOne: O[]) => {
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
      const fieldNames = columns.map(
        (column) => column.split(".").at(-1) as keyof O,
      );

      const first = isComposite
        ? fieldNames.map((fieldName) => firstRow?.[fieldName] ?? null)
        : (firstRow?.[fieldNames[0]] ?? null);
      const last = isComposite
        ? fieldNames.map((fieldName) => lastRow?.[fieldName] ?? null)
        : (lastRow?.[fieldNames[0]] ?? null);
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
        items: items.map(transformer),
        meta,
      };
    }
    const countQuery = query
      .clearLimit()
      .clearOffset()
      .clearSelect()
      .clearGroupBy()
      .clearOrderBy()
      .select((eb) => eb.fn.countAll().as("total"))
      .$castTo<{ total: bigint }>();
    const [count, itemsPlusOne] = await Promise.all([
      countQuery.executeTakeFirstOrThrow(),
      itemsQuery.execute(),
    ]);
    const totalItems = Number(count.total);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
    const [items, meta] = getMeta(itemsPlusOne);

    return {
      items: items.map(transformer),
      meta: {
        ...meta,
        totalItems,
        totalPages,
      },
    };
  } as SeekFn<DB, TB, T>;
}

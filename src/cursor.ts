import {
  ExtractTypeFromReferenceExpression,
  SelectQueryBuilder,
  StringReference,
} from "kysely";
import { buildCompositeOrderBy, buildCompositeWhere, Nulls } from "./keyset.js";
import { Direction, ExtractTupleTypes } from "./pagination.js";

type CursorOptions<TCursor> = {
  cursor?: TCursor;
  batchSize?: number;
} & (TCursor extends unknown[]
  ? {
      direction?: Direction | (Direction[] & { length: TCursor["length"] });
      nulls?: Nulls | (Nulls[] & { length: TCursor["length"] });
    }
  : { direction?: Direction; nulls?: Nulls });

type CompositeKeyFn<DB, TB extends keyof DB, T> = <
  const TColumn extends readonly StringReference<DB, TB>[],
  TCursor extends ExtractTupleTypes<DB, TB, TColumn>,
>(
  column: TColumn,
  options?: CursorOptions<TCursor>,
) => AsyncGenerator<T>;

type SingleKeyFn<DB, TB extends keyof DB, T> = <
  const TColumn extends StringReference<DB, TB>,
  TCursor extends ExtractTypeFromReferenceExpression<DB, TB, TColumn>,
>(
  column: TColumn,
  options?: CursorOptions<TCursor>,
) => AsyncGenerator<T>;

export type CursorFn<DB, TB extends keyof DB, T> = SingleKeyFn<DB, TB, T> &
  CompositeKeyFn<DB, TB, T>;

export function cursor<DB, TB extends keyof DB, O, T>(
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
) {
  return async function* <
    const TColumn extends
      StringReference<DB, TB> | readonly StringReference<DB, TB>[],
    TCursor extends (TColumn extends unknown[]
      ? ExtractTupleTypes<DB, TB, TColumn>
      : ExtractTypeFromReferenceExpression<DB, TB, TColumn>),
  >(column: TColumn, options?: CursorOptions<TCursor>) {
    let cursor = options?.cursor;
    const { direction, batchSize = 1_000 } = options ?? {};
    const isComposite = Array.isArray(column);
    const columns = isComposite
      ? (column as readonly StringReference<DB, TB>[])
      : [column as StringReference<DB, TB>];
    const directions: Direction[] = Array.isArray(direction)
      ? direction
      : Array(columns.length).fill(direction === "desc" ? "desc" : "asc");
    const nulls: Nulls[] = Array.isArray(options?.nulls)
      ? options.nulls
      : Array(columns.length).fill(options?.nulls ?? "never");

    do {
      const items = await query
        .clearLimit()
        .clearOrderBy()
        .select(columns)
        .limit(batchSize)
        .$if(isComposite, (q) => {
          const columns = column as readonly StringReference<DB, TB>[];
          return q
            .$call(buildCompositeOrderBy(columns, directions, nulls))
            .$if(cursor !== undefined, (q) => {
              const compCursor = cursor! as ExtractTupleTypes<
                DB,
                TB,
                unknown[]
              >;
              return q.where((eb) =>
                buildCompositeWhere(eb, columns, directions, nulls, compCursor),
              );
            });
        })
        .$if(!isComposite, (q) => {
          const columns = [column as StringReference<DB, TB>] as const;
          return q
            .$call(buildCompositeOrderBy(columns, directions, nulls))
            .$if(cursor !== undefined, (q) => {
              const compCursor = [cursor!];
              return q.where((eb) =>
                buildCompositeWhere(eb, columns, directions, nulls, compCursor),
              );
            });
        })
        .execute();
      for (const item of items) {
        yield transformer(item);
      }
      if (items.length < batchSize) {
        break;
      }
      const lastRow = items.at(-1);
      const fieldNames = columns.map(
        (column) => column.split(".").at(-1) as keyof O,
      );
      cursor = (
        isComposite
          ? fieldNames.map((fieldName) => lastRow![fieldName])
          : lastRow![fieldNames[0]]
      ) as TCursor;
    } while (cursor !== undefined);
  } as CursorFn<DB, TB, T>;
}

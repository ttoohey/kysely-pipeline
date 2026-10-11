import { ExpressionBuilder, SelectQueryBuilder } from "kysely";

export function buildCompositeWhere(
  eb: ExpressionBuilder<any, any>,
  columns: readonly string[],
  directions: readonly ("asc" | "desc")[],
  cursorValues: any[],
  index = 0,
): any {
  const col = columns[index];
  const dir = directions[index];
  const val = cursorValues[index];
  const isLast = index === columns.length - 1;

  const op = dir === "asc" ? ">" : "<";

  let progressiveCondition;
  if (val === null) {
    progressiveCondition = dir === "asc" ? eb(col, "is not", null) : null;
  } else {
    progressiveCondition =
      dir === "asc"
        ? eb.or([
            eb(col, ">", val),
            dir === "asc" ? eb(col, "is", null) : eb(col, "is not", null),
          ])
        : eb(col, "<", val);
    progressiveCondition = eb(col, op, val);
  }

  if (isLast) {
    return progressiveCondition || eb.val(false);
  }

  const equalityCondition =
    val === null ? eb(col, "is", null) : eb(col, "=", val);

  const nextColumnConditions = buildCompositeWhere(
    eb,
    columns,
    directions,
    cursorValues,
    index + 1,
  );

  if (progressiveCondition) {
    return eb.or([
      progressiveCondition,
      eb.and([equalityCondition, nextColumnConditions]),
    ]);
  }

  return eb.and([equalityCondition, nextColumnConditions]);
}

export function buildCompositeOrderBy(
  columns: readonly any[],
  directions: readonly any[],
) {
  return <DB, TB extends keyof DB, O>(query: SelectQueryBuilder<DB, TB, O>) =>
    columns.reduce(
      (q: SelectQueryBuilder<DB, TB, O>, col, index) =>
        q.orderBy(col, directions[index]),
      query,
    );
}

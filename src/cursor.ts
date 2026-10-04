import {
  ExtractTypeFromReferenceExpression,
  SelectQueryBuilder,
  StringReference,
} from "kysely";

export function cursor<DB, TB extends keyof DB, O, T>(
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
) {
  return async function* <RE extends StringReference<DB, TB>>(
    indexColumn: RE,
    {
      startAt,
      sortDirection = "asc",
      batchSize = 1_000,
    }: {
      startAt?: ExtractTypeFromReferenceExpression<DB, TB, RE>;
      sortDirection?: "asc" | "desc";
      batchSize?: number;
    } = {},
  ) {
    let currentCursor: any = startAt;
    const fieldName = indexColumn.split(".").at(-1) as keyof O;
    const whereOp = sortDirection === "asc" ? ">" : "<";
    do {
      const items = await query
        .clearLimit()
        .clearOrderBy()
        .select(indexColumn)
        .limit(batchSize)
        .orderBy(indexColumn, sortDirection)
        .$if(currentCursor !== undefined, (q) =>
          q.where(indexColumn, whereOp, currentCursor!),
        )
        .execute();
      for (const item of items) {
        yield transformer(item);
      }
      const lastRow = items.at(-1);
      currentCursor = lastRow?.[fieldName] ?? undefined;
    } while (currentCursor !== undefined);
  };
}

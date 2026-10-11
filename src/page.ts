import { SelectQueryBuilder } from "kysely";
import { CountedMeta, OffsetMeta, PaginatedResult } from "./pagination.js";

type PageOptions<TCounting extends boolean> = {
  counting: TCounting;
};

export type PageFn<T> = ((
  page: number,
  pageSize: number,
  options: PageOptions<true>,
) => Promise<PaginatedResult<T, OffsetMeta & CountedMeta>>) &
  ((
    page: number,
    pageSize: number,
    options: PageOptions<false>,
  ) => Promise<PaginatedResult<T, OffsetMeta>>) &
  ((
    page: number,
    pageSize: number,
  ) => Promise<PaginatedResult<T, OffsetMeta & CountedMeta>>);

export function page<DB, TB extends keyof DB, O, T>(
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
) {
  return (async (
    page: number,
    limit: number,
    options?: { counting: boolean },
  ) => {
    page = Math.floor(page);
    limit = Math.floor(limit);
    if (page < 1) {
      throw new Error("Invalid page");
    }
    if (limit < 1) {
      throw new Error("Invalid page size");
    }
    if (options?.counting === false) {
      const itemsPlusOne = await query
        .limit(limit + 1)
        .offset((page - 1) * limit)
        .$castTo<O>()
        .execute();
      const hasNext = itemsPlusOne.length > limit;
      const hasPrevious = page > 1;
      const items = itemsPlusOne.slice(0, limit);
      return {
        meta: { page, limit, hasNext, hasPrevious },
        items: items.map(transformer),
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
    const itemsQuery = query
      .clearLimit()
      .clearOffset()
      .limit(limit)
      .offset((page - 1) * limit)
      .$castTo<O>();
    const [count, items] = await Promise.all([
      countQuery.executeTakeFirstOrThrow(),
      itemsQuery.execute(),
    ]);
    const totalItems = Number(count.total);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1 && totalPages > 0;
    return {
      meta: { hasNext, hasPrevious, page, limit, totalItems, totalPages },
      items: items.map(transformer),
    };
  }) as PageFn<T>;
}

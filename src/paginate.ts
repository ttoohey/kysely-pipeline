import { SelectQueryBuilder } from "kysely";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

interface CountedMeta {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  total: number;
  totalPages: number;
}
interface BlindMeta {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}
type PaginatedResult<T, M> = {
  items: T[];
  meta: Prettify<M>;
};
type PaginateOptions<C extends boolean> = {
  counting: C;
};

export type PaginateFn<T> = ((
  page: number,
  pageSize: number,
  options: PaginateOptions<true>,
) => Promise<PaginatedResult<T, CountedMeta>>) &
  ((
    page: number,
    pageSize: number,
    options: PaginateOptions<false>,
  ) => Promise<PaginatedResult<T, BlindMeta>>) &
  ((
    page: number,
    pageSize: number,
  ) => Promise<PaginatedResult<T, CountedMeta>>);

export function paginate<DB, TB extends keyof DB, O, T>(
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
) {
  return (async (
    page: number,
    pageSize: number,
    options?: { counting: boolean },
  ) => {
    page = Math.floor(page);
    pageSize = Math.floor(pageSize);
    if (page < 1) {
      throw new Error("Invalid page");
    }
    if (pageSize < 1) {
      throw new Error("Invalid page size");
    }
    if (options?.counting === false) {
      const itemsPlusOne = await query
        .limit(pageSize + 1)
        .offset((page - 1) * pageSize)
        .$castTo<O>()
        .execute();
      const hasNextPage = itemsPlusOne.length > pageSize;
      const items = itemsPlusOne.slice(0, pageSize);
      return {
        meta: { page, pageSize, hasNextPage },
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
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .$castTo<O>();
    const [count, items] = await Promise.all([
      countQuery.executeTakeFirstOrThrow(),
      itemsQuery.execute(),
    ]);
    const total = Number(count.total);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1 && totalPages > 0;
    return {
      meta: { hasNextPage, hasPrevPage, page, pageSize, total, totalPages },
      items: items.map(transformer),
    };
  }) as PaginateFn<T>;
}

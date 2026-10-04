export function asynciterable<TObject extends object, TGenerator>(
  object: TObject,
  asStream: () => AsyncIterableIterator<TGenerator>,
): TObject & AsyncIterable<TGenerator> {
  return Object.defineProperties(object, {
    [Symbol.asyncIterator]: {
      value: asStream,
      configurable: true,
    },
  }) as TObject & AsyncIterable<TGenerator>;
}
